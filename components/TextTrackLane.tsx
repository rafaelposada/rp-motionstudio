'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { LayerDragHandle, timelineLayerDragProps } from './LayerDropTarget';
import type { TextLayer } from '@/lib/textLayers';
import { deleteCompositionLayer, selectOverlayForEditing } from '@/lib/compositionActions';
import { useHistoryStore } from '@/store/useHistoryStore';
import { captureTimelineSelection, moveTimelineSelection, restoreTimelineSelection, type TimelineWindow } from '@/lib/timelineSelection';
export default function TextTrackLane({ layer, duration, leadingControl }: { layer: TextLayer; duration: number; leadingControl?:ReactNode }) {
  const selectedIds = useUIStore(s => s.selectedLayerIds), pt = useUIStore(s => s.locale) === 'pt';
  const patch = useSceneStore((s) => s.patchTextLayer); const remove = deleteCompositionLayer;
  const fps = useSceneStore((s) => s.fps); const axis = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; start: number; end: number; mode: 'move' | 'start' | 'end'; windows: TimelineWindow[] } | null>(null);
  useEffect(() => {
    const finish = () => { if (drag.current) { drag.current = null; useHistoryStore.getState().endGesture(); } };
    window.addEventListener('blur', finish); return () => { window.removeEventListener('blur', finish); finish(); };
  }, []);
  const begin = (mode: 'move' | 'start' | 'end') => (e: React.PointerEvent) => { e.stopPropagation(); selectOverlayForEditing(layer.id, e.shiftKey, !e.shiftKey, 'timeline'); if (e.shiftKey || layer.locked) return; useHistoryStore.getState().beginGesture(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode, x: e.clientX, start: layer.start, end: layer.end, windows: captureTimelineSelection(layer.id) }; };
  const finish = (cancel = false) => { const d = drag.current; if (!d) return; drag.current = null; if (cancel) restoreTimelineSelection(d.windows); useHistoryStore.getState().endGesture(cancel); };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !axis.current) return;
    const delta = (e.clientX - d.x) / axis.current.getBoundingClientRect().width * duration;
    const snap = (n: number) => Math.round(n * (e.shiftKey ? 1 : fps)) / (e.shiftKey ? 1 : fps);
    if (d.mode === 'move') { if (d.windows.length > 1) moveTimelineSelection(d.windows, snap(delta)); else { const start = Math.max(0, Math.min(duration - (d.end - d.start), snap(d.start + delta))); patch(layer.id, { start, end: start + d.end - d.start }); } }
    else if (d.mode === 'start') patch(layer.id, { start: Math.max(0, Math.min(d.end - 1 / fps, snap(d.start + delta))) });
    else patch(layer.id, { end: Math.min(duration, Math.max(d.start + 1 / fps, snap(d.end + delta))) });
  };
  return <div className={`tl-lane ${selectedIds.includes(layer.id) ? 'active' : ''} ${layer.visible ? '' : 'hidden'}`}><div className="tl-lane-gutter">{leadingControl}<LayerDragHandle id={layer.id} name={layer.text}/>
    <button className="tl-lane-btn" title={pt ? 'Mostrar / ocultar camada' : 'Show / hide layer'} onClick={() => patch(layer.id, { visible: !layer.visible })}>{layer.visible ? '◉' : '○'}</button>
    <button className="tl-lane-btn" title={pt ? 'Bloquear / desbloquear camada' : 'Lock / unlock layer'} onClick={() => patch(layer.id, { locked: !layer.locked })}>{layer.locked ? '▣' : '□'}</button>
    <button className="tl-lane-btn danger" title={pt ? 'Excluir camada' : 'Delete layer'} disabled={layer.locked} onClick={() => remove(layer.id)}>×</button>
  </div><div className="tl-lane-bars" ref={axis}><div className="tl-bar tl-text-bar" style={{ left: `${Math.max(0, layer.start) / duration * 100}%`, width: `${Math.max(0, Math.min(duration, layer.end) - layer.start) / duration * 100}%` }} {...timelineLayerDragProps(layer.id,e=>selectOverlayForEditing(layer.id,e.shiftKey,!e.shiftKey,'timeline'),begin('move'),move,finish)}>
    <span className="tl-bar-label"><b>{layer.media ? '▧' : 'T'} · {layer.text.slice(0, 40)}</b></span>
    <span className="tl-bar-edge in" onPointerDown={begin('start')} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} />
    <span className="tl-bar-edge out" onPointerDown={begin('end')} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} />
  </div></div></div>;
}
