// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { SpeakerIcon, TrashIcon } from './LaneIcons';
import { useRef } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { audioSettings } from '@/lib/audioEnvelope';
import { confirmLayer } from '@/lib/confirmLayer';
import { useWaveform } from '@/lib/waveform';
import { tx } from '@/lib/tx';

// The scene soundtrack as a timeline lane: it spans the whole composition,
// and its two edges set the fade in / fade out by dragging.
export default function AudioTrackLane({ duration }: { duration: number }) {
  const settings = useSceneStore((s) => s.audioSettings), pt = useUIStore((s) => s.locale) === 'pt';
  const audioUrl = useSceneStore((s) => s.audioUrl), peaks = useWaveform(audioUrl, duration);
  const axis = useRef<HTMLDivElement>(null), drag = useRef<{ edge: 'in' | 'out'; x: number; value: number } | null>(null);
  const s = audioSettings(settings), half = duration / 2;
  const patch = (change: Partial<typeof s>) => useSceneStore.setState((state) => ({ audioSettings: audioSettings({ ...state.audioSettings, ...change }) }));
  const begin = (edge: 'in' | 'out') => (e: React.PointerEvent) => {
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    useHistoryStore.getState().beginGesture();
    drag.current = { edge, x: e.clientX, value: edge === 'in' ? s.fadeIn : s.fadeOut };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !axis.current) return;
    const delta = (e.clientX - d.x) / axis.current.getBoundingClientRect().width * duration;
    const value = Math.round(Math.max(0, Math.min(half, d.value + (d.edge === 'in' ? delta : -delta))) * 100) / 100;
    patch(d.edge === 'in' ? { fadeIn: value } : { fadeOut: value });
  };
  const finish = () => { if (!drag.current) return; drag.current = null; useHistoryStore.getState().endGesture(); };
  const remove = async () => {
    if (!await confirmLayer(tx(pt, 'Remover o áudio da composição?', 'Remove the audio from the composition?'), pt)) return;
    useSceneStore.setState({ audioUrl: null, audioBlobId: undefined });
  };
  const fadeIn = Math.min(s.fadeIn, half) / duration * 100, fadeOut = Math.min(s.fadeOut, half) / duration * 100;
  const label = s.name ?? (tx(pt, 'Áudio', 'Audio'));
  return <div className={`tl-lane tl-audio-lane ${s.muted ? 'hidden' : ''}`}>
    <div className="tl-lane-gutter">
      <span className="tl-audio-icon" aria-hidden="true">♪</span>
      <button className="tl-lane-btn" title={s.muted ? (tx(pt, 'Ativar som', 'Unmute')) : (tx(pt, 'Silenciar', 'Mute'))} aria-pressed={!!s.muted} onClick={() => patch({ muted: !s.muted })}><SpeakerIcon muted={s.muted} /></button>
      <button className="tl-lane-btn danger" title={tx(pt, 'Remover áudio', 'Remove audio')} onClick={() => void remove()}><TrashIcon /></button>
    </div>
    <div className="tl-lane-bars"><div className="tl-zoom" ref={axis}>
      <div className="tl-bar tl-audio-bar" style={{ left: 0, width: '100%' }}
        onClick={() => window.dispatchEvent(new CustomEvent('rp-inspector-tab', { detail: 'media' }))} title={tx(pt, 'Arraste as bordas para o aparecimento e o desaparecimento graduais', 'Drag the edges to fade in and out')}>
        <span className="tl-bar-label"><b>♪ · {label.slice(0, 48)}</b>{(s.fadeIn > 0 || s.fadeOut > 0) && <small>{tx(pt, 'gradual', 'fade')} {s.fadeIn.toFixed(1)}s / {s.fadeOut.toFixed(1)}s</small>}</span>
        {peaks && <svg className="tl-waveform" viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none" aria-hidden="true"><path d={peaks.map((p, i) => `M${i + .5} ${50 - p * 46}V${50 + p * 46}`).join('')} /></svg>}
        <span className="tl-audio-fade in" style={{ width: `${fadeIn}%` }} />
        <span className="tl-audio-fade out" style={{ width: `${fadeOut}%` }} />
        <span className="tl-bar-edge in" style={{ left: `${fadeIn}%` }} onPointerDown={begin('in')} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
        <span className="tl-bar-edge out" style={{ right: `${fadeOut}%` }} onPointerDown={begin('out')} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
      </div>
    </div></div>
  </div>;
}
