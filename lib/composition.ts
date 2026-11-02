// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import type { MotionTrack } from './tracks';
import type { TextLayer } from './textLayers';
export function compositionOrder(tracks: MotionTrack[], layers: TextLayer[]) {
  return [...tracks.map((layer, index) => ({ kind: 'motion' as const, id: layer.id, z: layer.z ?? index * 2 })),
    ...layers.map((layer, index) => ({ kind: 'overlay' as const, id: layer.id, z: layer.z ?? tracks.length * 2 + index }))]
    .sort((a, b) => a.z - b.z);
}
