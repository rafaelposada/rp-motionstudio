// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// The stage uses logical scene coordinates; this value only controls the
// backing-store density. Capping at 2 keeps Retina text and edges crisp without
// multiplying GPU memory again on uncommon 3× displays.
export type PreviewQuality = 'fast' | 'balanced' | 'high';
export function getPreviewQuality(): PreviewQuality {
  try { const saved = localStorage.getItem('motion-preview-quality'); return saved === 'fast' || saved === 'balanced' ? saved : 'high'; } catch { return 'high'; }
}
export function setPreviewQuality(quality: PreviewQuality) {
  localStorage.setItem('motion-preview-quality', quality);
  window.dispatchEvent(new Event('motion-preview-quality'));
}
// Optional: draw at 1× while the timeline plays and return to the chosen
// quality as soon as playback pauses. Pausing is where detail is inspected.
let playing = false;
export function getLightPlayback(): boolean {
  try { return localStorage.getItem('motion-preview-light-playback') !== 'off'; } catch { return true; }
}
export function setLightPlayback(on: boolean) {
  localStorage.setItem('motion-preview-light-playback', on ? 'on' : 'off');
  window.dispatchEvent(new Event('motion-preview-quality'));
}
export function setPreviewPlaying(value: boolean) {
  if (playing === value) return;
  playing = value;
  if (getLightPlayback() && getPreviewQuality() !== 'fast') window.dispatchEvent(new Event('motion-preview-quality'));
}
export const QUALITY_DENSITY: Record<PreviewQuality, number> = { fast: 1, balanced: 1.5, high: 2 };
export function previewResolution(): number {
  if (typeof window === 'undefined') return 1;
  if (playing && getLightPlayback()) return 1;
  const quality = getPreviewQuality();
  if (quality === 'fast') return 1;
  if (quality === 'balanced') return Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}
