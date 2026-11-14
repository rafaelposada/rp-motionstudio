// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// The export pipeline, shared by the Export dialog and the Claude bridge
// (MCP): capture every frame through the live renderer, encode with the
// bundled FFmpeg, then restore the composition exactly as it was.
import { useSceneStore, ASPECTS } from '@/store/useSceneStore';
import { getRendererInstance } from '@/lib/rendererInstance';
import { BASE_PATH } from '@/lib/paths';
import { previewResolution } from '@/lib/previewResolution';
import { prepareTextFonts, releaseOverlayOriginals } from '@/lib/textLayers';
import type { Keyframes } from '@/lib/keyframes';
import { useHistoryStore } from '@/store/useHistoryStore';

export type Fmt = 'mp4' | 'gif' | 'both' | 'mov';
export type Res = '1080p' | '2k' | '4k' | 'exact';
export type Phase = 'idle' | 'preparing' | 'capturing' | 'encoding' | 'done' | 'error';

// Presets are defined by the shortest edge (vertical 1080p = 1080×1920).
export const RES_SHORT: Record<Exclude<Res, 'exact'>, number> = { '1080p': 1080, '2k': 1440, '4k': 2160 };
export const RES_LABEL: Record<Exclude<Res, 'exact'>, string> = { '1080p': '1080p', '2k': '2K', '4k': '4K' };

// Target output size + capture scale for a given preset. Even dimensions
// are required by libx264 with yuv420p.
export function targetFor(res: Res, s: { width: number; height: number; customW: number; customH: number; aspect: string }) {
  if (res === 'exact' && s.aspect !== 'custom') res = '1080p'; // stale selection after aspect change
  let k: number;
  let tw: number, th: number;
  if (res === 'exact') {
    k = Math.max(s.customW, s.customH) / Math.max(s.width, s.height);
    tw = s.customW; th = s.customH;
  } else {
    k = RES_SHORT[res] / Math.min(s.width, s.height);
    tw = Math.round(s.width * k); th = Math.round(s.height * k);
    const aspect = ASPECTS[s.aspect];
    if (aspect) {
      const [aw, ah] = aspect;
      tw = aw <= ah ? RES_SHORT[res] : Math.round(RES_SHORT[res] * aw / ah);
      th = ah <= aw ? RES_SHORT[res] : Math.round(RES_SHORT[res] * ah / aw);
    }
  }
  return { k, width: tw - (tw % 2), height: th - (th % 2) };
}

export async function post(body: any) {
  const res = await fetch(`${BASE_PATH}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


export interface ExportProgress { phase: Phase; captured?: number; total?: number; sessionId?: string }
export interface ExportOptions { format: Fmt; res: Res; extraAspects?: string[]; onProgress?: (progress: ExportProgress) => void; isCancelled?: () => boolean }
export interface ExportResult { files: string[]; directory: string }

export async function runExport({ format, res, extraAspects = [], onProgress = () => {}, isCancelled = () => false }: ExportOptions): Promise<ExportResult> {
  const store = useSceneStore;
  const s = store.getState();
  const renderer = getRendererInstance();
  if (!renderer) throw new Error('Renderer not ready');
  const totalFrames = Math.max(1, Math.round(s.duration * s.fps));
  const wasPlaying = s.playing;
  let imagesPrepared = false;
  const restoreImages = () => { if (imagesPrepared) { imagesPrepared = false; renderer.endImageExport?.(); releaseOverlayOriginals(); } };
  s.setPlaying(false);
  try {
    onProgress({ phase: 'preparing', captured: 0, total: totalFrames });
    imagesPrepared = true;
    await prepareTextFonts(s.textLayers, true);
    await renderer.beginImageExport?.();
    await renderer.beginVideoExport?.();
    // One capture + encode pass at the current composition size.
    const exportPass = async (suffix: string) => {
      const passTarget = targetFor(res, store.getState());
      const { sessionId } = await post({ action: 'begin' });
      onProgress({ phase: 'capturing', captured: 0, total: totalFrames, sessionId });
      renderer.setCaptureScale(passTarget.k); renderer.setTransparentBackground?.(format === 'mov'); // hi-res backing store; layout untouched
      try {
        for (let f = 0; f < totalFrames; f++) {
          if (isCancelled()) {
            await post({ action: 'cancel', sessionId });
            throw new Error('Exportação cancelada. Os quadros temporários foram removidos.');
          }
          await renderer.seekVideos?.(f);                 // frame-accurate video cards (no-op without video)
          const dataUrl = renderer.captureFrame(f, format === 'mov' ? 'image/png' : 'image/jpeg');       // time = frame counter, never wall-clock
          await post({ action: 'frame', sessionId, index: f, dataUrl });
          onProgress({ phase: 'capturing', captured: f + 1, total: totalFrames, sessionId });
          // yield to keep UI responsive
          if (f % 5 === 0) await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        renderer.endVideoExport?.();                      // restore original video sources
        restoreImages();
        renderer.setTransparentBackground?.(false); renderer.setCaptureScale(previewResolution());
        renderer.resumeVideos?.();                        // back to live playback in the preview
      }
      onProgress({ phase: 'encoding', captured: totalFrames, total: totalFrames, sessionId });
      // audio bytes (blob url → base64) if present
      let audio: string | undefined;
      if (s.audioUrl) {
        const buf = await (await fetch(s.audioUrl)).arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        audio = btoa(binary);
      }
      return await post({ action: 'encode', sessionId, fps: s.fps, format, width: passTarget.width, height: passTarget.height, suffix, audio, audioSettings: s.audioSettings });
    };
    const first = await exportPass('');
    const files: string[] = [...first.files]; const directory = first.directory;
    // Extra formats: re-flow positions proportionally, export, then restore
    // the composition exactly as it was, without touching undo history.
    if (extraAspects.length) {
      const history = useHistoryStore.getState(); history.beginGesture();
      const before = store.getState(), snapshot = { aspect: before.aspect, customW: before.customW, customH: before.customH, textLayers: before.textLayers, tracks: before.tracks };
      try {
        for (const aspect of extraAspects) {
          if (isCancelled()) break;
          const from = store.getState();
          store.getState().setAspect(aspect);
          const to = store.getState(), kx = to.width / from.width, ky = to.height / from.height;
          const scaleKeys = (keys: Keyframes | undefined) => keys && Object.fromEntries(Object.entries(keys).map(([prop, list]) => [prop, prop === 'x' ? list!.map((k) => ({ ...k, v: k.v * kx })) : prop === 'y' ? list!.map((k) => ({ ...k, v: k.v * ky })) : list])) as Keyframes;
          store.setState({ textLayers: snapshot.textLayers.map((l) => ({ ...l, x: l.x * (to.width / before.width), y: l.y * (to.height / before.height), keyframes: scaleKeys(l.keyframes) })), tracks: snapshot.tracks.map((t) => ({ ...t, transform: { ...t.transform, x: t.transform.x * (to.width / before.width), y: t.transform.y * (to.height / before.height) } })) });
          await new Promise((r) => setTimeout(r, 900)); // let the preview re-layout at the new size
          const pass = await exportPass(aspect.replace(':', 'x'));
          files.push(...pass.files);
        }
      } finally {
        if (snapshot.aspect === 'custom') store.getState().setCustomDims(snapshot.customW, snapshot.customH); else store.getState().setAspect(snapshot.aspect);
        store.setState({ textLayers: snapshot.textLayers, tracks: snapshot.tracks });
        history.endGesture(true);
      }
    }
    onProgress({ phase: 'done', captured: totalFrames, total: totalFrames });
    s.setFrame(s.frame);
    return { files, directory: String(directory) };
  } finally {
    restoreImages();
    if (wasPlaying) s.setPlaying(true);
  }
}
