// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useSceneStore } from '@/store/useSceneStore';
import { requestFiniteVideoDuration } from '@/lib/videoTexture';
import { tx } from '@/lib/tx';
import { ControlRow } from './Controls';

export default function VideoStartControl({ url, value, onChange }: { url: string; value?: number; onChange: (seconds: number) => void }) {
  const pt = useUIStore(s => s.locale) === 'pt';
  const fps = useSceneStore(s => s.fps);
  const [metadata, setMetadata] = useState<{ url: string; duration?: number }>({ url: '' });
  useEffect(() => {
    if (!url) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    const update = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) { clearTimeout(timer); setMetadata({ url, duration: video.duration }); }
    };
    const fail = () => setMetadata({ url });
    const timer = setTimeout(fail, 12000);
    video.onloadedmetadata = () => { update(); requestFiniteVideoDuration(video); };
    video.ondurationchange = update;
    video.onerror = fail;
    video.src = url;
    return () => {
      clearTimeout(timer);
      video.onloadedmetadata = video.ondurationchange = video.onerror = null;
      video.removeAttribute('src'); video.load();
    };
  }, [url]);
  const duration = metadata.url === url ? metadata.duration : undefined;
  const label = tx(pt, 'Início do vídeo', 'Video start');
  if (!duration) return <p className="ctl-hint" role="status">{metadata.url === url
    ? tx(pt, 'Duração do vídeo indisponível.', 'Video duration unavailable.')
    : tx(pt, 'Lendo a duração do vídeo…', 'Reading video duration…')}</p>;

  const max = Math.max(0, Math.floor((duration - 1 / Math.max(1, fps)) * 100) / 100);
  if (max === 0) return <p className="ctl-hint">{label} 0 s</p>;
  return <ControlRow def={{ key: 'videoStart', label, type: 'slider', min: 0, max, step: .01, default: 0, unit: 's' }}
    value={Math.max(0, Math.min(max, value ?? 0))} onChange={v => {
      useSceneStore.getState().setPlaying(false);
      onChange(Number(v));
    }} />;
}
