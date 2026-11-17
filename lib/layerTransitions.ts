// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
export type LayerAnimation = 'none'|'fade'|'rise'|'drop'|'slideLeft'|'slideRight'|'zoomIn'|'zoomOut'|'pop'|'rotate'|'typewriter';
export type ModelTransition = Exclude<LayerAnimation, 'typewriter'>;

const REST = { x: 0, y: 0, scale: 1, rotation: 0 };

function transitionPose(mode: LayerAnimation, p: number) {
  const remaining = (1 - p) ** 3;
  switch (mode) {
    case 'slideLeft': return { ...REST, x: 64 * remaining };
    case 'slideRight': return { ...REST, x: -64 * remaining };
    case 'rise': return { ...REST, y: 30 * remaining };
    case 'drop': return { ...REST, y: -48 * remaining };
    case 'zoomIn': return { ...REST, scale: 1 - .35 * remaining };
    case 'zoomOut': return { ...REST, scale: 1 + .35 * remaining };
    case 'pop': return { ...REST, scale: 1 - 2 ** (-8 * p) * Math.cos(p * Math.PI * 3) * .45 * (1 - p) };
    case 'rotate': return { ...REST, rotation: -18 * remaining };
    default: return REST;
  }
}

export function layerTransitionMotion(entrance: LayerAnimation, exit: LayerAnimation, progress: number, fadeOut: number) {
  const incoming = transitionPose(entrance, progress), outgoing = transitionPose(exit, fadeOut);
  return {
    opacity: (entrance !== 'none' ? progress : 1) * (exit !== 'none' ? fadeOut : 1),
    x: incoming.x - outgoing.x, y: incoming.y - outgoing.y,
    scale: incoming.scale * outgoing.scale, rotation: incoming.rotation - outgoing.rotation,
  };
}
