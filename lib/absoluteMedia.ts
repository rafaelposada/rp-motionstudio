// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
import { sceneRestoreRevision, useSceneStore, type AssetItem } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { idbDelete, idbGet, idbPut } from './assetDb';
import { isVideoSource } from './videoTexture';
import { tx } from './tx';

export type MediaPoint = { x: number; y: number };

export function absoluteMediaDropPoint(clientX: number, clientY: number): MediaPoint | undefined {
  const stage = document.elementFromPoint(clientX, clientY)?.closest('.stage-wrap');
  const bounds = stage?.querySelector('canvas.stage-canvas')?.getBoundingClientRect();
  if (!bounds?.width || !bounds.height || clientX < bounds.left || clientY < bounds.top || clientX > bounds.right || clientY > bounds.bottom) return;
  const { width, height } = useSceneStore.getState();
  return { x: (clientX - bounds.left) * width / bounds.width, y: (clientY - bounds.top) * height / bounds.height };
}

export function absoluteMediaFileKind(file: File): 'image' | 'video' | undefined {
  if (file.type.startsWith('video/') || !file.type && isVideoSource(file.name)) return 'video';
  if (file.type.startsWith('image/') || !file.type && /\.(png|jpe?g|gif|avif|webp|svg|bmp|ico)$/i.test(file.name)) return 'image';
}

async function mediaSize(url: string, kind: 'image' | 'video'): Promise<MediaPoint> {
  if (kind === 'image') {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { x: image.naturalWidth, y: image.naturalHeight };
  }
  const video = document.createElement('video');
  video.preload = 'metadata';
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video metadata timeout')), 12000);
      video.onloadedmetadata = () => { clearTimeout(timeout); resolve(); };
      video.onerror = () => { clearTimeout(timeout); reject(new Error('Video load failed')); };
      video.src = url;
    });
    return { x: video.videoWidth, y: video.videoHeight };
  } finally {
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute('src');
    video.load();
  }
}

export async function addAbsoluteMedia(sources: (File | AssetItem)[], point?: MediaPoint): Promise<number> {
  const revision = sceneRestoreRevision();
  const pt = useUIStore.getState().locale === 'pt';
  const failed: string[] = [];
  const staged: { name: string; url: string; blobId: string; kind: 'image' | 'video'; videoStart?: number; size: MediaPoint }[] = [];
  const discard = async (url: string, id: string) => {
    URL.revokeObjectURL(url);
    await idbDelete(id).catch(() => {});
  };

  for (const source of sources) {
    if (sceneRestoreRevision() !== revision) break;
    const file = source instanceof File ? source : undefined;
    const asset = source instanceof File ? undefined : source;
    const kind = file ? absoluteMediaFileKind(file) : isVideoSource(asset!.url, asset!.kind) ? 'video' : 'image';
    if (!kind) { failed.push(source.name); continue; }
    const blobId = `overlay_${crypto.randomUUID()}`;
    let url: string | undefined;
    try {
      let blob: Blob | undefined = file ?? (asset?.origin === 'upload' ? await idbGet(asset.id) : undefined);
      if (!blob && asset?.url) {
        const response = await fetch(asset.url);
        if (!response.ok) throw new Error('Media download failed');
        blob = await response.blob();
      }
      if (!blob || kind === 'image' && blob.size > 50 * 1024 * 1024) throw new Error('Invalid image size');
      url = URL.createObjectURL(blob);
      const size = await mediaSize(url, kind);
      if (!size.x || !size.y || kind === 'image' && size.x * size.y > 60e6) throw new Error('Invalid media dimensions');
      await idbPut(blobId, blob);
      staged.push({ name: source.name, url, blobId, kind, size, videoStart: asset?.videoStart });
    } catch {
      if (url) await discard(url, blobId);
      failed.push(source.name);
    }
  }

  if (sceneRestoreRevision() !== revision) {
    await Promise.all(staged.map(item => discard(item.url, item.blobId)));
    return 0;
  }

  if (staged.length) {
    const scene = useSceneStore.getState(), history = useHistoryStore.getState();
    const { width, height } = scene;
    const at = point ?? { x: width / 2, y: height / 2 };
    history.beginGesture();
    try {
      scene.setPlaying(false);
      const ids = staged.map(({ name, size, url, blobId, kind, videoStart }) => {
        const scale = Math.min(1, width * .35 / size.x, height * .65 / size.y);
        return scene.addTextLayer({ text: name, x: at.x, y: at.y, media: { blobId, url, kind, videoStart, width: size.x * scale, height: size.y * scale, fit: 'contain' } });
      });
      const ui = useUIStore.getState();
      ui.setLayerSelection(ids, ids.at(-1));
      ui.setTimelineExpanded(true);
    } finally {
      history.endGesture();
    }
  }
  if (failed.length) throw new Error(`${tx(pt, 'Não foi possível adicionar', 'Could not add')} ${failed.join(', ')}.`);
  return staged.length;
}
