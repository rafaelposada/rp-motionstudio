import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { compositionOrder } from './composition';
import { confirmLayer } from './confirmLayer';
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
  [order[index], order[target]] = [order[target], order[index]];
  const z = new Map(order.map((l, i) => [l.id, i]));
  useSceneStore.setState({ tracks: s.tracks.map((l) => ({ ...l, z: z.get(l.id) })), textLayers: s.textLayers.map((l) => ({ ...l, z: z.get(l.id) })) });
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
