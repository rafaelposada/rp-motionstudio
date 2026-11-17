// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
import { useSceneStore, type SceneState } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { compositionOrder } from './composition';
import { selectedCompositionIds } from './compositionActions';
import type { TextLayer } from './textLayers';
import type { MotionTrack } from './tracks';

export type CompositionLayer = MotionTrack | TextLayer;

function layerType(layer: CompositionLayer) {
  if ('templateId' in layer) return 'model';
  if (layer.media) return layer.media.kind ?? 'image';
  if (layer.shape) return layer.shape.kind;
  return layer.code ? 'code' : 'text';
}

export function compatibleLayers(scene: Pick<SceneState, 'tracks' | 'textLayers'>, ids: string[], primaryId?: string | null) {
  const layers = [...scene.tracks, ...scene.textLayers];
  const primary = primaryId ?? compositionOrder(scene.tracks, scene.textLayers).findLast(layer => ids.includes(layer.id))?.id;
  const reference = layers.find(layer => layer.id === primary);
  if (!reference || 'locked' in reference && reference.locked) return [];
  return [reference, ...layers.filter(layer => layer.id !== reference.id && ids.includes(layer.id)
    && layerType(layer) === layerType(reference) && !('locked' in layer && layer.locked))];
}

export function editSelectedOverlays(id: string, update: (layer: TextLayer, scene: SceneState) => Partial<TextLayer>) {
  const scene = useSceneStore.getState();
  const targets = compatibleLayers(scene, selectedCompositionIds(id), id).filter((layer): layer is TextLayer => 'text' in layer);
  for (const layer of targets) scene.patchTextLayer(layer.id, update(layer, scene));
}

export function editSelectedModels(id: string, update: (track: MotionTrack) => Partial<MotionTrack>, sameTemplate = false) {
  const scene = useSceneStore.getState(), model = scene.tracks.find(track => track.id === id);
  const targets = compatibleLayers(scene, selectedCompositionIds(id), id).filter((layer): layer is MotionTrack => 'templateId' in layer);
  for (const track of targets) {
    if (!sameTemplate || track.templateId === model?.templateId) scene.patchTrack(track.id, update(track));
  }
}

export function selectedEffectLayers(scene: Pick<SceneState, 'tracks' | 'textLayers'>, ids: string[], primaryId?: string | null) {
  return ids.length ? compatibleLayers(scene, ids, primaryId && ids.includes(primaryId) ? primaryId : undefined) : [];
}

export function editSelectedEffects(ids: string[], update: (effects: NonNullable<CompositionLayer['effects']>) => NonNullable<CompositionLayer['effects']>) {
  const selected = new Set(ids);
  const patch = <T extends CompositionLayer>(layer: T): T => {
    if (!selected.has(layer.id)) return layer;
    const effects = layer.effects ?? [];
    const next = update(effects);
    return next === effects ? layer : { ...layer, effects: next };
  };
  useSceneStore.setState(scene => ({ tracks: scene.tracks.map(patch), textLayers: scene.textLayers.map(patch) }));
}

export function activeEffectTargets() {
  const ui = useUIStore.getState();
  return selectedEffectLayers(useSceneStore.getState(), selectedCompositionIds(), ui.selectedMotionId ?? ui.selectedTextId);
}
