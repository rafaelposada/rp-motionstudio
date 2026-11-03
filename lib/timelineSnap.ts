// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Timeline magnet: bar edges and the playhead land on markers (and bars on
// the playhead) when they pass within a few pixels. Alt drags freely.
import { useSceneStore } from '@/store/useSceneStore';

export const SNAP_PX = 7;

// Snap points in seconds: every marker, plus the playhead unless excluded.
export function snapTargets(playhead = true): number[] {
  const s = useSceneStore.getState();
  return [...s.markers.map((m) => m.t), ...(playhead ? [s.frame / s.fps] : [])];
}

// Offset (seconds) that brings the closest of `edges` onto a target, or 0
// when none is within SNAP_PX. `secondsPerPx` converts the pixel threshold.
export function magnetOffset(edges: number[], secondsPerPx: number, targets = snapTargets()): number {
  const reach = SNAP_PX * secondsPerPx;
  let best = 0, distance = Infinity;
  for (const edge of edges) for (const target of targets) {
    const d = target - edge;
    if (Math.abs(d) <= reach && Math.abs(d) < distance) { best = d; distance = Math.abs(d); }
  }
  return best;
}
