// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
export interface AlignBox { x: number; y: number; width: number; height: number }
// lines: ruler guides, which only attract on their own axis.
export function snapAlignment(box: AlignBox, targets: AlignBox[], threshold: number, lines: { x: number[]; y: number[] } = { x: [], y: [] }) {
  const solve = (axis: 'x' | 'y', size: 'width' | 'height') => {
    let delta = 0, guide: number | null = null, best = threshold;
    const points = [box[axis], box[axis] + box[size] / 2, box[axis] + box[size]];
    const anchors = [...targets.flatMap((target) => [target[axis], target[axis] + target[size] / 2, target[axis] + target[size]]), ...lines[axis]];
    for (const anchor of anchors) for (const point of points) {
      const distance = Math.abs(anchor - point);
      if (distance < best) { best = distance; delta = anchor - point; guide = anchor; }
    }
    return { delta, guide };
  };
  const x = solve('x', 'width'), y = solve('y', 'height');
  return { dx: x.delta, dy: y.delta, x: x.guide, y: y.guide };
}
