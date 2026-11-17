// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';

import { useRef, useState } from 'react';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { BASIC_FONTS, ensureFont, type TextLayer } from '@/lib/textLayers';
import { animatedLayer, keyedPatch } from '@/lib/keyframes';
import { applyInlineStyle, inlineProperty, validTextRange, type InlineStyle } from '@/lib/richText';
import { parseNumericExpression } from '@/lib/numericExpression';
import { tx } from '@/lib/tx';
import { editSelectedOverlays } from '@/lib/compositionEditing';
import ColorField from './ColorField';

const ALIGN = [['left', 'Esquerda', 'Left'], ['center', 'Centro', 'Center'], ['right', 'Direita', 'Right'], ['justify', 'Justificado', 'Justified']] as const;

export default function TextContextControls({ layer, pt }: { layer: TextLayer; pt: boolean }) {
  const range = validTextRange(layer, useUIStore(s => s.textRange));
  const [status, setStatus] = useState('');
  const request = useRef(0);
  const scene = useSceneStore.getState(), seconds = scene.frame / scene.fps;
  const live = animatedLayer(layer, seconds);
  const patch = (change: Partial<TextLayer>) => {
    const current = useSceneStore.getState().textLayers.find(item => item.id === layer.id);
    if (current && !current.locked) scene.patchTextLayer(layer.id, change);
  };
  const style = (change: InlineStyle) => {
    if (range) patch(applyInlineStyle(layer, change, range));
    else editSelectedOverlays(layer.id, target => applyInlineStyle(target, change, null));
  };
  const font = inlineProperty(layer, 'font', range), weight = inlineProperty(layer, 'weight', range);
  const color = inlineProperty(layer, 'color', range), opacity = inlineProperty(layer, 'fillOpacity', range);
  const fontOptions = [...new Set([...BASIC_FONTS, font.value ?? layer.font])];
  const weights = [...new Set([300, 400, 500, 600, 700, 800, 900, weight.value ?? layer.weight])].sort((a, b) => a - b);
  const chooseFont = async (family: string, selectedWeight: number) => {
    const revision = sceneRestoreRevision(), version = ++request.current;
    setStatus(tx(pt, 'Carregando fonte…', 'Loading font…'));
    try {
      await ensureFont(family, selectedWeight);
      const current = useSceneStore.getState().textLayers.find(item => item.id === layer.id);
      if (version !== request.current || revision !== sceneRestoreRevision() || !current || range && !validTextRange(current, range)) return;
      if (range) scene.patchTextLayer(layer.id, applyInlineStyle(current, { font: family, weight: selectedWeight }, range));
      else editSelectedOverlays(layer.id, target => applyInlineStyle(target, { font: family, weight: selectedWeight }, null));
      setStatus('');
    } catch {
      if (version === request.current) setStatus(tx(pt, 'Não foi possível carregar a fonte.', 'Could not load the font.'));
    }
  };
  const number = (key: 'size' | 'letterSpacing' | 'lineHeight', label: string, min: number, max: number) => {
    const value = live[key] ?? 0;
    return <label>{label}<input type="text" inputMode="decimal" key={value} defaultValue={Number(value.toFixed(3))} onBlur={e => {
      const next = parseNumericExpression(e.currentTarget.value);
      const bounded = next === null ? value : Math.max(min, Math.min(max, next));
      e.currentTarget.value = String(bounded);
      if (bounded !== value) editSelectedOverlays(layer.id, target => keyedPatch(target, { [key]: bounded }, seconds));
    }} onKeyDown={e => {
      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
      if (e.key === 'Escape') e.currentTarget.value = String(value);
    }}/></label>;
  };

  return <div className="context-text-controls" role="group" aria-label={tx(pt, 'Formatação de texto', 'Text formatting')}>
    <label className="context-text-wide">{tx(pt, 'Conteúdo', 'Content')}<textarea rows={2} value={layer.text} onChange={e => patch({ text: e.target.value })} /></label>
    <label>{tx(pt, 'Fonte', 'Font')}<select value={font.mixed ? '' : font.value} onChange={e => void chooseFont(e.target.value, weight.value ?? layer.weight)}>
      {font.mixed && <option value="" disabled>{tx(pt, 'Misto', 'Mixed')}</option>}
      {fontOptions.map(family => <option key={family}>{family}</option>)}
    </select></label>
    <label>{tx(pt, 'Peso', 'Weight')}<select value={weight.mixed ? '' : weight.value} disabled={!font.mixed && !!font.value?.startsWith('Local ')} onChange={e => void chooseFont(font.value ?? layer.font, Number(e.target.value))}>
      {weight.mixed && <option value="" disabled>{tx(pt, 'Misto', 'Mixed')}</option>}
      {weights.map(w => <option key={w}>{w}</option>)}
    </select></label>
    {number('size', tx(pt, 'Tamanho (px)', 'Size (px)'), 8, 400)}
    {number('lineHeight', tx(pt, 'Entrelinha', 'Line height'), .5, 3)}
    {number('letterSpacing', tx(pt, 'Espaço entre letras', 'Letter spacing'), -10, 80)}
    <label>{tx(pt, 'Alinhamento', 'Alignment')}<select value={layer.align} onChange={e => editSelectedOverlays(layer.id, () => ({ align: e.target.value as TextLayer['align'] }))}>
      {ALIGN.map(([value, br, en]) => <option key={value} value={value}>{tx(pt, br, en)}</option>)}
    </select></label>
    <div className="context-text-wide"><ColorField label={tx(pt, 'Cor', 'Color')} pt={pt} color={color.value ?? layer.color} opacity={opacity.value ?? 1}
      mixed={color.mixed} mixedOpacity={opacity.mixed} onChange={(color, fillOpacity, changed) => style(changed === 'opacity' ? { fillOpacity } : { color })} /></div>
    {status && <p className="context-text-wide ctl-hint" role="status">{status}</p>}
  </div>;
}
