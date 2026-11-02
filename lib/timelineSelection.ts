// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { useSceneStore } from '@/store/useSceneStore';
import { selectedCompositionIds } from './compositionActions';
import { trackWindow } from './tracks';

export interface TimelineWindow { id: string; kind: 'motion' | 'overlay'; start: number; end: number }
export function captureTimelineSelection(id: string): TimelineWindow[] {
  const s = useSceneStore.getState(), ids = selectedCompositionIds(id), windows: TimelineWindow[] = [];
  for (const id of ids) {
    const layer = s.textLayers.find(l => l.id === id);
    if (layer) { if (!layer.locked) windows.push({ id, kind: 'overlay', start: layer.start, end: layer.end }); continue; }
    const track = s.tracks.find(t => t.id === id); if (!track) continue;
    const window = trackWindow(track, Math.round(s.duration * s.fps));
    windows.push({ id, kind: 'motion', start: window.inFrame / s.fps, end: window.outFrame / s.fps });
  }
  return windows;
}
export function moveTimelineSelection(windows: TimelineWindow[], delta: number) {
  if (!windows.length) return;
  const s = useSceneStore.getState();
  const shift = Math.max(-Math.min(...windows.map(w => w.start)), Math.min(s.duration - Math.max(...windows.map(w => w.end)), delta));
  for (const w of windows) {
    if (w.kind === 'overlay') s.patchTextLayer(w.id, { start: w.start + shift, end: w.end + shift });
    else s.patchTrack(w.id, { inFrame: Math.round((w.start + shift) * s.fps), outFrame: Math.round((w.end + shift) * s.fps) });
  }
}
export function restoreTimelineSelection(windows: TimelineWindow[]) {
  const s = useSceneStore.getState();
  for (const w of windows) {
    if (w.kind === 'overlay') s.patchTextLayer(w.id, { start: w.start, end: w.end });
    else s.patchTrack(w.id, { inFrame: Math.round(w.start * s.fps), outFrame: Math.round(w.end * s.fps) });
  }
}
