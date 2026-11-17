// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { arrangeCompositionLayers, deleteCompositionLayers, duplicateCompositionLayers, groupCompositionLayers, selectedCompositionIds, selectModelForEditing, selectOverlayForEditing } from '@/lib/compositionActions';
import { compositionOrder } from '@/lib/composition';
import { tx } from '@/lib/tx';
import { isTextLayer } from '@/lib/textLayers';
import TextContextControls from './TextContextControls';
import ModelTransitionControls from './ModelTransitionControls';

const MENU_EVENT = 'motion-composition-menu';
type Menu = { x: number; y: number; ids: string[]; id?: string; origin: HTMLElement; revision: number };

export function openCompositionMenu(event: MouseEvent<HTMLElement>, id?: string, origin: 'canvas' | 'layers' | 'timeline' = 'canvas') {
  event.preventDefault();
  event.stopPropagation();
  const ui = useUIStore.getState();
  if (id && !ui.selectedLayerIds.includes(id)) {
    const select = useSceneStore.getState().tracks.some(track => track.id === id) ? selectModelForEditing : selectOverlayForEditing;
    select(id, false, false, origin);
  }
  const target = event.target instanceof HTMLElement ? event.target : event.currentTarget;
  const box = target.getBoundingClientRect();
  const keyboard = event.clientX === 0 && event.clientY === 0;
  const menu: Menu = {
    x: keyboard ? box.left : event.clientX, y: keyboard ? box.bottom : event.clientY,
    ids: selectedCompositionIds(id), id, origin: target.closest<HTMLElement>('button,[tabindex]') ?? event.currentTarget, revision: sceneRestoreRevision(),
  };
  window.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: menu }));
}

export default function CompositionContextMenu() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pt = useUIStore(s => s.locale) === 'pt';
  const tracks = useSceneStore(s => s.tracks);
  const overlays = useSceneStore(s => s.textLayers);
  useEffect(() => {
    const open = (event: Event) => setMenu((event as CustomEvent<Menu>).detail);
    window.addEventListener(MENU_EVENT, open);
    return () => window.removeEventListener(MENU_EVENT, open);
  }, []);
  useLayoutEffect(() => {
    if (!menu || !root.current) return;
    const node = root.current;
    node.style.left = `${Math.max(6, Math.min(menu.x, window.innerWidth - node.offsetWidth - 6))}px`;
    node.style.top = `${Math.max(6, Math.min(menu.y, window.innerHeight - node.offsetHeight - 6))}px`;
    node.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    const dismiss = (event: Event) => {
      if (node.contains(event.target as Node)) return;
      if (document.activeElement instanceof HTMLElement && node.contains(document.activeElement)) document.activeElement.blur();
      setMenu(null);
    };
    const close = () => setMenu(null);
    window.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  if (!menu || menu.revision !== sceneRestoreRevision()) return null;
  const textLayer = overlays.find(layer => layer.id === menu.id && !layer.locked && isTextLayer(layer));
  const model = tracks.find(track => track.id === menu.id);
  const hasControls = !!(textLayer || model);
  const members = [...tracks, ...overlays].filter(layer => menu.ids.includes(layer.id));
  const movable = members.some(layer => !('locked' in layer && layer.locked));
  const grouped = members.some(layer => layer.groupId);
  const canGroup = members.length > 1 && !members.every(layer => layer.groupId && layer.groupId === members[0].groupId);
  const run = (action: () => void) => { setMenu(null); menu.origin.focus({ preventScroll: true }); action(); };
  const openEffects = () => {
    const ui = useUIStore.getState();
    if (menu.id) {
      const current = useSceneStore.getState();
      const select = current.tracks.some(track => track.id === menu.id) ? selectModelForEditing : selectOverlayForEditing;
      select(menu.id, false, true, 'layers');
    }
    if (window.matchMedia('(max-width: 919px)').matches) ui.setMobileTab('adjust');
    else {
      if (ui.rightCollapsed) ui.toggleRightPanel();
      window.dispatchEvent(new CustomEvent('rp-inspector-tab', { detail: 'motion' }));
    }
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>('.composition-effects .effect-add select');
      field?.scrollIntoView({ block: 'center' });
      field?.focus({ preventScroll: true });
    });
  };
  const item = (label: string, action: () => void, disabled = false) =>
    <button type="button" role="menuitem" disabled={disabled} onClick={() => run(action)}>{label}</button>;

  return createPortal(<div ref={root} className={`composition-context-menu${hasControls ? ' has-controls' : ''}`}
    role={hasControls ? 'dialog' : 'menu'} aria-label={tx(pt, 'Ações da composição', 'Composition actions')}
    onContextMenu={e => e.preventDefault()} onKeyDown={e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      run(() => {});
    }}>
    {textLayer && <TextContextControls key={textLayer.id} layer={textLayer} pt={pt} />}
    {model && <div className="context-model-transitions"><ModelTransitionControls key={model.id} track={model} pt={pt} /></div>}
    <div className="composition-context-actions" role={hasControls ? 'menu' : undefined} onKeyDown={e => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }}>
    {item(tx(pt, 'Selecionar tudo', 'Select all'), () => useUIStore.getState().setLayerSelection(compositionOrder(tracks, overlays).map(layer => layer.id)))}
    {item(tx(pt, 'Agrupar', 'Group'), () => groupCompositionLayers(menu.ids), !canGroup)}
    {item(tx(pt, 'Desagrupar', 'Ungroup'), () => groupCompositionLayers(menu.ids, true), !grouped)}
    <div className="composition-context-divider" role="separator" />
    {item(tx(pt, 'Efeitos…', 'Effects…'), openEffects, !movable)}
    {item(tx(pt, 'Duplicar', 'Duplicate'), () => duplicateCompositionLayers(menu.ids), !movable && !grouped)}
    {item(tx(pt, 'Trazer para a frente', 'Bring to front'), () => arrangeCompositionLayers(menu.ids, 'front'), !movable)}
    {item(tx(pt, 'Enviar para trás', 'Send to back'), () => arrangeCompositionLayers(menu.ids, 'back'), !movable)}
    {item(tx(pt, 'Excluir', 'Delete'), () => void deleteCompositionLayers(menu.ids), !movable)}
    </div>
  </div>, document.body);
}
