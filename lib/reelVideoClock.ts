// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { resolveTrackTime, type MotionTrack } from './tracks';

interface VideoScene {
  fps: number; duration: number; playing: boolean; videoEnd: 'loop' | 'hold';
  assets: { id: string; url: string }[]; tracks: MotionTrack[];
  compositeMode: 'single' | 'stack'; activeTrackId: string;
}
// null means a timeline-local video is outside all of its scene windows.
// undefined preserves the existing wall-clock playback of ordinary projects.
export function reelVideoTime(scene: VideoScene, url: string, frame: number): number | null | undefined {
  const ids = scene.assets.filter((asset) => asset.url === url).map((asset) => asset.id);
  const tracks = scene.tracks.filter((track) => track.mediaClock === 'local' && track.assetIds.some((id) => ids.includes(id)));
  if (!tracks.length) return undefined;
  for (const track of tracks.toReversed()) {
    if (scene.compositeMode === 'single' && track.id !== scene.activeTrackId) continue;
    const time = resolveTrackTime(track, frame, Math.round(scene.duration * scene.fps));
    if (time.active) return time.localFrame / scene.fps;
  }
  return null;
}
export function syncReelVideo(video: HTMLVideoElement, seconds: number | null | undefined, scene: VideoScene, onDirty?: () => void) {
  if (seconds === undefined) return;
  if (seconds === null) { if (!video.paused) video.pause(); return; }
  if (!Number.isFinite(video.duration) || video.duration <= 0 || video.readyState < 2 || video.seeking) return;
  const target = scene.videoEnd === 'hold' ? Math.min(seconds, Math.max(0, video.duration - 0.034)) : seconds % video.duration;
  const tolerance = scene.playing ? 0.18 : 0.5 / scene.fps;
  if (Math.abs(video.currentTime - target) > tolerance) {
    video.addEventListener('seeked', () => onDirty?.(), { once: true });
    try { video.currentTime = target; } catch { /* decoder unavailable; retry next frame */ }
  }
  if (scene.playing && video.paused) void video.play().catch(() => {});
  if (!scene.playing && !video.paused) video.pause();
}
