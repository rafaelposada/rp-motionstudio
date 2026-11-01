'use client';
import { useState, type ReactNode } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useSceneStore } from '@/store/useSceneStore';
import { reorderCompositionLayer, moveCompositionLayer } from '@/lib/compositionActions';

const TYPE = 'application/x-rp-motion-layer';
export default function LayerDropTarget({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const pt = useUIStore(s => s.locale) === 'pt', [over, setOver] = useState(false);
  return <div className={`layer-drop-target ${over ? 'layer-drop-over' : ''}`} data-layer-id={id}
    onDragOver={e => { if (e.dataTransfer.types.includes(TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
    onDrop={e => { e.preventDefault(); setOver(false); const source = e.dataTransfer.getData(TYPE); if (source) reorderCompositionLayer(source, id); }}>
    <button type="button" className="layer-sort-grip" draggable aria-label={`${pt ? 'Arrastar para ordenar' : 'Drag to reorder'}: ${name}`} title={pt ? 'Arraste para ordenar. Option/Alt + ↑/↓ também altera a ordem.' : 'Drag to reorder. Option/Alt + ↑/↓ also changes order.'}
      onPointerDown={e => e.stopPropagation()} onDragStart={e => { useSceneStore.getState().setPlaying(false); e.dataTransfer.setData(TYPE, id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setOver(false)}
      onKeyDown={e => { if (e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); moveCompositionLayer(id, e.key === 'ArrowUp' ? 1 : -1); } }}>⠿</button>
    {children}
  </div>;
}
