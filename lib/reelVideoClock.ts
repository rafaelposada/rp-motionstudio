// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { resolveTrackTime, trackWindow, type MotionTrack } from './tracks';
import { videoPlaybackTime } from './videoTexture';

interface VideoScene {
  fps: number; duration: number; playing: boolean; videoEnd: 'loop' | 'hold';
  assets: { id: string; url: string; videoStart?: number }[]; tracks: MotionTrack[];
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
export function cardVideoClock(scene: VideoScene, url: string, frame: number) {
  const asset = scene.assets.find(asset => asset.url === url), start = asset?.videoStart;
  const local = reelVideoTime(scene, url, frame);
  if (local !== undefined || start === undefined) return { elapsed: local, start };
  const total = Math.round(scene.duration * scene.fps);
  for (const track of scene.tracks.toReversed()) {
    if (!track.visible || scene.compositeMode === 'single' && track.id !== scene.activeTrackId) continue;
    if (track.assetIds.length && !track.assetIds.includes(asset!.id)) continue;
    const window = trackWindow(track, total);
    if (frame >= window.inFrame && frame < window.outFrame) return { elapsed: (frame - window.inFrame) / scene.fps, start };
  }
  return { elapsed: null, start };
}

const videoClock = new WeakMap<HTMLVideoElement, { target: number; start: number }>();

export function syncReelVideo(video: HTMLVideoElement, seconds: number | null | undefined, scene: Pick<VideoScene, 'fps' | 'playing' | 'videoEnd'>, onDirty?: () => void, start = 0) {
  if (seconds === undefined) { videoClock.delete(video); return; }
  if (seconds === null) { videoClock.delete(video); if (!video.paused) video.pause(); return; }
  if (!Number.isFinite(video.duration) || video.duration <= 0 || video.readyState < 2 || video.seeking) return;
  const target = videoPlaybackTime(video.duration, seconds, start, scene.videoEnd, scene.fps);
  const previous = videoClock.get(video);
  const discontinuity = !previous || previous.start !== start || target < previous.target || target - previous.target > .2;
  const tolerance = scene.playing && !discontinuity ? .18 : .5 / Math.max(1, scene.fps);
  videoClock.set(video, { target, start });
  if (Math.abs(video.currentTime - target) > tolerance) {
    video.addEventListener('seeked', () => onDirty?.(), { once: true });
    try { video.currentTime = target; } catch { /* decoder unavailable; retry next frame */ }
  }
  const holding = scene.videoEnd === 'hold' && target >= video.duration - 1 / Math.max(1, scene.fps);
  if (scene.playing && !holding && video.paused) void video.play().catch(() => {});
  if ((!scene.playing || holding) && !video.paused) video.pause();
}
