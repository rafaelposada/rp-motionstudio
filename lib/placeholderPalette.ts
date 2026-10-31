// Walk through 193 neutral luminance values in a coprime stride. Adjacent
// starter cards stay visibly separated and larger scenes do not restart the
// same short palette after card 12. Values are shared by Pixi and Three.
const LUMINANCE_STEPS = 193;
const LUMINANCE_STRIDE = 73;

function placeholderLuminance(index: number): number {
  const safeIndex = ((Math.round(index) % LUMINANCE_STEPS) + LUMINANCE_STEPS) % LUMINANCE_STEPS;
  return 224 - ((safeIndex * LUMINANCE_STRIDE) % LUMINANCE_STEPS);
}

export function placeholderFill(index: number): number {
  const luminance = placeholderLuminance(index);
  return (luminance << 16) | (luminance << 8) | luminance;
}

export function placeholderLabel(index: number): number {
  return placeholderLuminance(index) >= 150 ? 0x171719 : 0xf4f4f2;
}

export function placeholderHex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
