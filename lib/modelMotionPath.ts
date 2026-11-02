// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import type { MotionTrack } from './tracks';
export interface MotionPath { enabled: boolean; duration: number; loop: boolean; points: { x: number; y: number }[] }
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function readMotionPath(value: unknown): MotionPath {
  const raw = value as Partial<MotionPath> | null;
  const points = Array.isArray(raw?.points) ? raw.points.slice(0, 9).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ x: clamp(p.x, -.25, .25), y: clamp(p.y, -.25, .25) })) : [];
  return { enabled: raw?.enabled === true, duration: Number.isFinite(raw?.duration) ? clamp(raw!.duration!, .1, 60) : 4, loop: raw?.loop === true, points: points.length >= 2 ? points : [{ x: 0, y: 0 }, { x: .18, y: -.12 }] };
}
export function modelPathOffset(track: MotionTrack, frame: number, fps: number, width: number, height: number) {
  const path = readMotionPath(track.values._motionPath);
  if (!path.enabled) return { x: 0, y: 0 };
  const points = path.loop ? [...path.points, path.points[0]] : path.points;
  const time = Math.max(0, (frame - track.inFrame) / Math.max(1, fps)) / path.duration;
  const progress = path.loop ? time % 1 : Math.min(1, time), phase = progress * (points.length - 1), i = Math.min(points.length - 2, Math.floor(phase));
  const t = phase - i, smooth = t * t * (3 - 2 * t), a = points[i], b = points[i + 1];
  return { x: (a.x + (b.x - a.x) * smooth) * width, y: (a.y + (b.y - a.y) * smooth) * height };
}
