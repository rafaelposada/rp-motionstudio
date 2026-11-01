import { frameAABB, mapFramePoint, normalizedAngle, type TransformFrame } from './transformGeometry';

export function groupFrame(frames: TransformFrame[]): TransformFrame | null {
  if (!frames.length) return null;
  const boxes = frames.map(frameAABB), x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  const right = Math.max(...boxes.map(b => b.x + b.width)), bottom = Math.max(...boxes.map(b => b.y + b.height));
  return { cx: (x + right) / 2, cy: (y + bottom) / 2, width: right - x, height: bottom - y, rotation: 0 };
}

// Group scaling is uniform: rotated members and motion models keep their aspect.
export function transformGroupMember(member: TransformFrame, from: TransformFrame, to: TransformFrame): TransformFrame {
  const point = mapFramePoint({ x: member.cx, y: member.cy }, from, to), scale = to.width / from.width;
  return { cx: point.x, cy: point.y, width: member.width * scale, height: member.height * scale, rotation: normalizedAngle(member.rotation + to.rotation - from.rotation) };
}
