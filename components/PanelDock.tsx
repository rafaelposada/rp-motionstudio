// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef, type ReactNode, type PointerEvent, type KeyboardEvent } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { DEFAULT_PANELS, PANEL_LIMITS, isAdjustable, type PanelId, type PanelAxis } from '@/lib/panelLayout';
import { useI18n } from '@/lib/useI18n';
import { tx } from '@/lib/tx';

export function panelName(panel: PanelId, pt: boolean) {
  return (pt ? { rail: 'Navegação', library: 'Biblioteca / Projetos', inspector: 'Inspetor', timeline: 'Linha do tempo' } : { rail: 'Navigation', library: 'Library / Projects', inspector: 'Inspector', timeline: 'Timeline' })[panel];
}
function ResizeHandle({ panel, axis }: { panel: PanelId; axis: PanelAxis }) {
  const pt = useI18n().locale === 'pt';
  const value = useUIStore((state) => state.panels[panel][axis]);
  const drag = useRef<{ start: number; size: number; cursor: string } | null>(null);
  useEffect(() => () => { if (drag.current) { document.documentElement.style.cursor = drag.current.cursor; useUIStore.getState().persistPreferences(); } }, []);
  const reverse = axis === 'width' ? panel === 'inspector' : panel === 'timeline';
  const [min, max] = PANEL_LIMITS[panel][axis];
  // The timeline never grows past its content: extra height would only be
  // empty space under the last layer.
  const fit = (size: number, handle: HTMLElement) => { const most = Number(handle.parentElement?.dataset.fit); return most > 0 ? Math.min(size, most) : size; };
  const setSize = (size: number, persist = true, handle?: HTMLElement) => useUIStore.getState().setPanelDimension(panel, axis, handle ? fit(size, handle) : size, persist);
  const finish = () => { if (drag.current) { document.documentElement.style.cursor = drag.current.cursor; drag.current = null; useUIStore.getState().persistPreferences(); } };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.focus(); const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    drag.current = { start: axis === 'width' ? event.clientX : event.clientY, size: axis === 'width' ? rect.width : rect.height, cursor: document.documentElement.style.cursor };
    document.documentElement.style.cursor = axis === 'width' ? 'col-resize' : 'row-resize'; event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setSize(drag.current.size + ((axis === 'width' ? event.clientX : event.clientY) - drag.current.start) * (reverse ? -1 : 1), false, event.currentTarget);
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const decrease = axis === 'width' ? 'ArrowLeft' : 'ArrowUp'; const increase = axis === 'width' ? 'ArrowRight' : 'ArrowDown';
    if (event.key === 'Home') { event.preventDefault(); setSize(DEFAULT_PANELS[panel][axis]); }
    if (event.key !== decrease && event.key !== increase) return;
    event.preventDefault(); const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    setSize((axis === 'width' ? rect.width : rect.height) + (event.key === increase ? 1 : -1) * (reverse ? -1 : 1) * (event.shiftKey ? 1 : 10), true, event.currentTarget);
  };
  const label = `${axis === 'width' ? tx(pt, 'Largura', 'Width') : tx(pt, 'Altura', 'Height')} — ${panelName(panel, pt)}`;
  return <div className={`panel-resizer resize-${axis} ${reverse ? 'resize-reverse' : ''}`} role="separator" tabIndex={0} aria-label={label} aria-orientation={axis === 'width' ? 'vertical' : 'horizontal'} aria-valuemin={value ? min : 0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={value ? `${value}px` : tx(pt, 'Automático', 'Automatic')} title={`${label}. ${tx(pt, 'Arraste ou use as setas. Clique duas vezes para restaurar.', 'Drag or use arrow keys. Double-click to reset.')}`} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={key} onDoubleClick={() => setSize(DEFAULT_PANELS[panel][axis])} />;
}
export default function PanelDock({ panel, children, collapsed = false, strip = false, fit }: { panel: PanelId; children: ReactNode; collapsed?: boolean; strip?: boolean; fit?: number }) {
  const width = useUIStore((state) => state.panels[panel].width);
  return <div className={`dock-frame dock-${panel} ${collapsed ? 'dock-collapsed' : ''}`} data-fit={fit || undefined} style={{ height: '100%', ...(panel === 'timeline' && width ? { width: `min(100%, ${width}px)` } : {}) }} aria-hidden={collapsed || undefined} inert={collapsed || undefined}>
    {children}{!collapsed && !strip && (['width', 'height'] as const).filter((axis) => isAdjustable(panel, axis)).map((axis) => <ResizeHandle key={axis} panel={panel} axis={axis} />)}
  </div>;
}
