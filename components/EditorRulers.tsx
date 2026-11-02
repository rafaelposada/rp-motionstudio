// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { tx } from '@/lib/tx';

const SIZE = 20; // ruler thickness in screen px
const STEPS = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
type Axis = 'x' | 'y';
interface Drag { axis: Axis; index: number; value: number; pointerId: number }

// Adobe-style rulers along the stage edges, in composition pixels at the
// current zoom. Drag from a ruler to create a guide, drag a guide to move it,
// drop it back on its ruler to remove it. Guides never appear in exports.
export default function EditorRulers({ root, rect, width, height, rulers, pt }: { root: RefObject<HTMLDivElement | null>; rect: { x: number; y: number; width: number; height: number }; width: number; height: number; rulers: boolean; pt: boolean }) {
  const guides = useSceneStore((s) => s.guides);
  const [size, setSize] = useState({ w: 0, h: 0 }), [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const ratio = rect.width > 0 ? rect.width / width : 0;

  useEffect(() => {
    const el = root.current; if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); setCursor({ x: e.clientX - r.x, y: e.clientY - r.y }); };
    const leave = () => setCursor(null);
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { observer.disconnect(); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [root]);

  if (!ratio || !size.w) return null;
  const toComp = (axis: Axis, screen: number) => Math.round(axis === 'x' ? (screen - rect.x) / ratio : (screen - rect.y) / ratio);
  const toScreen = (axis: Axis, value: number) => axis === 'x' ? rect.x + value * ratio : rect.y + value * ratio;
  const step = STEPS.find((s) => s * ratio >= 56) ?? STEPS.at(-1)!;
  const minor = step / (step % 5 === 0 ? 5 : step % 2 === 0 ? 2 : 1);

  const local = (e: React.PointerEvent | PointerEvent) => { const r = root.current!.getBoundingClientRect(); return { x: e.clientX - r.x, y: e.clientY - r.y }; };
  const startDrag = (axis: Axis, index: number, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    useHistoryStore.getState().beginGesture();
    const p = local(e), value = toComp(axis, axis === 'x' ? p.x : p.y);
    const next: Drag = { axis, index, value, pointerId: e.pointerId };
    if (index < 0) { const list = [...guides[axis], value]; useSceneStore.getState().setGuides({ ...guides, [axis]: list }); next.index = list.length - 1; }
    dragRef.current = next; setDrag(next);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d || e.pointerId !== d.pointerId) return;
    const p = local(e), value = toComp(d.axis, d.axis === 'x' ? p.x : p.y);
    const current = useSceneStore.getState().guides, list = [...current[d.axis]]; list[d.index] = value;
    useSceneStore.getState().setGuides({ ...current, [d.axis]: list });
    dragRef.current = { ...d, value }; setDrag(dragRef.current);
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d || e.pointerId !== d.pointerId) return;
    const p = local(e), overRuler = d.axis === 'x' ? p.x < SIZE : p.y < SIZE;
    if (overRuler) { const current = useSceneStore.getState().guides; useSceneStore.getState().setGuides({ ...current, [d.axis]: current[d.axis].filter((_, i) => i !== d.index) }); }
    useHistoryStore.getState().endGesture();
    dragRef.current = null; setDrag(null);
  };

  const ticks = (axis: Axis) => {
    const length = axis === 'x' ? size.w : size.h, out: React.ReactNode[] = [];
    const from = Math.floor(toComp(axis, SIZE) / minor) * minor, to = toComp(axis, length);
    for (let v = from; v <= to; v += minor) {
      const s = toScreen(axis, v), major = Math.abs(v % step) < 1e-6, len = major ? 8 : 4;
      if (s < SIZE) continue;
      out.push(axis === 'x'
        ? <g key={v}><path d={`M${s} ${SIZE}v-${len}`} />{major && <text x={s + 3} y={9}>{v}</text>}</g>
        : <g key={v}><path d={`M${SIZE} ${s}h-${len}`} />{major && <text x={9} y={s + 3} transform={`rotate(-90 9 ${s + 3})`}>{v}</text>}</g>);
    }
    return out;
  };

  const guideLine = (axis: Axis, value: number, index: number) => {
    const s = toScreen(axis, value), active = drag?.axis === axis && drag.index === index;
    return <div key={`${axis}${index}`} className={`ruler-guide ${axis} ${active ? 'active' : ''}`} style={axis === 'x' ? { left: s } : { top: s }}
      onPointerDown={(e) => startDrag(axis, index, e)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      title={tx(pt, 'Arraste para mover. Solte sobre a régua para remover.', 'Drag to move. Drop on the ruler to remove.')} />;
  };

  return <>
    <div className="ruler-guides" aria-hidden="true">
      {guides.x.map((v, i) => guideLine('x', v, i))}
      {guides.y.map((v, i) => guideLine('y', v, i))}
    </div>
    {drag && <span className="ruler-readout" style={drag.axis === 'x' ? { left: toScreen('x', drag.value) + 8, top: SIZE + 8 } : { left: SIZE + 8, top: toScreen('y', drag.value) + 8 }}>{drag.axis === 'x' ? 'X' : 'Y'} {drag.value}</span>}
    {rulers && <div className="editor-rulers-v2" aria-label={tx(pt, 'Réguas em pixels da composição', 'Composition pixel rulers')}>
      <svg className="ruler top" width={size.w} height={SIZE} style={{ width: size.w, height: SIZE }} onPointerDown={(e) => startDrag('y', -1, e)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <title>{tx(pt, 'Arraste para criar uma guia horizontal', 'Drag to create a horizontal guide')}</title>
        <rect className="ruler-canvas-span" x={Math.max(SIZE, rect.x)} y={0} width={Math.max(0, Math.min(size.w, rect.x + rect.width) - Math.max(SIZE, rect.x))} height={SIZE} />
        {ticks('x')}
        {cursor && cursor.x > SIZE && <path className="ruler-cursor" d={`M${cursor.x} 0v${SIZE}`} />}
      </svg>
      <svg className="ruler left" width={SIZE} height={size.h} style={{ width: SIZE, height: size.h }} onPointerDown={(e) => startDrag('x', -1, e)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <title>{tx(pt, 'Arraste para criar uma guia vertical', 'Drag to create a vertical guide')}</title>
        <rect className="ruler-canvas-span" x={0} y={Math.max(SIZE, rect.y)} width={SIZE} height={Math.max(0, Math.min(size.h, rect.y + rect.height) - Math.max(SIZE, rect.y))} />
        {ticks('y')}
        {cursor && cursor.y > SIZE && <path className="ruler-cursor" d={`M0 ${cursor.y}h${SIZE}`} />}
      </svg>
      <button type="button" className="ruler-corner" disabled={!guides.x.length && !guides.y.length}
        title={tx(pt, 'Remover todas as guias', 'Remove all guides')} aria-label={tx(pt, 'Remover todas as guias', 'Remove all guides')}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => { useHistoryStore.getState().beginGesture(); useSceneStore.getState().setGuides({ x: [], y: [] }); useHistoryStore.getState().endGesture(); }}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
      </button>
    </div>}
  </>;
}
