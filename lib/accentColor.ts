// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// Interface-only colors. Never written into scene or export state.
export const DEFAULT_ACCENT = '#007aff';
export const ACCENT_PRESETS = [
  { color: '#007aff', pt: 'Azul', en: 'Blue' },
  { color: '#5856d6', pt: 'Índigo', en: 'Indigo' },
  { color: '#af52de', pt: 'Roxo', en: 'Purple' },
  { color: '#d63384', pt: 'Rosa', en: 'Pink' },
  { color: '#d95700', pt: 'Laranja', en: 'Orange' },
  { color: '#248a3d', pt: 'Verde', en: 'Green' },
  { color: '#00838f', pt: 'Petróleo', en: 'Teal' },
] as const;

export function sanitizeAccent(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_ACCENT;
}
function rgb(hex: string): number[] { return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)); }
function luminance(hex: string): number {
  const channels = rgb(hex).map((v) => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
export function contrastRatio(a: string, b: string): number {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}
function readableColor(color: string, backgrounds: string[], target: string): string {
  const source = rgb(color), end = rgb(target);
  for (let step = 0; step <= 100; step++) {
    const candidate = '#' + source.map((v, i) => Math.round(v + (end[i] - v) * step / 100).toString(16).padStart(2, '0')).join('');
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= 4.5)) return candidate;
  }
  return target;
}
export function accentTokens(value: unknown) {
  const color = sanitizeAccent(value);
  return {
    '--accent': color,
    // Filled actions keep a consistent white foreground. Darken the fill, not
    // the label, when a chosen accent is too light (minimum 4.5:1).
    '--accent-fill': readableColor(color, ['#ffffff'], '#000000'),
    '--accent-on': '#ffffff',
    '--accent-light-text': readableColor(color, ['#ffffff', '#f3f5f8', '#e8ebf0'], '#000000'),
    '--accent-dark-text': readableColor(color, ['#17181b', '#222428', '#2b2e33'], '#ffffff'),
  };
}
