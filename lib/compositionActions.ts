import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { compositionOrder } from './composition';
import { confirmLayer } from './confirmLayer';
import { useHistoryStore } from '@/store/useHistoryStore';
import { defaultsFor } from '@/templates';
import { DEFAULT_TRACK_TRANSFORM, trackWindow } from './tracks';

export function selectModelForEditing(id: string) {
  const s = useSceneStore.getState(), track = s.tracks.find(t => t.id === id); if (!track) return;
  s.setActiveTrack(id); s.setPlaying(false); useUIStore.getState().selectMotion(id);
  const window = trackWindow(track, Math.round(s.duration * s.fps));
  if (s.frame < window.inFrame || s.frame >= window.outFrame) s.setFrame(window.inFrame + Math.min(1, window.length - 1));
}

export function reorderCompositionLayer(id: string, overId: string) {
  const s = useSceneStore.getState(), order = compositionOrder(s.tracks, s.textLayers);
  const from = order.findIndex(l => l.id === id), to = order.findIndex(l => l.id === overId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = order.splice(from, 1); order.splice(to, 0, moved);
  const z = new Map(order.map((l, i) => [l.id, i]));
  useHistoryStore.getState().beginGesture();
  useSceneStore.setState({ tracks: s.tracks.map(l => ({ ...l, z: z.get(l.id) })), textLayers: s.textLayers.map(l => ({ ...l, z: z.get(l.id) })) });
  useHistoryStore.getState().endGesture();
}

export function duplicateCompositionLayer(id: string, offset = 24, record = true): string | null {
  const s = useSceneStore.getState(), overlay = s.textLayers.find(l => l.id === id), track = s.tracks.find(l => l.id === id);
  if (!overlay && !track || overlay?.locked) return null;
  const copyId = `copy_${crypto.randomUUID()}`, pt = useUIStore.getState().locale === 'pt';
  const order = compositionOrder(s.tracks, s.textLayers), index = order.findIndex(l => l.id === id);
  order.splice(index + 1, 0, { id: copyId, kind: overlay ? 'overlay' : 'motion', z: 0 });
  const z = new Map(order.map((l, i) => [l.id, i]));
  if (record) useHistoryStore.getState().beginGesture();
  if (overlay) {
    const copy = { ...structuredClone(overlay), id: copyId, x: overlay.x + offset, y: overlay.y + offset, z: z.get(copyId) };
    useSceneStore.setState({ tracks: s.tracks.map(l => ({ ...l, z: z.get(l.id) })), textLayers: [...s.textLayers.map(l => ({ ...l, z: z.get(l.id) })), copy] });
    useUIStore.getState().selectText(copyId);
  } else {
    const copy = { ...structuredClone(track!), id: copyId, name: `${track!.name} ${pt ? 'cópia' : 'copy'}`, visible: true, transform: { ...track!.transform, x: track!.transform.x + offset, y: track!.transform.y + offset }, z: z.get(copyId) };
    useSceneStore.setState({ tracks: [...s.tracks.map(l => ({ ...l, z: z.get(l.id) })), copy], activeTrackId: copyId, activeTemplateId: copy.templateId, values: copy.values, easing: copy.easing, compositeMode: 'stack' });
    useUIStore.getState().selectMotion(copyId);
  }
  s.setPlaying(false);
  if (record) useHistoryStore.getState().endGesture();
  return copyId;
}

export function recoverModel(id: string) {
  const s = useSceneStore.getState(), track = s.tracks.find(t => t.id === id); if (!track) return;
  const defaults = defaultsFor(track.templateId);
  useHistoryStore.getState().beginGesture();
  s.patchTrack(id, { visible: true, opacity: 1, fade: 0, transform: { ...DEFAULT_TRACK_TRANSFORM }, values: { ...track.values, _motionPath: undefined, ...(defaults.offset ? { offset: structuredClone(defaults.offset) } : {}), count: Math.max(1, Number(track.values.count) || Number(defaults.count) || 1) } });
  selectModelForEditing(id); useHistoryStore.getState().endGesture();
}
export function selectOverlayForEditing(id: string) {
  const s=useSceneStore.getState(),layer=s.textLayers.find(l=>l.id===id);if(!layer)return;
  useUIStore.getState().selectText(id);s.setPlaying(false);
  const time=s.frame/s.fps;
  if(time<layer.start||time>=layer.end)s.setFrame(Math.max(0,Math.floor(Math.min(layer.end-1/s.fps,layer.start+Math.min(.5,(layer.end-layer.start)/2))*s.fps)));
}
export function moveCompositionLayer(id: string, delta: number) {
  const s = useSceneStore.getState(), order = compositionOrder(s.tracks, s.textLayers);
  const index = order.findIndex((l) => l.id === id), target = index + delta;
  if (index < 0 || target < 0 || target >= order.length) return;
  reorderCompositionLayer(id, order[target].id);
}
export async function deleteCompositionLayer(id: string) {
  const s = useSceneStore.getState(), pt = useUIStore.getState().locale === 'pt';
  const overlay = s.textLayers.find((l) => l.id === id);
  if (overlay?.locked) return;
  const lastModel = !overlay && s.tracks.length === 1;
  const message = lastModel ? (pt ? 'Este é o último modelo. Ocultá-lo da composição?' : 'This is the last model. Hide it from the composition?') : (pt ? 'Excluir esta camada da composição?' : 'Delete this composition layer?');
  if (!await confirmLayer(message, pt)) return;
  if (overlay) s.removeTextLayer(id);
  else if (lastModel) s.patchTrack(id, { visible: false });
  else s.removeTrack(id);
  useUIStore.getState().selectText(null);
}
