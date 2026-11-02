// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import type { ReactNode } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { animatedLayer, keyAt, neighbourKey, removeKey, setKey, toggleKeying, type KeyProp } from '@/lib/keyframes';
import type { TextLayer } from '@/lib/textLayers';
import { tx } from '@/lib/tx';

// Stopwatch + previous/next key for one animatable property, drawn after its control.
export function KeyframeControls({ layer, prop, pt }: { layer: TextLayer; prop: KeyProp; pt: boolean }) {
  const list = layer.keyframes?.[prop], keyed = !!list?.length;
  // Only keyed properties follow the playhead; the rest read it on click.
  const frame = useSceneStore((s) => keyed ? s.frame : -1), fps = useSceneStore((s) => s.fps);
  const seconds = (keyed ? frame : useSceneStore.getState().frame) / fps, onKey = !!keyAt(list, seconds);
  const patch = useSceneStore.getState().patchTextLayer;
  const seek = (direction: 1 | -1) => { const t = neighbourKey(layer, seconds, direction, [prop]); if (t !== null) { const s = useSceneStore.getState(); s.setPlaying(false); s.setFrame(Math.round(t * s.fps)); } };
  const toggleKey = () => {
    if (!keyed) { patch(layer.id, toggleKeying(layer, prop, seconds)); return; }
    const now = (animatedLayer(layer, seconds) as unknown as Record<string, number>)[prop];
    const keyframes = { ...layer.keyframes, [prop]: onKey ? removeKey(list, seconds) : setKey(list, seconds, now) };
    if (!keyframes[prop]?.length) delete keyframes[prop];
    patch(layer.id, { keyframes });
  };
  return <span className={`keyframe-controls ${keyed ? 'keyed' : ''}`}>
    {keyed && <button type="button" className="kf-nav" aria-label={tx(pt, 'Keyframe anterior', 'Previous keyframe')} title={tx(pt, 'Keyframe anterior', 'Previous keyframe')} onClick={() => seek(-1)}>‹</button>}
    <button type="button" className={`kf-key ${onKey ? 'on' : ''}`} aria-pressed={onKey}
      title={!keyed ? tx(pt, 'Animar esta propriedade: cria o primeiro keyframe no tempo atual', 'Animate this property: adds the first keyframe at the playhead') : onKey ? tx(pt, 'Remover o keyframe deste tempo', 'Remove the keyframe at this time') : tx(pt, 'Adicionar keyframe neste tempo', 'Add a keyframe at this time')}
      aria-label={tx(pt, 'Keyframe', 'Keyframe')} onClick={toggleKey}>
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.2 10.8 6 6 10.8 1.2 6z" fill={onKey ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
    </button>
    {keyed && <button type="button" className="kf-nav" aria-label={tx(pt, 'Próximo keyframe', 'Next keyframe')} title={tx(pt, 'Próximo keyframe', 'Next keyframe')} onClick={() => seek(1)}>›</button>}
    {keyed && <button type="button" className="kf-off" title={tx(pt, 'Parar de animar: remove todos os keyframes desta propriedade', 'Stop animating: removes every keyframe of this property')} aria-label={tx(pt, 'Remover animação', 'Remove animation')} onClick={() => patch(layer.id, toggleKeying(layer, prop, seconds))}>×</button>}
  </span>;
}

// A control row with keyframe buttons in its label line.
export function KeyedRow({ layer, prop, pt, children }: { layer: TextLayer; prop: KeyProp; pt: boolean; children: ReactNode }) {
  return <div className="keyed-row">{children}<KeyframeControls layer={layer} prop={prop} pt={pt} /></div>;
}
