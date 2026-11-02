// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
export interface TransformPoint { x: number; y: number }
export interface TransformFrame { cx: number; cy: number; width: number; height: number; rotation: number }
export type ResizeAnchor = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type CornerRadii = [number, number, number, number];
export const RESIZE_ANCHORS: ResizeAnchor[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const ANCHOR_AXES: Record<ResizeAnchor, [number, number]> = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
  se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};
export function bounded(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}
export function normalizedAngle(degrees: number) { return ((degrees + 180) % 360 + 360) % 360 - 180; }
export function rotatePoint(point: TransformPoint, degrees: number): TransformPoint {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}
export function framePoint(frame: TransformFrame, x: number, y: number): TransformPoint {
  const p = rotatePoint({ x: x * frame.width / 2, y: y * frame.height / 2 }, frame.rotation);
  return { x: frame.cx + p.x, y: frame.cy + p.y };
}
export function frameAABB(frame: TransformFrame) {
  const a = frame.rotation * Math.PI / 180;
  const width = Math.abs(Math.cos(a)) * frame.width + Math.abs(Math.sin(a)) * frame.height;
  const height = Math.abs(Math.sin(a)) * frame.width + Math.abs(Math.cos(a)) * frame.height;
  return { x: frame.cx - width / 2, y: frame.cy - height / 2, width, height };
}
export interface ResizeOptions {
  proportional?: boolean; centered?: boolean;
  minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number;
}
export function resizeFrame(frame: TransformFrame, delta: TransformPoint, anchor: ResizeAnchor, options: ResizeOptions = {}): TransformFrame {
  const [sx, sy] = ANCHOR_AXES[anchor], p = rotatePoint(delta, -frame.rotation);
  const k = options.centered ? 2 : 1;
  const minW = options.minWidth ?? 4, minH = options.minHeight ?? 4;
  const maxW = options.maxWidth ?? 16000, maxH = options.maxHeight ?? 16000;
  let width = sx ? bounded(frame.width + sx * p.x * k, minW, maxW) : frame.width;
  let height = sy ? bounded(frame.height + sy * p.y * k, minH, maxH) : frame.height;
  if (options.proportional) {
    const fx = width / frame.width, fy = height / frame.height;
    let factor = !sx ? fy : !sy ? fx : Math.abs(fx - 1) >= Math.abs(fy - 1) ? fx : fy;
    factor = bounded(factor, Math.max(minW / frame.width, minH / frame.height), Math.min(maxW / frame.width, maxH / frame.height));
    width = frame.width * factor; height = frame.height * factor;
  }
  const shift = options.centered ? { x: 0, y: 0 } : rotatePoint({ x: sx * (width - frame.width) / 2, y: sy * (height - frame.height) / 2 }, frame.rotation);
  return { ...frame, cx: frame.cx + shift.x, cy: frame.cy + shift.y, width, height };
}
// Map a layer's origin as well as its visible rectangle, so rotated and
// left/right-aligned objects keep the opposite anchor fixed during scaling.
export function mapFramePoint(point: TransformPoint, before: TransformFrame, after: TransformFrame): TransformPoint {
  const local = rotatePoint({ x: point.x - before.cx, y: point.y - before.cy }, -before.rotation);
  const world = rotatePoint({ x: local.x * after.width / before.width, y: local.y * after.height / before.height }, after.rotation);
  return { x: after.cx + world.x, y: after.cy + world.y };
}
export function pointerRotation(frame: TransformFrame, from: TransformPoint, to: TransformPoint, initial: number, snap = false) {
  const a = Math.atan2(from.y - frame.cy, from.x - frame.cx);
  const b = Math.atan2(to.y - frame.cy, to.x - frame.cx);
  const value = initial + normalizedAngle((b - a) * 180 / Math.PI);
  return normalizedAngle(snap ? Math.round(value / 15) * 15 : value);
}
export function normalizedRadii(width: number, height: number, input?: readonly number[]): CornerRadii {
  const max = Math.max(0, Math.min(width, height) / 2);
  return [0, 1, 2, 3].map(i => bounded(input?.[i] ?? 0, 0, max)) as CornerRadii;
}
export function resizeCursor(anchor: ResizeAnchor, rotation: number) {
  const [x, y] = ANCHOR_AXES[anchor];
  const i = ((Math.round((Math.atan2(y, x) * 180 / Math.PI + rotation) / 45) % 4) + 4) % 4;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][i];
}
