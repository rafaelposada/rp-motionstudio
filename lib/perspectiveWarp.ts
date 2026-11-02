// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// 3D tilt with perspective for overlay layers, done on the 2D raster so both
// engines, the preview and the export get the same pixels. The flat layer is
// rotated around its anchor (layer x/y) and projected; a grid of triangles maps
// the source canvas onto the projected surface.
export interface Tilt { tiltX: number; tiltY: number; fov: number }
export const hasTilt = (t: Partial<Tilt>) => Math.abs(t.tiltX ?? 0) > .01 || Math.abs(t.tiltY ?? 0) > .01;

function triangle(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: number[], d: number[]) {
  const [x0, y0, x1, y1, x2, y2] = s, [u0, v0, u1, v1, u2, v2] = d;
  // Expand the clip by ~0.6 px from its centroid so neighbouring triangles overlap (no seams).
  const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3, grow = (u: number, v: number) => { const dx = u - cx, dy = v - cy, l = Math.hypot(dx, dy) || 1; return [u + dx / l * .6, v + dy / l * .6]; };
  const [a0, b0] = grow(u0, v0), [a1, b1] = grow(u1, v1), [a2, b2] = grow(u2, v2);
  ctx.save(); ctx.beginPath(); ctx.moveTo(a0, b0); ctx.lineTo(a1, b1); ctx.lineTo(a2, b2); ctx.closePath(); ctx.clip();
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(det) < 1e-9) { ctx.restore(); return; }
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det, b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det;
  const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det, e = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
  ctx.setTransform(a, b, c, e, u0 - a * x0 - c * y0, v0 - b * x0 - e * y0);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// Rotate (degrees) around the anchor and project with a pinhole camera whose
// field of view is `fov` across the composition height.
export function projector(anchorX: number, anchorY: number, height: number, tilt: Tilt) {
  const rx = tilt.tiltX * Math.PI / 180, ry = tilt.tiltY * Math.PI / 180, f = height / 2 / Math.tan(Math.max(10, Math.min(120, tilt.fov)) * Math.PI / 360);
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  return (x: number, y: number) => {
    const X = x - anchorX, Y = y - anchorY;
    // tiltY spins around the vertical axis, then tiltX around the horizontal one.
    const x1 = X * cy, z1 = -X * sy, y2 = Y * cx - z1 * sx, z2 = Y * sx + z1 * cx;
    const k = f / Math.max(f * .05, f + z2);
    return [anchorX + x1 * k, anchorY + y2 * k] as const;
  };
}

// Warp `src` (composition drawn at `scale` px per unit) into `dst` within `bounds` (composition units).
export function warpCanvas(src: HTMLCanvasElement, dst: HTMLCanvasElement, scale: number, bounds: { x: number; y: number; width: number; height: number }, project: (x: number, y: number) => readonly [number, number], cells = 18) {
  if (dst.width !== src.width) dst.width = src.width; if (dst.height !== src.height) dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, dst.width, dst.height);
  ctx.imageSmoothingQuality = 'high';
  const n = cells, pts: number[][][] = [];
  for (let j = 0; j <= n; j++) { const row: number[][] = []; for (let i = 0; i <= n; i++) { const x = bounds.x + bounds.width * i / n, y = bounds.y + bounds.height * j / n, [px, py] = project(x, y); row.push([x * scale, y * scale, px * scale, py * scale]); } pts.push(row); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p00 = pts[j][i], p10 = pts[j][i + 1], p01 = pts[j + 1][i], p11 = pts[j + 1][i + 1];
    triangle(ctx, src, [p00[0], p00[1], p10[0], p10[1], p11[0], p11[1]], [p00[2], p00[3], p10[2], p10[3], p11[2], p11[3]]);
    triangle(ctx, src, [p00[0], p00[1], p11[0], p11[1], p01[0], p01[1]], [p00[2], p00[3], p11[2], p11[3], p01[2], p01[3]]);
  }
  return dst;
}
