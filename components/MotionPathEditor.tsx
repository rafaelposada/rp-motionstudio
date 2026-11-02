// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useI18n } from '@/lib/useI18n';
import { readMotionPath, type MotionPath } from '@/lib/modelMotionPath';
import { ControlRow } from './Controls';
import { tx } from '@/lib/tx';

export default function MotionPathEditor() {
  const pt = useI18n().locale === 'pt', values = useSceneStore(s => s.values), setValue = useSceneStore(s => s.setValue);
  const path = readMotionPath(values._motionPath), [selected, setSelected] = useState(1), dragging = useRef<number | null>(null), baseline = useRef<MotionPath | null>(null);
  const patch = (changes: Partial<MotionPath>) => setValue('_motionPath', { ...readMotionPath(useSceneStore.getState().values._motionPath), ...changes });
  const position = (e: PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: Math.max(-.25, Math.min(.25, ((e.clientX - r.x) / r.width - .5) * .5)), y: Math.max(-.25, Math.min(.25, ((e.clientY - r.y) / r.height - .5) * .5)) }; };
  const end = (cancel = false) => { if (dragging.current === null) return; if (cancel && baseline.current) patch(baseline.current); dragging.current = null; baseline.current = null; useHistoryStore.getState().endGesture(cancel); };
  useEffect(() => () => { if (dragging.current !== null) { dragging.current = null; useHistoryStore.getState().endGesture(); } }, []);
  return <details className="motion-path-panel"><summary>{tx(pt, 'Trajetória do modelo', 'Model motion path')}</summary>
    <label className="ctl-hint"><input type="checkbox" checked={path.enabled} onChange={e => patch({ enabled: e.target.checked })} /> {tx(pt, 'Ativar movimento por pontos', 'Enable point-based motion')}</label>
    <p className="ctl-hint">{tx(pt, 'Desloca o modelo inteiro ao longo dos pontos, mantendo sua animação. Alcance de ±25% da composição. Arraste um ponto; clique no espaço livre para acrescentar outro.', 'Moves the whole model through the points while keeping its animation. Range: ±25% of the canvas. Drag a point; click empty space to add one.')}</p>
    <svg className="motion-path-pad" viewBox="0 0 280 180" role="group" aria-label={tx(pt, 'Editar trajetória', 'Edit motion path')}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); end(true); } }} onPointerDown={e => {
        if (e.button !== 0) return;
        const index = (e.target as Element).closest('[data-point]')?.getAttribute('data-point');
        if (index === undefined || index === null) { if (path.points.length < 9) { patch({ points: [...path.points, position(e)], enabled: true }); setSelected(path.points.length); } return; }
        const i = Number(index); dragging.current = i; baseline.current = path; setSelected(i); useSceneStore.getState().setPlaying(false); useHistoryStore.getState().beginGesture(); e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
      }} onPointerMove={e => { if (dragging.current !== null) patch({ points: readMotionPath(useSceneStore.getState().values._motionPath).points.map((p, i) => i === dragging.current ? position(e) : p) }); }} onPointerUp={() => end()} onPointerCancel={() => end(true)} onLostPointerCapture={() => end()}>
      {Array.from({ length: 9 }, (_, i) => <path className="path-grid" key={i} d={`M${i * 35} 0V180 M0 ${i * 22.5}H280`} />)}
      <polyline className="path-line" points={(path.loop ? [...path.points, path.points[0]] : path.points).map(p => `${(p.x / .5 + .5) * 280},${(p.y / .5 + .5) * 180}`).join(' ')} />
      {path.points.map((p, i) => <g key={i} data-point={i} role="button" tabIndex={0} aria-label={`${tx(pt, 'Ponto', 'Point')} ${i}`} aria-pressed={selected === i} onKeyDown={e => { if (!e.key.startsWith('Arrow')) return; e.preventDefault(); const step = e.shiftKey ? .025 : .005; setSelected(i); patch({ points: path.points.map((point, n) => n === i ? { x: Math.max(-.25, Math.min(.25, point.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0))), y: Math.max(-.25, Math.min(.25, point.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0))) } : point) }); }} transform={`translate(${(p.x / .5 + .5) * 280},${(p.y / .5 + .5) * 180})`}><circle r="11" className={selected === i ? 'selected' : ''} /><text textAnchor="middle" dy="4">{i === 0 ? 'S' : i}</text></g>)}
    </svg>
    <div className="motion-path-actions"><button className="btn" disabled={path.points.length >= 9} onClick={() => { patch({ points: [...path.points, { x: 0, y: 0 }], enabled: true }); setSelected(path.points.length); }}>+ {tx(pt, 'Ponto', 'Point')}</button><button className="btn" disabled={selected === 0 || selected >= path.points.length || path.points.length <= 2} title={tx(pt, 'Remover o ponto selecionado', 'Remove the selected point')} onClick={() => { patch({ points: path.points.filter((_, i) => i !== selected) }); setSelected(0); }}>{tx(pt, 'Remover', 'Remove')}</button><button className="btn" onClick={() => { patch({ points: [{ x: 0, y: 0 }, { x: .18, y: -.12 }], enabled: false }); setSelected(1); }}>{tx(pt, 'Redefinir', 'Reset')}</button></div>
    <ControlRow def={{ key: 'pathDuration', label: tx(pt, 'Duração da trajetória', 'Path duration'), type: 'slider', min: .1, max: 60, step: .1, unit: 's', default: 4 }} value={path.duration} onChange={v => patch({ duration: Number(v) })} />
    <label className="motion-path-loop"><input type="checkbox" checked={path.loop} onChange={e => patch({ loop: e.target.checked })} /> {tx(pt, 'Voltar ao início e repetir', 'Return to start and repeat')}</label>
  </details>;
}
