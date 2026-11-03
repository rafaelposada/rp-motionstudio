// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Polygons and stars: vertices around a circle starting at the top, then
// stretched so the outline fills the layer box exactly. Handles hug the shape
// and width/height work as they do for rectangles.

export const SIDES = { min: 3, max: 24, polygon: 6 };
export const POINTS = { min: 3, max: 24, star: 5 };
export const INNER = { min: .1, max: .95, star: .38 };

type Pointed = { kind: string; sides?: number; points?: number; innerRadius?: number };

const clampInt = (v: number | undefined, min: number, max: number, fallback: number) => Math.round(Math.min(max, Math.max(min, Number.isFinite(v) ? v! : fallback)));

// Unit-circle vertices (y down), before fitting to the box.
function unitVertices(shape: Pointed): [number, number][] {
  const star = shape.kind === 'star';
  const n = star ? clampInt(shape.points, POINTS.min, POINTS.max, POINTS.star) : clampInt(shape.sides, SIDES.min, SIDES.max, SIDES.polygon);
  const inner = Math.min(INNER.max, Math.max(INNER.min, shape.innerRadius ?? INNER.star));
  const count = star ? n * 2 : n, out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const r = star && i % 2 ? inner : 1, a = -Math.PI / 2 + i * Math.PI * 2 / count;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

function unitBounds(points: [number, number][]) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// Height over width of the regular (unstretched) outline.
export function regularAspect(shape: Pointed) {
  const b = unitBounds(unitVertices(shape));
  return (b.maxY - b.minY) / (b.maxX - b.minX);
}

// Vertices in layer space, centered on the origin and filling w × h.
export function pointedVertices(shape: Pointed & { width: number; height: number }): [number, number][] {
  const points = unitVertices(shape), b = unitBounds(points), w = Math.abs(shape.width), h = Math.abs(shape.height);
  const sx = w / (b.maxX - b.minX), sy = h / (b.maxY - b.minY), cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  return points.map(([x, y]) => [(x - cx) * sx, (y - cy) * sy]);
}

// Changing sides, points or depth keeps the current stretch instead of
// squeezing the new outline into the old box.
export function reshapePointed<T extends Pointed & { width: number; height: number }>(shape: T, change: Partial<Pointed>): T {
  const next = { ...shape, ...change }, stretch = Math.abs(shape.height) / (Math.abs(shape.width) * regularAspect(shape));
  return { ...next, height: Math.max(1, Math.round(Math.abs(shape.width) * regularAspect(next) * stretch)) };
}
