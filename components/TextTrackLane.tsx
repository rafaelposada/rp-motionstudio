'use client';
import { useRef } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import type { TextLayer } from '@/lib/textLayers';
import { deleteCompositionLayer, selectOverlayForEditing } from '@/lib/compositionActions';
export default function TextTrackLane({ layer, duration }: { layer: TextLayer; duration: number }) {
  const patch = useSceneStore((s) => s.patchTextLayer); const remove = deleteCompositionLayer;
  const fps = useSceneStore((s) => s.fps); const axis = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; start: number; end: number; mode: 'move' | 'start' | 'end' } | null>(null);
  const begin = (mode: 'move' | 'start' | 'end') => (e: React.PointerEvent) => { e.stopPropagation(); selectOverlayForEditing(layer.id); if (layer.locked) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode, x: e.clientX, start: layer.start, end: layer.end }; };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !axis.current) return;
    const delta = (e.clientX - d.x) / axis.current.getBoundingClientRect().width * duration;
    const snap = (n: number) => Math.round(n * (e.shiftKey ? 1 : fps)) / (e.shiftKey ? 1 : fps);
    if (d.mode === 'move') { const start = Math.max(0, Math.min(duration - (d.end - d.start), snap(d.start + delta))); patch(layer.id, { start, end: start + d.end - d.start }); }
    else if (d.mode === 'start') patch(layer.id, { start: Math.max(0, Math.min(d.end - 1 / fps, snap(d.start + delta))) });
    else patch(layer.id, { end: Math.min(duration, Math.max(d.start + 1 / fps, snap(d.end + delta))) });
  };
  return <div className={`tl-lane ${layer.visible ? '' : 'hidden'}`}><div className="tl-lane-gutter">
    <button className="tl-lane-btn" title="Mostrar/ocultar texto" onClick={() => patch(layer.id, { visible: !layer.visible })}>{layer.visible ? '◉' : '○'}</button>
    <button className="tl-lane-btn" title="Bloquear/desbloquear tempo do texto" onClick={() => patch(layer.id, { locked: !layer.locked })}>{layer.locked ? '▣' : '□'}</button>
    <button className="tl-lane-btn danger" title="Remover texto" disabled={layer.locked} onClick={() => remove(layer.id)}>×</button>
  </div><div className="tl-lane-bars" ref={axis}><div className="tl-bar tl-text-bar" style={{ left: `${Math.max(0, layer.start) / duration * 100}%`, width: `${Math.max(0, Math.min(duration, layer.end) - layer.start) / duration * 100}%` }} onPointerDown={begin('move')} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <span className="tl-bar-label"><b>{layer.media ? '▧' : 'T'} · {layer.text.slice(0, 40)}</b></span>
    <span className="tl-bar-edge in" onPointerDown={begin('start')} onPointerMove={move} onPointerUp={() => { drag.current = null; }} />
    <span className="tl-bar-edge out" onPointerDown={begin('end')} onPointerMove={move} onPointerUp={() => { drag.current = null; }} />
  </div></div></div>;
}
