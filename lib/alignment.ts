export interface AlignBox { x: number; y: number; width: number; height: number }
export function snapAlignment(box: AlignBox, targets: AlignBox[], threshold: number) {
  const solve = (axis: 'x' | 'y', size: 'width' | 'height') => {
    let delta = 0, guide: number | null = null, best = threshold;
    const points = [box[axis], box[axis] + box[size] / 2, box[axis] + box[size]];
    for (const target of targets) for (const anchor of [target[axis], target[axis] + target[size] / 2, target[axis] + target[size]]) for (const point of points) {
      const distance = Math.abs(anchor - point);
      if (distance < best) { best = distance; delta = anchor - point; guide = anchor; }
    }
    return { delta, guide };
  };
  const x = solve('x', 'width'), y = solve('y', 'height');
  return { dx: x.delta, dy: y.delta, x: x.guide, y: y.guide };
}
