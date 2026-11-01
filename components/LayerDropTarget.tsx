'use client';
import { useState, type ReactNode, type DragEvent, type PointerEvent } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { reorderCompositionLayer, moveCompositionLayer, selectedCompositionIds } from '@/lib/compositionActions';

const TYPE = 'application/x-rp-motion-layer';
let cancelReorder: (() => void) | null = null;
let suppressClick: { id: string; until: number } | null = null;

// Pointer-driven sorting works with names, pen input and WebKit's standalone
// app window, without relying on the browser's native drag-image behavior.
function beginReorder(e: PointerEvent, id: string) {
  e.stopPropagation(); if (e.button !== 0) return;
  cancelReorder?.();
  const start = { x: e.clientX, y: e.clientY }, pointerId = e.pointerId, revision = sceneRestoreRevision();
  const ids = selectedCompositionIds(id), element = e.currentTarget as HTMLElement;
  let moved = false, over: HTMLElement | null = null;
  const cleanup = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel);
    over?.classList.remove('layer-drop-over'); element.classList.remove('layer-is-sorting');
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    cancelReorder = null;
  };
  const move = (event: globalThis.PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    if (!moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
    if (!moved) { moved = true; useSceneStore.getState().setPlaying(false); element.setPointerCapture?.(pointerId); element.classList.add('layer-is-sorting'); }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.layer-drop-target') ?? null;
    if (target !== over) { over?.classList.remove('layer-drop-over'); over = target; if (target && !ids.includes(target.dataset.layerId!)) target.classList.add('layer-drop-over'); }
  };
  const end = (event: globalThis.PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const overId = over?.dataset.layerId;
    if (moved) { suppressClick = { id, until: performance.now() + 300 }; event.preventDefault(); }
    cleanup();
    if (moved && overId && revision === sceneRestoreRevision()) reorderCompositionLayer(id, overId, ids);
  };
  const cancel = () => { if (moved) suppressClick = { id, until: performance.now() + 300 }; cleanup(); };
  cancelReorder = cancel;
  window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel);
}
export function layerDragProps(id: string) {
  return { draggable: false, onPointerDown: (e: PointerEvent) => beginReorder(e, id), onDragStart: (e: DragEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => { if (suppressClick?.id === id && performance.now() < suppressClick.until) { e.preventDefault(); e.stopPropagation(); suppressClick = null; } } };
}
export function LayerDragHandle({ id, name }: { id: string; name: string }) {
  const pt = useUIStore(s => s.locale) === 'pt';
  return <button type="button" className="layer-sort-grip" {...layerDragProps(id)} aria-label={`${pt ? 'Arrastar para ordenar' : 'Drag to reorder'}: ${name}`} title={pt ? 'Arraste a alça ou o nome para ordenar. Alt + ↑/↓ também altera a ordem.' : 'Drag the grip or name to reorder. Alt + ↑/↓ also changes order.'}
    onKeyDown={e => { if (e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); moveCompositionLayer(id, e.key === 'ArrowUp' ? 1 : -1); } }}>⠿</button>;
}
export default function LayerDropTarget({ id, children }: { id: string; name?: string; children: ReactNode }) {
  const [over, setOver] = useState(false);
  return <div className={`layer-drop-target ${over ? 'layer-drop-over' : ''}`} data-layer-id={id}
    onDragOver={e => { if (e.dataTransfer.types.includes(TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
    onDrop={e => { if (!e.dataTransfer.types.includes(TYPE)) return; e.preventDefault(); setOver(false); try { const { id: source, ids } = JSON.parse(e.dataTransfer.getData(TYPE)); if (typeof source === 'string') reorderCompositionLayer(source, id, Array.isArray(ids) ? ids.filter(i => typeof i === 'string') : [source]); } catch { /* Ignore unrelated drag payloads. */ } }}>
    {children}
  </div>;
}
