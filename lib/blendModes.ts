// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
import { tx } from './tx';
// Layer blend modes shared by motion tracks, text and absolute images. The ids
// are the CSS/PixiJS names; 'add' keeps its legacy id and is shown as
// "Plus lighter", as in Framer.
export const BLEND_GROUPS = [
  ['normal'],
  ['darken', 'multiply', 'color-burn'],
  ['lighten', 'screen', 'add', 'color-dodge'],
  ['overlay', 'soft-light', 'hard-light'],
  ['difference', 'exclusion'],
  ['hue', 'saturation', 'color', 'luminosity'],
] as const;
export type BlendMode = (typeof BLEND_GROUPS)[number][number];
export const BLEND_MODES = BLEND_GROUPS.flat() as BlendMode[];
export const isBlendMode = (value: unknown): value is BlendMode => BLEND_MODES.includes(value as BlendMode);
export const blendMode = (value: unknown): BlendMode => isBlendMode(value) ? value : 'normal';
export const blendIndex = (value: unknown) => BLEND_MODES.indexOf(blendMode(value));

const LABELS: Record<BlendMode, { en: string; pt: string }> = {
  normal: { en: 'Normal', pt: 'Normal' },
  darken: { en: 'Darken', pt: 'Escurecer' },
  multiply: { en: 'Multiply', pt: 'Multiplicação' },
  'color-burn': { en: 'Color burn', pt: 'Superexposição de cor' },
  lighten: { en: 'Lighten', pt: 'Clarear' },
  screen: { en: 'Screen', pt: 'Tela' },
  add: { en: 'Plus lighter', pt: 'Clarear mais' },
  'color-dodge': { en: 'Color dodge', pt: 'Subexposição de cor' },
  overlay: { en: 'Overlay', pt: 'Sobrepor' },
  'soft-light': { en: 'Soft light', pt: 'Luz suave' },
  'hard-light': { en: 'Hard light', pt: 'Luz direta' },
  difference: { en: 'Difference', pt: 'Diferença' },
  exclusion: { en: 'Exclusion', pt: 'Exclusão' },
  hue: { en: 'Hue', pt: 'Matiz' },
  saturation: { en: 'Saturation', pt: 'Saturação' },
  color: { en: 'Color', pt: 'Cor' },
  luminosity: { en: 'Luminosity', pt: 'Luminosidade' },
};
export const blendLabel = (mode: BlendMode, pt: boolean) => tx(pt, LABELS[mode].pt, LABELS[mode].en);

// GLSL for the 3D compositor. Inputs are straight (non-premultiplied) colors;
// the result is mixed over the backdrop by the layer's alpha. Formulas follow
// the W3C Compositing and Blending spec, in BLEND_MODES order.
export const BLEND_GLSL = `
float rpLum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 rpClipColor(vec3 c){
  float l = rpLum(c), n = min(c.r, min(c.g, c.b)), x = max(c.r, max(c.g, c.b));
  if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-5);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-5);
  return c;
}
vec3 rpSetLum(vec3 c, float l){ return rpClipColor(c + (l - rpLum(c))); }
float rpSat(vec3 c){ return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
vec3 rpSetSat(vec3 c, float s){
  float n = min(c.r, min(c.g, c.b)), x = max(c.r, max(c.g, c.b));
  return x > n ? (c - n) * s / (x - n) : vec3(0.0);
}
float rpDodge(float b, float s){ return b == 0.0 ? 0.0 : s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); }
float rpBurn(float b, float s){ return b >= 1.0 ? 1.0 : s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s); }
float rpSoft(float b, float s){
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return s <= 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b) : b + (2.0 * s - 1.0) * (d - b);
}
vec3 rpHard(vec3 b, vec3 s){ return mix(b * 2.0 * s, 1.0 - (1.0 - b) * (1.0 - (2.0 * s - 1.0)), step(0.5, s)); }
vec3 rpBlend(int m, vec3 b, vec3 s){
  if (m == 1) return min(b, s);
  if (m == 2) return b * s;
  if (m == 3) return vec3(rpBurn(b.r, s.r), rpBurn(b.g, s.g), rpBurn(b.b, s.b));
  if (m == 4) return max(b, s);
  if (m == 5) return 1.0 - (1.0 - b) * (1.0 - s);
  if (m == 6) return min(vec3(1.0), b + s);
  if (m == 7) return vec3(rpDodge(b.r, s.r), rpDodge(b.g, s.g), rpDodge(b.b, s.b));
  if (m == 8) return rpHard(s, b);
  if (m == 9) return vec3(rpSoft(b.r, s.r), rpSoft(b.g, s.g), rpSoft(b.b, s.b));
  if (m == 10) return rpHard(b, s);
  if (m == 11) return abs(b - s);
  if (m == 12) return b + s - 2.0 * b * s;
  if (m == 13) return rpSetLum(rpSetSat(s, rpSat(b)), rpLum(b));
  if (m == 14) return rpSetLum(rpSetSat(b, rpSat(s)), rpLum(b));
  if (m == 15) return rpSetLum(s, rpLum(b));
  if (m == 16) return rpSetLum(b, rpLum(s));
  return s;
}
`;
