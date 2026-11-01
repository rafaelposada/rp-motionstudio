export function xyPadPoint(x: number, y: number, width: number, height: number, range: number) {
  const axis = (n: number, size: number) => size > 0 && Number.isFinite(n) ? Math.round((Math.max(0, Math.min(1, n / size)) * 2 - 1) * range) : 0;
  return { x: axis(x, width), y: axis(y, height) };
}
