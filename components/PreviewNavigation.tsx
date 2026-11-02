// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { FIT_VIEW, zoomPreview, panPreview, type PreviewView } from '@/lib/previewNavigation';
import { useUIStore } from '@/store/useUIStore';
import { tx } from '@/lib/tx';

export default function PreviewNavigation({ stage }: { stage: RefObject<HTMLDivElement | null> }) {
  const view = useRef<PreviewView>({ ...FIT_VIEW }), [percent, setPercent] = useState(100);
  const pt = useUIStore(s => s.locale) === 'pt';
  const change = useRef<(zoom: number) => void>(() => {});
  const fit = useRef<() => void>(() => {});
  const loupe = useRef(false);
  useEffect(() => {
    const element = stage.current; if (!element) return;
    const anchor = (x: number, y: number) => { const r = element.getBoundingClientRect(); return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 }; };
    let paint = 0;
    const draw = () => {
      paint = 0; const next = view.current;
      element.style.setProperty('--preview-zoom', String(next.zoom));
      element.style.setProperty('--preview-x', `${next.x}px`); element.style.setProperty('--preview-y', `${next.y}px`);
      setPercent(Math.round(next.zoom * 100));
      window.dispatchEvent(new Event('motion-preview-view'));
    };
    const apply = (next: PreviewView) => { view.current = next; if (!paint) paint = requestAnimationFrame(draw); };
    const zoom = (value: number, point?: { x: number; y: number }) => apply(zoomPreview(view.current, value, point));
    change.current = zoom;
    fit.current = () => apply({ ...FIT_VIEW });
    let gesture: { view: PreviewView; point: { x: number; y: number } } | null = null;
    const wheel = (e: WheelEvent) => {
      const inside = element.contains(e.target as Node);
      if (!inside && !e.ctrlKey && !e.metaKey) return;
      if (!e.cancelable) return;
      e.preventDefault();
      if (gesture || document.querySelector('dialog[open]')) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 300 : 1;
      const delta = e.deltaY * unit;
      if (e.ctrlKey || e.metaKey || e.altKey) zoom(view.current.zoom * Math.exp(-Math.max(-120, Math.min(120, delta)) * (e.ctrlKey ? .012 : .002)), inside ? anchor(e.clientX, e.clientY) : { x: 0, y: 0 });
      else apply(panPreview(view.current, -(e.shiftKey && !e.deltaX ? delta : e.deltaX * unit), e.shiftKey && !e.deltaX ? 0 : -delta));
    };
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('input,textarea,select,[contenteditable=true],dialog') && !e.metaKey && !e.ctrlKey && !e.altKey && !document.querySelector('dialog[open]')) {
        if (e.key.toLowerCase() === 'z' && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); window.dispatchEvent(new Event('motion-selection-tool'));loupe.current = !loupe.current; element.classList.toggle('preview-loupe', loupe.current); return; }
        if (e.key === 'Escape' && loupe.current) { e.preventDefault(); e.stopImmediatePropagation(); loupe.current = false; element.classList.remove('preview-loupe','preview-loupe-out'); return; }
      }
      if (e.key === 'Alt' && loupe.current) element.classList.add('preview-loupe-out');
      if (!(e.metaKey || e.ctrlKey) || !['+', '=', '-', '_', '0'].includes(e.key)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (document.querySelector('dialog[open]')) return;
      if (e.key === '0') fit.current();
      else zoom(view.current.zoom * (['-', '_'].includes(e.key) ? 1 / 1.2 : 1.2));
    };
    const keyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') element.classList.remove('preview-loupe-out'); };
    type GestureEvent = Event & { scale: number; clientX: number; clientY: number };
    const gestureStart = (event: Event) => { event.preventDefault(); const e = event as GestureEvent; gesture = { view: { ...view.current }, point: element.contains(e.target as Node) ? anchor(e.clientX, e.clientY) : { x: 0, y: 0 } }; window.dispatchEvent(new Event('motion-preview-navigation')); };
    const gestureChange = (event: Event) => { event.preventDefault(); const e = event as GestureEvent; if (gesture && !document.querySelector('dialog[open]')) apply(zoomPreview(gesture.view, gesture.view.zoom * e.scale, gesture.point)); };
    const gestureEnd = (event: Event) => { event.preventDefault(); gesture = null; };
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number; view: PreviewView; center: { x: number; y: number } } | null = null;
    let pan: { x: number; y: number; view: PreviewView } | null = null;
    const pointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.preview-navigation,.alignment-toolbar')) return;
      if (e.button === 0 && loupe.current) { e.preventDefault(); e.stopImmediatePropagation(); window.dispatchEvent(new Event('motion-preview-navigation')); zoom(view.current.zoom * (e.altKey ? 1 / 1.2 : 1.2), anchor(e.clientX,e.clientY)); return; }
      if (e.button === 1) { e.preventDefault(); e.stopImmediatePropagation(); window.dispatchEvent(new Event('motion-preview-navigation')); pan = { x: e.clientX, y: e.clientY, view: view.current }; element.classList.add('preview-panning'); element.setPointerCapture(e.pointerId); }
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { const [a,b] = [...touches.values()]; pinch = { distance: Math.max(1, Math.hypot(a.x-b.x,a.y-b.y)), view: view.current, center: anchor((a.x+b.x)/2,(a.y+b.y)/2) }; e.preventDefault(); e.stopImmediatePropagation(); window.dispatchEvent(new Event('motion-preview-navigation')); }
    };
    const pointerMove = (e: PointerEvent) => {
      if (pan) { e.preventDefault(); e.stopImmediatePropagation(); apply(panPreview(pan.view, e.clientX-pan.x, e.clientY-pan.y)); return; }
      if (!touches.has(e.pointerId)) return; touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || !pinch) return;
      e.preventDefault(); e.stopImmediatePropagation(); const [a,b] = [...touches.values()], center = anchor((a.x+b.x)/2,(a.y+b.y)/2);
      const next = zoomPreview(pinch.view, pinch.view.zoom * Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance, pinch.center);
      apply({ ...next, x: next.x + center.x-pinch.center.x, y: next.y + center.y-pinch.center.y });
    };
    const pointerUp = (e: PointerEvent) => { touches.delete(e.pointerId); if (pinch || pan) { e.stopImmediatePropagation(); pinch = null; pan = null; element.classList.remove('preview-panning'); } };
    const blur = () => { touches.clear(); pinch = null; pan = null; gesture = null; element.classList.remove('preview-panning','preview-loupe-out'); };
    const textTool=()=>{loupe.current=false;element.classList.remove('preview-loupe','preview-loupe-out');};
    window.addEventListener('motion-text-tool',textTool);
    window.addEventListener('keyup', keyUp, true);
    document.addEventListener('wheel', wheel, { passive: false, capture: true }); window.addEventListener('keydown', key, true);
    document.addEventListener('gesturestart', gestureStart, { passive: false }); document.addEventListener('gesturechange', gestureChange, { passive: false }); document.addEventListener('gestureend', gestureEnd, { passive: false });
    element.addEventListener('pointerdown', pointerDown, true); window.addEventListener('pointermove', pointerMove, { passive: false, capture: true }); window.addEventListener('pointerup', pointerUp, true); window.addEventListener('pointercancel', pointerUp, true); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('motion-text-tool',textTool);cancelAnimationFrame(paint); window.removeEventListener('keyup', keyUp, true); document.removeEventListener('wheel', wheel, true); window.removeEventListener('keydown', key, true); document.removeEventListener('gesturestart', gestureStart); document.removeEventListener('gesturechange', gestureChange); document.removeEventListener('gestureend', gestureEnd); element.removeEventListener('pointerdown', pointerDown, true); window.removeEventListener('pointermove', pointerMove, true); window.removeEventListener('pointerup', pointerUp, true); window.removeEventListener('pointercancel', pointerUp, true); window.removeEventListener('blur', blur); };
  }, [stage]);
  return <div className="preview-navigation" aria-label={tx(pt, 'Zoom da visualização', 'Preview zoom')} onPointerDown={e => e.stopPropagation()}>
    <button title={tx(pt, 'Diminuir zoom · ⌘/Ctrl −', 'Zoom out · ⌘/Ctrl −')} aria-label={tx(pt, 'Diminuir zoom da prévia', 'Zoom out preview')} onClick={() => change.current(view.current.zoom / 1.2)}>−</button>
    <output aria-live="polite">{percent}%</output>
    <button title={tx(pt, 'Aumentar zoom · ⌘/Ctrl +', 'Zoom in · ⌘/Ctrl +')} aria-label={tx(pt, 'Aumentar zoom da prévia', 'Zoom in preview')} onClick={() => change.current(view.current.zoom * 1.2)}>+</button>
    <button title={tx(pt, 'Centralizar e ajustar ao painel · ⌘/Ctrl 0. ', 'Center and fit to panel · ⌘/Ctrl 0. ')} onClick={() => fit.current()}>{tx(pt, 'Ajustar', 'Fit')}</button>
  </div>;
}
