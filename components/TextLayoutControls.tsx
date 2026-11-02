// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import type { TextAlign, TextLayer, TextWrap } from '@/lib/textLayers';
import { parseNumericExpression } from '@/lib/numericExpression';
import { useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';

const ALIGNS: { value: TextAlign; en: string; pt: string }[] = [
  { value: 'left', en: 'Align left', pt: 'Alinhar à esquerda' },
  { value: 'center', en: 'Align center', pt: 'Centralizar' },
  { value: 'right', en: 'Align right', pt: 'Alinhar à direita' },
  { value: 'justify', en: 'Justify', pt: 'Justificar' },
];
const WRAPS: { value: TextWrap; en: string; pt: string }[] = [
  { value: 'auto', en: 'Auto', pt: 'Automático' },
  { value: 'balance', en: 'Balance', pt: 'Equilibrado' },
  { value: 'pretty', en: 'Pretty', pt: 'Sem palavra órfã' },
];

// 16×16 line glyphs: each row is a line, its length shows the alignment.
function AlignIcon({ value }: { value: TextAlign }) {
  const rows = [[3, 13], [3, 10], [3, 12]], y = [4.5, 8, 11.5];
  const shape = (i: number) => value === 'left' ? [3, rows[i][1]] : value === 'right' ? [16 - rows[i][1], 13] : value === 'center' ? [[4, 3, 5][i], [12, 13, 11][i]] : [3, 13];
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{y.map((cy, i) => <line key={i} x1={shape(i)[0]} x2={shape(i)[1]} y1={cy} y2={cy} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />)}</svg>;
}

export default function TextLayoutControls({ layer, pt, patch }: { layer: TextLayer; pt: boolean; patch: (id: string, change: Partial<TextLayer>) => void }) {
  const fixed = !!layer.boxWidth && layer.boxWidth > 0, canvasWidth = useSceneStore((s) => s.width);
  const [draft, setDraft] = useState<string | null>(null);
  // A fixed box is centered on x; keep a left/right aligned text's edge where it was.
  const edgeShift = (width: number) => layer.align === 'left' ? width / 2 : layer.align === 'right' ? -width / 2 : 0;
  const commitWidth = () => {
    if (draft === null) return;
    const value = parseNumericExpression(draft, 'px');
    setDraft(null);
    if (value === null || !Number.isFinite(value)) return;
    patch(layer.id, { boxWidth: Math.max(20, Math.min(8000, Math.round(value))) });
  };
  return <>
    <div className="text-edit-label">{pt ? 'Alinhamento' : 'Alignment'}
      <div className="icon-segmented" role="radiogroup" aria-label={pt ? 'Alinhamento' : 'Alignment'}>
        {ALIGNS.map((item) => <button key={item.value} type="button" role="radio" aria-checked={layer.align === item.value} title={pt ? item.pt : item.en} aria-label={pt ? item.pt : item.en}
          className={`icon-seg ${layer.align === item.value ? 'active' : ''}`} onClick={() => patch(layer.id, { align: item.value })}><AlignIcon value={item.value} /></button>)}
      </div>
    </div>
    <div className="text-edit-label">{pt ? 'Largura da caixa' : 'Box width'}
      <div className="text-box-width">
        <div className="icon-segmented compact">
          <button type="button" className={`icon-seg ${!fixed ? 'active' : ''}`} aria-pressed={!fixed} onClick={() => { if (fixed) patch(layer.id, { boxWidth: undefined, x: layer.x - edgeShift(layer.boxWidth!) }); }}>Auto</button>
          <button type="button" className={`icon-seg ${fixed ? 'active' : ''}`} aria-pressed={fixed} onClick={() => { if (fixed) return; const boxWidth = Math.round(Math.min(layer.size * 12, canvasWidth * .8)); patch(layer.id, { boxWidth, x: layer.x + edgeShift(boxWidth) }); }}>{pt ? 'Fixa' : 'Fixed'}</button>
        </div>
        {fixed && <input className="field" inputMode="decimal" aria-label={pt ? 'Largura da caixa em pixels' : 'Box width in pixels'}
          value={draft ?? `${layer.boxWidth} px`} onFocus={(e) => { setDraft(String(layer.boxWidth)); requestAnimationFrame(() => e.target.select()); }}
          onChange={(e) => setDraft(e.target.value)} onBlur={commitWidth}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitWidth(); (e.target as HTMLInputElement).blur(); } else if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const step = e.shiftKey ? 10 : 1; patch(layer.id, { boxWidth: Math.max(20, (layer.boxWidth ?? 0) + (e.key === 'ArrowUp' ? step : -step)) }); setDraft(null); } }} />}
      </div>
    </div>
    <label className="text-edit-label">{pt ? 'Quebra de linha' : 'Wrap'}
      <select className="field" disabled={!fixed} value={layer.wrap ?? 'auto'} onChange={(e) => patch(layer.id, { wrap: e.target.value as TextWrap })}>
        {WRAPS.map((item) => <option key={item.value} value={item.value}>{pt ? item.pt : item.en}</option>)}
      </select>
    </label>
    {!fixed && <p className="ctl-hint">{pt ? 'Com largura automática, o texto só quebra no Enter. Escolha “Fixa” para quebrar as linhas dentro da caixa.' : 'With automatic width, text only breaks on Enter. Choose “Fixed” to wrap lines inside the box.'}</p>}
  </>;
}
