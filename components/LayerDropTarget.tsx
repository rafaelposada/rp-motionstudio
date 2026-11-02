// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { type ReactNode, type DragEvent, type PointerEvent } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { reorderCompositionLayer, moveCompositionLayer, selectedCompositionIds } from '@/lib/compositionActions';

let cancelReorder: (() => void) | null = null;
let suppressClick: { id: string; until: number } | null = null;

// Pointer-driven sorting works with names, pen input and WebKit's standalone
// app window, without relying on the browser's native drag-image behavior.
function beginReorder(e: PointerEvent, id: string) {
  e.stopPropagation(); if (e.button !== 0) return;
  cancelReorder?.();
  document.querySelectorAll('.layer-drop-over').forEach(node => node.classList.remove('layer-drop-over'));
  const start = { x: e.clientX, y: e.clientY }, pointerId = e.pointerId, revision = sceneRestoreRevision();
  const ids = selectedCompositionIds(id), element = e.currentTarget as HTMLElement;
  let moved = false, over: HTMLElement | null = null;
  const cleanup = () => {
    window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', end, true); window.removeEventListener('pointercancel', cancel, true); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key, true);
    over?.classList.remove('layer-drop-over');
    document.querySelectorAll('.layer-drop-over').forEach(node => node.classList.remove('layer-drop-over')); element.classList.remove('layer-is-sorting');
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
  const key = (event: KeyboardEvent) => { if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();} };
  cancelReorder = cancel;
  window.addEventListener('pointermove', move, { passive: false, capture:true }); window.addEventListener('pointerup', end, true); window.addEventListener('pointercancel', cancel, true); window.addEventListener('blur', cancel); window.addEventListener('keydown',key,true);
  return {move};
}
// Horizontal drags move time; vertical drags sort the same whole clip surface.
export function timelineLayerDragProps(id:string, select:(e:PointerEvent)=>void, start:(e:PointerEvent)=>void, move:(e:PointerEvent)=>void, finish:(cancel?:boolean)=>void) {
  return {onPointerDown:(e:PointerEvent)=>{
    if(e.button!==0)return; e.stopPropagation(); select(e); if(e.shiftKey)return;
    cancelReorder?.();
    const element=e.currentTarget as HTMLElement, pointer=e.pointerId, x=e.clientX,y=e.clientY,revision=sceneRestoreRevision();
    const down={...e,currentTarget:element,clientX:x,clientY:y,pointerId:pointer,shiftKey:false,stopPropagation:()=>{}} as PointerEvent;
    let horizontal=false;
    const cleanup=()=>{window.removeEventListener('pointermove',onMove,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);cancelReorder=null;};
    const end=(cancelled=false)=>{cleanup();if(horizontal)finish(cancelled&&revision===sceneRestoreRevision());if(element.hasPointerCapture(pointer))element.releasePointerCapture(pointer);};
    const onMove=(event:globalThis.PointerEvent)=>{
      if(event.pointerId!==pointer)return;
      if(revision!==sceneRestoreRevision()){end(true);return;}
      const dx=event.clientX-x,dy=event.clientY-y;
      if(!horizontal&&Math.hypot(dx,dy)<5)return;
      if(!horizontal&&Math.abs(dy)>Math.abs(dx)){cleanup();beginReorder(down,id)?.move(event);return;}
      if(!horizontal){horizontal=true;start(down);}
      event.preventDefault();move(event as unknown as PointerEvent);
    };
    const up=(event:globalThis.PointerEvent)=>{if(event.pointerId===pointer)end();};
    const cancel=()=>end(true);
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}};
    cancelReorder=cancel;
    window.addEventListener('pointermove',onMove,{passive:false,capture:true});window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);
  },onClickCapture:(e:React.MouseEvent)=>{if(suppressClick?.id===id&&performance.now()<suppressClick.until){e.preventDefault();e.stopPropagation();suppressClick=null;}}};
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
  return <div className="layer-drop-target" data-layer-id={id}>{children}</div>;
}
