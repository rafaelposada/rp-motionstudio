// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Registers PixiJS's advanced blend modes plus the one it lacks (hue), so the
// 2D renderer accepts every id in BLEND_MODES. Requires useBackBuffer: true.
// Registration runs once, at renderer start, not on import.
import * as PIXI from 'pixi.js';
import { blendMode } from './blendModes';

let registered: Promise<void> | null = null;
export function registerPixiBlendModes() {
  registered ??= (async () => {
    await import('pixi.js/advanced-blend-modes');
    const { BlendModeFilter, ExtensionType, extensions, hslgl, hslgpu } = PIXI;
    class HueBlend extends BlendModeFilter {
      static extension = { name: 'hue', type: ExtensionType.BlendMode };
      constructor() {
        super({
          gl: {
            functions: `
              ${hslgl}
              vec3 blendHue(vec3 base, vec3 blend, float opacity)
              {
                return setLuminosity(setSaturation(blend, getSaturation(base)), getLuminosity(base)) * opacity + base * (1.0 - opacity);
              }
            `,
            main: `
              finalColor = vec4(blendHue(back.rgb, front.rgb, front.a), blendedAlpha) * uBlend;
            `,
          },
          gpu: {
            functions: `
              ${hslgpu}
              fn blendHue(base: vec3<f32>, blend: vec3<f32>, opacity: f32) -> vec3<f32>
              {
                return setLuminosity(setSaturation(blend, getSaturation(base)), getLuminosity(base)) * opacity + base * (1.0 - opacity);
              }
            `,
            main: `
              out = vec4<f32>(blendHue(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
            `,
          },
        });
      }
    }
    extensions.add(HueBlend);
  })();
  return registered;
}

// 'hue' is registered above; Pixi's type union only lists its built-in names.
export const pixiBlend = (value: unknown) => blendMode(value) as PIXI.BLEND_MODES;
