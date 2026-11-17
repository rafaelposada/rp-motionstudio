// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Photo or video inside a shape. The shape outline clips the media, which
// fills, fits or stretches into the shape box like a card does, with the same
// focal point and zoom. Videos run on the layer's own clock: second 0 of the
// clip plays when the layer appears, in the preview and in the export.
import { coverCrop, type CropFocus, type MediaFit } from './crop';
import { loadPreviewImage, peekPreviewImage, type RenderImage } from './textureLoad';
import { syncReelVideo } from './reelVideoClock';
import { advanceVideoForExport, createCardVideo, prepareVideoForSequentialExport, requestFiniteVideoDuration, videoPlaybackTime, whenVideoReady } from './videoTexture';

export interface ShapeMedia { blobId: string; url: string; kind: 'image' | 'video'; width: number; height: number; videoStart?: number; name?: string; fit?: MediaFit; crop?: CropFocus }
type MediaSource = { url: string; kind?: 'image' | 'video'; videoStart?: number };
type Layer = { id: string; start: number; end: number; visible: boolean; media?: MediaSource; shape?: { media?: ShapeMedia } };

export const MEDIA_READY_EVENT = 'motion-layer-media-ready';
const announce = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(MEDIA_READY_EVENT)); };

const originals = new Map<string, HTMLImageElement>();
const pending = new Set<string>();
const videos = new Map<string, HTMLVideoElement>();
let exporting = false; // export owns the clips: no preview sync may move them

function originalImage(url: string) {
  let image = originals.get(url);
  if (!image) { image = new Image(); image.src = url; originals.set(url, image); }
  return image;
}

function releaseVideo(video: HTMLVideoElement) {
  video.pause(); video.removeAttribute('src'); video.load();
}

export function shapeVideo(url: string, id: string) {
  const known = videos.get(id);
  if (known?.getAttribute('src') === url) return known;
  if (known) releaseVideo(known);
  const video = createCardVideo(url); video.autoplay = false; video.loop = false;
  video.addEventListener('loadeddata', announce); video.addEventListener('seeked', announce);
  // Recorded WebM often reports an infinite duration until read to the end;
  // a far seek makes the browser measure it so the clip can loop and seek.
  video.addEventListener('loadedmetadata', () => { if (video.duration === Infinity) { video.addEventListener('durationchange', () => { video.currentTime = 0; }, { once: true }); requestFiniteVideoDuration(video); } }, { once: true });
  videos.set(id, video);
  return video;
}

// The drawable behind a fill, or null while it loads (a load in progress
// announces itself so a paused preview repaints).
export function shapeMediaSource(media: MediaSource, useOriginals: boolean, id: string): RenderImage | HTMLVideoElement | null {
  if (!media.url) return null;
  if (media.kind === 'video') { const video = shapeVideo(media.url, id); return video.readyState >= 2 && video.videoWidth ? video : null; }
  if (useOriginals) { const image = originalImage(media.url); return image.complete && image.naturalWidth ? image : null; }
  const preview = peekPreviewImage(media.url);
  if (!preview && !pending.has(media.url)) { pending.add(media.url); void loadPreviewImage(media.url).finally(() => { pending.delete(media.url); announce(); }); }
  return preview;
}

const sourceSize = (source: RenderImage | HTMLVideoElement) => 'videoWidth' in source ? [source.videoWidth, source.videoHeight] : 'naturalWidth' in source ? [source.naturalWidth, source.naturalHeight] : [source.width, source.height];

// Draw into the current (already clipped) path, centered on the origin.
export function drawShapeMedia(ctx: CanvasRenderingContext2D, source: RenderImage | HTMLVideoElement, media: ShapeMedia, w: number, h: number) {
  const [sw, sh] = sourceSize(source); if (!sw || !sh) return;
  const fit = media.fit ?? 'fill';
  if (fit === 'stretch') { ctx.drawImage(source, -w / 2, -h / 2, w, h); return; }
  if (fit === 'fit') { const k = Math.min(w / sw, h / sh) * Math.max(1, media.crop?.zoom ?? 1), dw = sw * k, dh = sh * k; ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh); return; }
  const crop = coverCrop(sw, sh, w / h, media.crop);
  ctx.drawImage(source, crop.fx, crop.fy, crop.fw, crop.fh, -w / 2, -h / 2, w, h);
}

// What the raster cache must notice: readiness and, for video, the frame.
export function shapeMediaState(media: MediaSource | undefined, useOriginals: boolean, id: string) {
  if (!media) return null;
  const source = shapeMediaSource(media, useOriginals, id);
  return source instanceof HTMLVideoElement ? source.currentTime : !!source;
}

const localTime = (layer: Layer, seconds: number) => Math.max(0, seconds - layer.start);
const videoLayers = (layers: Layer[]) => layers.flatMap(layer => {
  const media = layer.media ?? layer.shape?.media;
  return media?.url && media.kind === 'video' ? [{ layer, url: media.url, start: media.videoStart }] : [];
});

// Preview: play along while the timeline plays, park on the exact frame when
// paused, and release clips no layer uses anymore.
export function syncShapeVideos(layers: Layer[], seconds: number, playing: boolean, fps: number) {
  if (exporting) return;
  const used = new Set<string>();
  for (const { layer, url, start } of videoLayers(layers)) {
    const video = shapeVideo(url, layer.id);
    used.add(layer.id);
    const active = layer.visible && seconds >= layer.start && seconds < layer.end;
    syncReelVideo(video, active ? localTime(layer, seconds) : null, { fps, playing, videoEnd: 'loop' }, undefined, start);
  }
  for (const [id, video] of videos) if (!used.has(id)) { releaseVideo(video); videos.delete(id); }
}

export function releaseShapeVideos() {
  if (exporting) return;
  for (const video of videos.values()) releaseVideo(video);
  videos.clear();
}

export async function prepareShapeVideosForExport(layers: Layer[]) {
  exporting = true;
  await Promise.all(videoLayers(layers.filter(layer => layer.visible)).map(async ({ layer, url }) => { const video = shapeVideo(url, layer.id); await whenVideoReady(video).catch(() => {}); await prepareVideoForSequentialExport(video); }));
}

// Export: decode the exact frame for this instant before it is captured.
export async function seekShapeVideos(layers: Layer[], seconds: number, fps: number) {
  await Promise.all(videoLayers(layers).map(async ({ layer, url, start }) => {
    if (!layer.visible || seconds < layer.start || seconds >= layer.end) return;
    const video = shapeVideo(url, layer.id);
    const target = videoPlaybackTime(video.duration, localTime(layer, seconds), start, 'loop', fps);
    await advanceVideoForExport(video, target, fps);
  }));
}

export function endShapeVideoExport() { exporting = false; }

export async function prepareShapeMedia(media: MediaSource, useOriginals: boolean, label: string, id: string) {
  if (!media.url) throw new Error(`Mídia indisponível: ${label}. Reabra o projeto ou importe novamente.`);
  if (media.kind === 'video') { await whenVideoReady(shapeVideo(media.url, id)); return; }
  if (useOriginals) await originalImage(media.url).decode();
  else if (!await loadPreviewImage(media.url)) throw new Error(`Imagem indisponível: ${label}`);
}

export function releaseShapeOriginals() { originals.forEach((image) => { image.src = ''; }); originals.clear(); }
