// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { compositionOrder, expandLayerGroups } from './composition';
import { confirmLayer } from './confirmLayer';
import { useHistoryStore } from '@/store/useHistoryStore';
import { defaultsFor } from '@/templates';
import { DEFAULT_TRACK_TRANSFORM, trackWindow } from './tracks';
import { tx, txf } from '@/lib/tx';
import type { MotionTrack } from './tracks';
import type { ActiveEffect } from '@/store/useSceneStore';

export function selectModelForEditing(id: string, additive = false, preserve = false, origin: 'canvas' | 'layers' | 'timeline' | 'inspector' = 'inspector') {
  const s = useSceneStore.getState(), track = s.tracks.find(t => t.id === id); if (!track) return;
  if (!additive && !preserve) s.setActiveTrack(id);
  else useSceneStore.setState({ activeTrackId: id, activeTemplateId: track.templateId, values: track.values, easing: track.easing });
  s.setPlaying(false); useUIStore.getState().selectLayer(id, 'motion', additive, preserve, origin);
  const window = trackWindow(track, Math.round(s.duration * s.fps));
  if (s.frame < window.inFrame || s.frame >= window.outFrame) s.setFrame(window.inFrame + Math.min(1, window.length - 1));
}

export function groupCompositionLayers(ids: string[], ungroup = false) {
  const { tracks, textLayers } = useSceneStore.getState();
  const layers = [...tracks, ...textLayers];
  const selected = new Set(expandLayerGroups(layers, ids));
  const members = layers.filter(layer => selected.has(layer.id));
  if (ungroup ? !members.some(layer => layer.groupId) : members.length < 2 || members.every(layer => layer.groupId && layer.groupId === members[0].groupId)) return;
  const groupId = ungroup ? undefined : crypto.randomUUID();
  const update = <T extends { id: string; groupId?: string }>(layer: T): T => selected.has(layer.id) ? { ...layer, groupId } : layer;
  const history = useHistoryStore.getState();
  history.beginGesture();
  useSceneStore.setState({ tracks: tracks.map(update), textLayers: textLayers.map(update) });
  history.endGesture();
}

export function reorderCompositionLayer(id: string, overId: string, ids?: string[]) {
  const s = useSceneStore.getState(), order = compositionOrder(s.tracks, s.textLayers);
  const selection = ids ?? selectedCompositionIds(id);
  if (expandLayerGroups([...s.tracks, ...s.textLayers], [overId]).some(target => selection.includes(target))) return;
  const targets = expandLayerGroups([...s.tracks, ...s.textLayers], [overId]);
  const forward = order.findIndex(l => l.id === id) < order.findIndex(l => l.id === overId);
  const boundary = (forward ? order.findLast(l => targets.includes(l.id)) : order.find(l => targets.includes(l.id)))?.id ?? overId;
  if (selection.length > 1) {
    if (selection.includes(overId)) return;
    const moved = order.filter(l => selection.includes(l.id)), rest = order.filter(l => !selection.includes(l.id));
    const target = rest.findIndex(l => l.id === boundary); if (target < 0 || !moved.length) return;
    rest.splice(target + (forward ? 1 : 0), 0, ...moved);
    const z = new Map(rest.map((l, i) => [l.id, i]));
    useHistoryStore.getState().beginGesture();
    useSceneStore.setState({ tracks: s.tracks.map(l => ({ ...l, z: z.get(l.id) })), textLayers: s.textLayers.map(l => ({ ...l, z: z.get(l.id) })) });
    useHistoryStore.getState().endGesture(); return;
  }
  const from = order.findIndex(l => l.id === id), to = order.findIndex(l => l.id === boundary);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = order.splice(from, 1); order.splice(to, 0, moved);
  const z = new Map(order.map((l, i) => [l.id, i]));
  useHistoryStore.getState().beginGesture();
  useSceneStore.setState({ tracks: s.tracks.map(l => ({ ...l, z: z.get(l.id) })), textLayers: s.textLayers.map(l => ({ ...l, z: z.get(l.id) })) });
  useHistoryStore.getState().endGesture();
}

export function duplicateCompositionLayer(id: string, offset = 24, record = true): string | null {
  return duplicateCompositionLayers([id], offset, record).at(-1) ?? null;
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
  const selection = selectedCompositionIds(id);
  const index = order.findIndex(layer => layer.id === id);
  if (index < 0 || !delta) return;
  for (let target = index + delta; target >= 0 && target < order.length; target += delta) {
    if (selection.includes(order[target].id)) continue;
    reorderCompositionLayer(id, order[target].id, selection);
    return;
  }
}
export function arrangeCompositionLayers(ids: string[], destination: 'front' | 'back') {
  const s=useSceneStore.getState(), order=compositionOrder(s.tracks,s.textLayers);
  const locked=new Set(s.textLayers.filter(layer=>layer.locked).map(layer=>layer.id));
  const selected=new Set(expandLayerGroups([...s.tracks, ...s.textLayers], ids).filter(id=>!locked.has(id)));
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
  const { tracks, textLayers } = useSceneStore.getState();
  return expandLayerGroups([...tracks, ...textLayers], id && !ui.selectedLayerIds.includes(id) ? [id] : ui.selectedLayerIds);
}

export function duplicateCompositionLayers(ids: string[], offset = 24, record = true): string[] {
  const scene = useSceneStore.getState(), layers = [...scene.tracks, ...scene.textLayers];
  const ui = useUIStore.getState();
  const selected = new Set(record ? expandLayerGroups(layers, ids) : ids);
  const order = compositionOrder(scene.tracks, scene.textLayers);
  const byId = new Map(layers.map(layer => [layer.id, layer]));
  const originals = order.flatMap(item => {
    const layer = byId.get(item.id)!;
    return selected.has(layer.id) && (!('locked' in layer && layer.locked) || layer.groupId) ? [layer] : [];
  });
  if (!originals.length) return [];

  const newIds = new Map(originals.map(layer => [layer.id, `copy_${crypto.randomUUID()}`]));
  const groupIds = new Map<string, string>(), effectIds = new Map<string, string>();
  const newGroup = (id: string | undefined) => {
    if (!id) return undefined;
    if (!groupIds.has(id)) groupIds.set(id, crypto.randomUUID());
    return groupIds.get(id);
  };
  const newEffects = (effects: ActiveEffect[] | undefined) => effects?.map(effect => {
    if (!effectIds.has(effect.instanceId)) effectIds.set(effect.instanceId, crypto.randomUUID());
    return { ...effect, instanceId: effectIds.get(effect.instanceId)! };
  });
  const copyIds = [...newIds.values()], orderedIds = order.map(item => item.id);
  const top = orderedIds.lastIndexOf(originals.at(-1)!.id);
  orderedIds.splice(top + 1, 0, ...copyIds);
  const stacking = new Map(orderedIds.map((id, z) => [id, z]));
  const tracks: MotionTrack[] = scene.tracks.map(track => ({ ...track, z: stacking.get(track.id) }));
  const textLayers = scene.textLayers.map(layer => ({ ...layer, z: stacking.get(layer.id) }));
  let model: MotionTrack | undefined;
  for (const original of originals) {
    const id = newIds.get(original.id)!;
    const layer = structuredClone(original);
    const groupId = newGroup(layer.groupId), effects = newEffects(layer.effects);
    const z = stacking.get(id);
    if ('templateId' in layer) {
      const transform = { ...layer.transform, x: layer.transform.x + offset, y: layer.transform.y + offset };
      const name = `${layer.name} ${tx(ui.locale === 'pt', 'cópia', 'copy')}`;
      model = { ...layer, id, z, name, groupId, effects, transform, visible: layer.groupId ? layer.visible : true };
      tracks.push(model);
    } else {
      const keyframes = layer.keyframes;
      if (keyframes && offset) {
        for (const axis of ['x', 'y'] as const) {
          const keys = keyframes[axis];
          if (keys) keyframes[axis] = keys.map(key => ({ ...key, v: key.v + offset }));
        }
      }
      const maskId = layer.maskId ? newIds.get(layer.maskId) ?? layer.maskId : undefined;
      textLayers.push({ ...layer, id, z, groupId, effects, maskId, x: layer.x + offset, y: layer.y + offset });
    }
  }
  const history = useHistoryStore.getState();
  if (record) history.beginGesture();
  useSceneStore.setState({
    tracks, textLayers, playing: false,
    ...(model ? { activeTrackId: model.id, activeTemplateId: model.templateId, values: model.values, easing: model.easing, compositeMode: 'stack' as const } : {}),
  });
  const primary = copyIds.at(-1)!;
  ui.setLayerSelection(copyIds, primary, tracks.some(track => track.id === primary) ? 'motion' : 'overlay');
  if (record) history.endGesture();
  return copyIds;
}

export async function deleteCompositionLayers(ids: string[]) {
  const revision = sceneRestoreRevision(), s = useSceneStore.getState(), pt = useUIStore.getState().locale === 'pt';
  const removable = expandLayerGroups([...s.tracks, ...s.textLayers], ids).filter(id => s.tracks.some(l => l.id === id) || s.textLayers.some(l => l.id === id && !l.locked));
  if (!removable.length) return;
  const removesLastModel = s.tracks.length > 0 && s.tracks.every(t => removable.includes(t.id));
  const message = removable.length === 1 && removesLastModel
    ? (tx(pt, 'Este é o último modelo. Ocultá-lo da composição? A camada base será mantida para novos modelos.', 'This is the last model. Hide it from the composition? The base layer is kept for new models.'))
    : (removable.length > 1 ? txf(pt, 'Excluir {n} camadas da composição?', 'Delete {n} composition layers?', { n: removable.length }) : (tx(pt, 'Excluir esta camada da composição?', 'Delete this composition layer?')))
      + (removesLastModel ? (tx(pt, ' O último modelo será mantido oculto como base do editor.', ' The last model is kept hidden as the editor base.')) : '');
  if (!await confirmLayer(message, pt) || revision !== sceneRestoreRevision()) return;
  const current = useSceneStore.getState();
  let tracks = current.tracks.filter(l => !removable.includes(l.id));
  if (!tracks.length && current.tracks.length) tracks = [{ ...current.tracks[0], visible: false, groupId: undefined }];
  const active = tracks.find(t => t.id === current.activeTrackId) ?? tracks[0];
  useHistoryStore.getState().beginGesture();
  useSceneStore.setState({ tracks, textLayers: current.textLayers.filter(l => !removable.includes(l.id)), ...(active ? { activeTrackId: active.id, activeTemplateId: active.templateId, values: active.values, easing: active.easing } : {}) });
  useUIStore.getState().setLayerSelection([]);
  useHistoryStore.getState().endGesture();
}

export function layerDisplayName(name: string, pt: boolean) {
  return pt ? name.replace(/^Layer (\d+)/, 'Camada $1').replace(/ copy\b/g, ' cópia') : name;
}
