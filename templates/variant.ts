// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import type { Template } from '@/lib/types';
import type { EasingSpec } from '@/lib/easing';

// A variant is the same template (controls + transform) shipped with different
// declared defaults — mirroring the reference tool's "Wheel 01…06" presets.
// Full-reset-on-switch then produces the preset look for free.
export function variant(
  base: Template,
  id: string,
  name: string,
  patch: Record<string, any> = {},
  easing?: EasingSpec,
  meta?: Partial<Template['meta']>,
): Template {
  return {
    meta: { ...base.meta, id, name, ...(easing ? { defaultEasing: easing } : {}), ...meta },
    controls: base.controls.map((c) =>
      patch[c.key] !== undefined ? { ...c, default: patch[c.key] } : c
    ),
    transform: base.transform,
    slotAspect: base.slotAspect,
    layerCount: base.layerCount,
    // `transform3d` has to come along too. `meta` is spread wholesale, so a
    // variant of a webgl template inherits engine: 'webgl' — but without the 3D
    // pose the renderer silently falls back to projecting the 2D transform, and
    // the variant renders flat while its base renders in 3D. That is what was
    // happening to Orbit 3D 02 and 03.
    transform3d: base.transform3d,
    camera: base.camera,
  };
}
