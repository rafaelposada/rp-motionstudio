'use client';
import { useEffect, useState } from 'react';
import { getRendererInstance } from '@/lib/rendererInstance';
import { recoverModel } from '@/lib/compositionActions';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { trackWindow } from '@/lib/tracks';

export default function ModelVisibilityNotice() {
  const pt = useUIStore(s => s.locale) === 'pt', [outside, setOutside] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const s = useSceneStore.getState(), track = s.tracks.find(t => t.id === s.activeTrackId);
      if (s.playing || !track?.visible || track.opacity <= 0) { setOutside(null); return; }
      const time = trackWindow(track, Math.round(s.duration * s.fps));
      if (s.frame < time.inFrame || s.frame >= time.outFrame) { setOutside(null); return; }
      const b = getRendererInstance()?.selectionBounds?.(track.id);
      const off = b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0 && (b.x + b.width < 0 || b.y + b.height < 0 || b.x > s.width || b.y > s.height);
      setOutside(off ? track.id : null);
    };
    window.addEventListener('motion-preview-rendered', update);
    return () => window.removeEventListener('motion-preview-rendered', update);
  }, []);
  if (!outside) return null;
  return <div className="model-visibility-notice" role="status"><span>{pt ? 'O modelo está fora da área visível neste quadro.' : 'The model is outside the visible canvas at this frame.'}</span><button className="btn" onClick={() => recoverModel(outside)}>{pt ? 'Recuperar enquadramento' : 'Restore framing'}</button></div>;
}
