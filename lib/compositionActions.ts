// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { compositionOrder } from './composition';
import { confirmLayer } from './confirmLayer';
import { useHistoryStore } from '@/store/useHistoryStore';
import { defaultsFor } from '@/templates';
import { DEFAULT_TRACK_TRANSFORM, trackWindow } from './tracks';

export function selectModelForEditing(id: string, additive = false, preserve = false, origin: 'canvas' | 'layers' | 'timeline' | 'inspector' = 'inspector') {
  const s = useSceneStore.getState(), track = s.tracks.find(t => t.id === id); if (!track) return;
  if (!additive && !preserve) s.setActiveTrack(id);
  else useSceneStore.setState({ activeTrackId: id, activeTemplateId: track.templateId, values: track.values, easing: track.easing });
  s.setPlaying(false); useUIStore.getState().selectLayer(id, 'motion', additive, preserve, origin);
  const window = trackWindow(track, Math.round(s.duration * s.fps));
  if (s.frame < window.inFrame || s.frame >= window.outFrame) s.setFrame(window.inFrame + Math.min(1, window.length - 1));
}

export function reorderCompositionLayer(id: string, overId: string, ids?: string[]) {
  const s = useSceneStore.getState(), order = compositionOrder(s.tracks, s.textLayers);
  const selection = ids ?? selectedCompositionIds(id);
  if (selection.length > 1) {
    if (selection.includes(overId)) return;
    const moved = order.filter(l => selection.includes(l.id)), rest = order.filter(l => !selection.includes(l.id));
    const target = rest.findIndex(l => l.id === overId); if (target < 0 || !moved.length) return;
    const forward = order.findIndex(l => l.id === id) < order.findIndex(l => l.id === overId);
    rest.splice(target + (forward ? 1 : 0), 0, ...moved);
    const z = new Map(rest.map((l, i) => [l.id, i]));
    useHistoryStore.getState().beginGesture();
    useSceneStore.setState({ tracks: s.tracks.map(l => ({ ...l, z: z.get(l.id) })), textLayers: s.textLayers.map(l => ({ ...l, z: z.get(l.id) })) });
    useHistoryStore.getState().endGesture(); return;
  }
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
export function selectOverlayForEditing(id: string, additive = false, preserve = false, origin: 'canvas' | 'layers' | 'timeline' | 'inspector' = 'inspector') {
  const s=useSceneStore.getState(),layer=s.textLayers.find(l=>l.id===id);if(!layer)return;
  useUIStore.getState().selectLayer(id, 'overlay', additive, preserve, origin);s.setPlaying(false);
  const time=s.frame/s.fps;
  if(time<layer.start||time>=layer.end)s.setFrame(Math.max(0,Math.floor(Math.min(layer.end-1/s.fps,layer.start+Math.min(.5,(layer.end-layer.start)/2))*s.fps)));
}
export function moveCompositionLayer(id: string, delta: number) {
  const s = useSceneStore.getState(), order = compositionOrder(s.tracks, s.textLayers);
  const index = order.findIndex((l) => l.id === id), target = index + delta;
  if (index < 0 || target < 0 || target >= order.length) return;
  reorderCompositionLayer(id, order[target].id);
}
export function arrangeCompositionLayers(ids: string[], destination: 'front' | 'back') {
  const s=useSceneStore.getState(), order=compositionOrder(s.tracks,s.textLayers);
  const locked=new Set(s.textLayers.filter(layer=>layer.locked).map(layer=>layer.id));
  const selected=new Set(ids.filter(id=>!locked.has(id)));
  const moved=order.filter(layer=>selected.has(layer.id)),rest=order.filter(layer=>!selected.has(layer.id));
  if(!moved.length)return;
  const next=destination==='front'?[...rest,...moved]:[...moved,...rest];
  if(next.every((layer,index)=>layer.id===order[index].id))return;
  const z=new Map(next.map((layer,index)=>[layer.id,index]));
  s.setPlaying(false);useHistoryStore.getState().beginGesture();
  useSceneStore.setState({tracks:s.tracks.map(layer=>({...layer,z:z.get(layer.id)})),textLayers:s.textLayers.map(layer=>({...layer,z:z.get(layer.id)}))});
  useHistoryStore.getState().endGesture();
}
export async function deleteCompositionLayer(id: string) {
  return deleteCompositionLayers(selectedCompositionIds(id));
}

export function selectedCompositionIds(id?: string): string[] {
  const ui = useUIStore.getState();
  return id && !ui.selectedLayerIds.includes(id) ? [id] : ui.selectedLayerIds.length ? ui.selectedLayerIds : id ? [id] : [];
}

export function duplicateCompositionLayers(ids: string[], offset = 24, record = true): string[] {
  const s = useSceneStore.getState(), ordered = compositionOrder(s.tracks, s.textLayers).filter(l => ids.includes(l.id));
  if (record) useHistoryStore.getState().beginGesture();
  const copies = ordered.map(l => duplicateCompositionLayer(l.id, offset, false)).filter((id): id is string => !!id);
  if (copies.length) {
    const last = copies.at(-1)!;
    useUIStore.getState().setLayerSelection(copies, last, useSceneStore.getState().tracks.some(t => t.id === last) ? 'motion' : 'overlay');
  }
  if (record) useHistoryStore.getState().endGesture();
  return copies;
}

export async function deleteCompositionLayers(ids: string[]) {
  const revision = sceneRestoreRevision(), s = useSceneStore.getState(), pt = useUIStore.getState().locale === 'pt';
  const removable = ids.filter(id => s.tracks.some(l => l.id === id) || s.textLayers.some(l => l.id === id && !l.locked));
  if (!removable.length) return;
  const removesLastModel = s.tracks.length > 0 && s.tracks.every(t => removable.includes(t.id));
  const message = removable.length === 1 && removesLastModel
    ? (pt ? 'Este é o último modelo. Ocultá-lo da composição? A camada base será mantida para novos modelos.' : 'This is the last model. Hide it from the composition? The base layer is kept for new models.')
    : (removable.length > 1 ? (pt ? `Excluir ${removable.length} camadas da composição?` : `Delete ${removable.length} composition layers?`) : (pt ? 'Excluir esta camada da composição?' : 'Delete this composition layer?'))
      + (removesLastModel ? (pt ? ' O último modelo será mantido oculto como base do editor.' : ' The last model is kept hidden as the editor base.') : '');
  if (!await confirmLayer(message, pt) || revision !== sceneRestoreRevision()) return;
  const current = useSceneStore.getState();
  let tracks = current.tracks.filter(l => !removable.includes(l.id));
  if (!tracks.length && current.tracks.length) tracks = [{ ...current.tracks[0], visible: false }];
  const active = tracks.find(t => t.id === current.activeTrackId) ?? tracks[0];
  useHistoryStore.getState().beginGesture();
  useSceneStore.setState({ tracks, textLayers: current.textLayers.filter(l => !removable.includes(l.id)), ...(active ? { activeTrackId: active.id, activeTemplateId: active.templateId, values: active.values, easing: active.easing } : {}) });
  useUIStore.getState().setLayerSelection([]);
  useHistoryStore.getState().endGesture();
}

export function layerDisplayName(name: string, pt: boolean) {
  return pt ? name.replace(/^Layer (\d+)/, 'Camada $1').replace(/ copy\b/g, ' cópia') : name;
}
