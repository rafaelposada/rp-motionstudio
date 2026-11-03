// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { LayerDragHandle, timelineLayerDragProps } from './LayerDropTarget';
import type { TextLayer } from '@/lib/textLayers';
import { deleteCompositionLayer, selectOverlayForEditing } from '@/lib/compositionActions';
import { useHistoryStore } from '@/store/useHistoryStore';
import { captureTimelineSelection, moveTimelineSelection, restoreTimelineSelection, type TimelineWindow } from '@/lib/timelineSelection';
import { tx } from '@/lib/tx';
import { keyTimes } from '@/lib/keyframes';
import { magnetOffset } from '@/lib/timelineSnap';
import { compositionOrder } from '@/lib/composition';
import { EyeIcon, LaneOrder, LockIcon, TrashIcon } from './LaneIcons';
export default function TextTrackLane({ layer, duration, leadingControl }: { layer: TextLayer; duration: number; leadingControl?:ReactNode }) {
  const selectedIds = useUIStore(s => s.selectedLayerIds), pt = useUIStore(s => s.locale) === 'pt';
  const patch = useSceneStore((s) => s.patchTextLayer); const remove = deleteCompositionLayer;
  const fps = useSceneStore((s) => s.fps); const axis = useRef<HTMLDivElement>(null);
  const order = compositionOrder(useSceneStore((s) => s.tracks), useSceneStore((s) => s.textLayers)), index = order.findIndex((l) => l.id === layer.id);
  const drag = useRef<{ x: number; start: number; end: number; mode: 'move' | 'start' | 'end'; windows: TimelineWindow[] } | null>(null);
  useEffect(() => {
    const finish = () => { if (drag.current) { drag.current = null; useHistoryStore.getState().endGesture(); } };
    window.addEventListener('blur', finish); return () => { window.removeEventListener('blur', finish); finish(); };
  }, []);
  const begin = (mode: 'move' | 'start' | 'end') => (e: React.PointerEvent) => { e.stopPropagation(); selectOverlayForEditing(layer.id, e.shiftKey, !e.shiftKey, 'timeline'); if (e.shiftKey || layer.locked) return; useHistoryStore.getState().beginGesture(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode, x: e.clientX, start: layer.start, end: layer.end, windows: captureTimelineSelection(layer.id) }; };
  const finish = (cancel = false) => { const d = drag.current; if (!d) return; drag.current = null; if (cancel) restoreTimelineSelection(d.windows); useHistoryStore.getState().endGesture(cancel); };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !axis.current) return;
    const spp = duration / axis.current.getBoundingClientRect().width, delta = (e.clientX - d.x) * spp;
    const snap = (n: number) => Math.round(n * (e.shiftKey ? 1 : fps)) / (e.shiftKey ? 1 : fps);
    const magnet = (edges: number[]) => e.altKey ? 0 : magnetOffset(edges, spp);
    if (d.mode === 'move') { if (d.windows.length > 1) moveTimelineSelection(d.windows, snap(delta)); else { const span = d.end - d.start, raw = snap(d.start + delta), start = Math.max(0, Math.min(duration - span, raw + magnet([raw, raw + span]))); patch(layer.id, { start, end: start + span }); } }
    else if (d.mode === 'start') { const raw = snap(d.start + delta); patch(layer.id, { start: Math.max(0, Math.min(d.end - 1 / fps, raw + magnet([raw]))) }); }
    else { const raw = snap(d.end + delta); patch(layer.id, { end: Math.min(duration, Math.max(d.start + 1 / fps, raw + magnet([raw]))) }); }
  };
  return <div className={`tl-lane ${selectedIds.includes(layer.id) ? 'active' : ''} ${layer.visible ? '' : 'hidden'}`}><div className="tl-lane-gutter">{leadingControl}<LayerDragHandle id={layer.id} name={layer.text}/>
    <button className="tl-lane-btn" title={layer.visible ? tx(pt, 'Ocultar camada', 'Hide layer') : tx(pt, 'Mostrar camada', 'Show layer')} onClick={() => patch(layer.id, { visible: !layer.visible })}><EyeIcon off={!layer.visible} /></button>
    <LaneOrder id={layer.id} index={index} count={order.length} pt={pt} />
    <button className={`tl-lane-btn ${layer.locked ? 'on' : ''}`} title={layer.locked ? tx(pt, 'Desbloquear camada', 'Unlock layer') : tx(pt, 'Bloquear camada', 'Lock layer')} aria-pressed={!!layer.locked} onClick={() => patch(layer.id, { locked: !layer.locked })}><LockIcon locked={layer.locked} /></button>
    <button className="tl-lane-btn danger" title={tx(pt, 'Excluir camada', 'Delete layer')} disabled={layer.locked} onClick={() => remove(layer.id)}><TrashIcon /></button>
  </div><div className="tl-lane-bars"><div className="tl-zoom" ref={axis}><div className="tl-bar tl-text-bar" style={{ left: `${Math.max(0, layer.start) / duration * 100}%`, width: `${Math.max(0, Math.min(duration, layer.end) - layer.start) / duration * 100}%` }} {...timelineLayerDragProps(layer.id,e=>selectOverlayForEditing(layer.id,e.shiftKey,!e.shiftKey,'timeline'),begin('move'),move,finish)}>
    <span className="tl-bar-label"><b>{layer.media ? '▧' : layer.shape ? '◇' : 'T'} · {layer.text.slice(0, 40)}</b></span>
    <span className="tl-bar-edge in" onPointerDown={begin('start')} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} />
    <span className="tl-bar-edge out" onPointerDown={begin('end')} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} />
  </div>
  {keyTimes(layer).map((t) => <button key={t} type="button" className="tl-keyframe" style={{ left: `${Math.min(duration, Math.max(0, t)) / duration * 100}%` }}
    title={`${tx(pt, 'Keyframe em', 'Keyframe at')} ${t.toFixed(2)}s`} aria-label={`${tx(pt, 'Ir ao keyframe em', 'Go to keyframe at')} ${t.toFixed(2)}s`}
    onPointerDown={(e) => e.stopPropagation()} onClick={() => { const st = useSceneStore.getState(); st.setPlaying(false); st.setFrame(Math.round(t * st.fps)); }} />)}
  </div></div></div>;
}
