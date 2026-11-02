// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
export interface AudioSettings { volume: number; fadeIn: number; fadeOut: number }
export const DEFAULT_AUDIO: AudioSettings = { volume: 1, fadeIn: 0, fadeOut: 0 };
const finite = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
export function audioSettings(value?: Partial<AudioSettings>): AudioSettings {
  return { volume: Math.max(0, Math.min(1, finite(value?.volume, 1))), fadeIn: Math.max(0, Math.min(60, finite(value?.fadeIn, 0))), fadeOut: Math.max(0, Math.min(60, finite(value?.fadeOut, 0))) };
}
export function audioGain(value: Partial<AudioSettings> | undefined, time: number, duration: number): number {
  const s = audioSettings(value), length = Math.max(0, duration);
  if (time < 0 || time >= length) return 0;
  const start = Math.min(s.fadeIn, length / 2), end = Math.min(s.fadeOut, length / 2);
  return s.volume * (start ? Math.min(1, time / start) : 1) * (end ? Math.min(1, (length - time) / end) : 1);
}
export function audioFilter(value: Partial<AudioSettings> | undefined, duration: number, sourceDuration = duration): string {
  const s = audioSettings(value), length = Math.min(duration, sourceDuration), start = Math.min(s.fadeIn, length / 2), end = Math.min(s.fadeOut, length / 2);
  const filters = [`volume=${s.volume}`];
  if (start > 0) filters.push(`afade=t=in:st=0:d=${start}`);
  if (end > 0) filters.push(`afade=t=out:st=${Math.max(0, length - end)}:d=${end}`);
  filters.push('apad', `atrim=duration=${duration}`);
  return filters.join(',');
}
