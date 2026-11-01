'use client';
import { useEffect } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { audioGain } from './audioEnvelope';

export function useAudioPreview() {
  const url = useSceneStore((state) => state.audioUrl);
  useEffect(() => {
    if (!url) return;
    const audio = new Audio(url); audio.preload = 'auto';
    const sync = () => {
      const state = useSceneStore.getState();
      if (!state.playing) { audio.pause(); return; }
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const time = state.frame / state.fps;
      audio.volume = audioGain(state.audioSettings, time, Math.min(state.duration, audio.duration));
      if (time >= Math.min(state.duration, audio.duration)) { audio.pause(); return; }
      if (Math.abs(audio.currentTime - time) > 0.25) audio.currentTime = time;
      if (audio.paused) void audio.play().catch(() => { /* Press Play to permit audible playback in Safari. */ });
    };
    audio.addEventListener('canplay', sync);
    const unsubscribe = useSceneStore.subscribe(sync); sync();
    return () => { unsubscribe(); audio.removeEventListener('canplay', sync); audio.pause(); audio.removeAttribute('src'); audio.load(); };
  }, [url]);
}
