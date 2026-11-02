// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Peak envelope of the soundtrack for the timeline lane, decoded once per file.
import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<{ peaks: Float32Array; seconds: number } | null>>();
function decode(url: string) {
  if (!cache.has(url)) cache.set(url, (async () => {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      const Ctx = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      const audio = await new Ctx(1, 1, 44100).decodeAudioData(data);
      const channel = audio.getChannelData(0), buckets = 1200, size = Math.max(1, Math.floor(channel.length / buckets)), peaks = new Float32Array(buckets);
      let max = 0;
      for (let b = 0; b < buckets; b++) { let peak = 0; for (let i = b * size, end = Math.min(channel.length, i + size); i < end; i += 4) { const v = Math.abs(channel[i]); if (v > peak) peak = v; } peaks[b] = peak; if (peak > max) max = peak; }
      if (max > 0) for (let b = 0; b < buckets; b++) peaks[b] /= max;
      return { peaks, seconds: audio.duration };
    } catch { return null; }
  })());
  return cache.get(url)!;
}

// Peaks laid out over the composition duration (silence after the file ends).
export function useWaveform(url: string | null, duration: number) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    let alive = true; setPeaks(null);
    if (url) void decode(url).then((result) => {
      if (!alive || !result) return;
      const n = 600, out: number[] = [];
      for (let i = 0; i < n; i++) { const t = (i + .5) / n * duration; out.push(t >= result.seconds ? 0 : result.peaks[Math.min(result.peaks.length - 1, Math.floor(t / result.seconds * result.peaks.length))]); }
      setPeaks(out);
    });
    return () => { alive = false; };
  }, [url, duration]);
  return peaks;
}
