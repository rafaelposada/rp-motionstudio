// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ControlDef } from '@/lib/types';
import { useMobileInteractions } from './MobileInteractions';
import { useI18n } from '@/lib/useI18n';
import InfoHint from './InfoHint';
import { controlHelp } from '@/lib/controlHelp';
import { parseNumericExpression } from '@/lib/numericExpression';
import { xyPadPoint } from '@/lib/xyPad';
import {integerNumericKey,numericDecimals,numericKeyValue} from '@/lib/numericKeyboard';
import { tx } from '@/lib/tx';

interface RowProps {
  def: ControlDef;
  value: any;
  onChange: (val: any) => void;
}

export function ControlRow({ def, value, onChange }: RowProps) {
  const { locale, label } = useI18n();
  const displayLabel = label(def.label);
  return (
    <div className="ctl-row">
      <div className="ctl-label">
        <span>{displayLabel}</span>
        <InfoHint text={controlHelp(def, locale, displayLabel)} name={displayLabel} />
      </div>
      <div className="ctl-input">{renderControl(def, value, onChange)}</div>
    </div>
  );
}

function renderControl(def: ControlDef, value: any, onChange: (v: any) => void) {
  switch (def.type) {
    case 'slider': return <SliderControl def={def} value={value} onChange={onChange} />;
    case 'toggle': return <ToggleControl def={def} value={value} onChange={onChange} />;
    case 'pills': return <PillsControl def={def} value={value} onChange={onChange} />;
    case 'select': return <SelectControl def={def} value={value} onChange={onChange} />;
    case 'color': return <ColorControl value={value} onChange={onChange} />;
    case 'xypad': return <XYPadControl def={def} value={value} onChange={onChange} />;
    case 'upload': return <UploadControl value={value} onChange={onChange} />;
    case 'text': return <TextControl value={value} onChange={onChange} />;
    default: return null;
  }
}

// Figma spec: the whole 34px track is the slider. Fill #2d2d2d over #232323,
// a 2×16px #424242 bar as handle, value inside the track right-aligned
// (12px #aaa), click the value to type an exact number.
function SliderControl({ def, value, onChange }: RowProps) {
  const { locale, t, label } = useI18n();
  const mobile = useMobileInteractions();
  const min = def.min ?? 0, max = def.max ?? 100, step = def.step ?? 1;
  const trackRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [dragging, setDragging] = useState(false);
  const cancelBlurRef = useRef(false);
  const num = Number(value);
  const pct = max === min ? 100 : Math.max(0, Math.min(100, ((num - min) / (max - min)) * 100));
  // Fractional controls use centesimal interaction even when an older template
  // declares a coarse 0.1 or 0.05 step. Integer controls (count, rows, frames)
  // keep their declared step, so they can never drift to fractional values.
  const interactionStep = step < 1 ? Math.min(step, 0.01) : step;
  const integer=integerNumericKey(def.key);
  const stepDecimals = interactionStep < 1 ? Math.min(6, Math.ceil(-Math.log10(interactionStep))) : 0;
  const decimals = Math.max(def.precision ?? 0, stepDecimals, integer?0:numericDecimals(num));
  const formatted = num.toFixed(decimals);

  useEffect(() => {
    if (!editing) setDraft(formatted);
  }, [editing, formatted]);

  const snapValue = (next: number, increment = interactionStep) => {
    const snapped = min + Math.round((next - min) / increment) * increment;
    const bounded = Math.max(min, Math.min(max, snapped));
    return Number(bounded.toFixed(Math.max(4, decimals)));
  };
  const parsedDraft = parseNumericExpression(draft, def.unit ?? '');
  const calculated = parsedDraft === null ? null : integer?snapValue(parsedDraft):Number(Math.max(min,Math.min(max,parsedDraft)).toFixed(10));
  const adjustedToControl = parsedDraft !== null && calculated !== null && Math.abs(parsedDraft - calculated) > 1e-8;
  const isCalculation = /[+*/()]|\d\s*[−–—-]\s*\d/.test(draft.trim());

  const setFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(snapValue(min + t * (max - min)));
  };

  const applyDraft = () => {
    if (calculated !== null) onChange(calculated);
    setDraft(calculated === null ? formatted : String(calculated));
    setEditing(false);
  };

  return (
    <div className="slider-editor">
      <div className="slider-control">
        <div
          ref={trackRef}
          className={`strack ${mobile ? 'strack-mobile' : ''} ${dragging ? 'is-dragging' : ''}`}
          tabIndex={0}
          role="slider" aria-label={label(def.label)} aria-valuemin={min} aria-valuemax={max} aria-valuenow={num}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            setDragging(true);
            setFromX(e.clientX);
          }}
          onPointerMove={(e) => { if (e.buttons === 1) setFromX(e.clientX); }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={(e) => {
            const next=numericKeyValue(e,num,{step:interactionStep,min,max,integer,horizontal:true});
            if(next===null)return;e.preventDefault();e.stopPropagation();onChange(next);
          }}
          onDoubleClick={() => {
            const defaultValue = Number(def.default);
            if (Number.isFinite(defaultValue)) onChange(snapValue(defaultValue));
          }}
          title={locale === 'pt' ? `${t('reset')}: clique duas vezes` : `${t('reset')}: double-click`}
        >
          <div className="sfill" style={{ width: `${pct}%` }} />
          {min < 0 && max > 0 && <div className="szero" style={{ left: `${((-min) / (max - min)) * 100}%` }} />}
          <div className="shandle" style={{ left: `${pct}%` }} />
          {mobile && dragging && <output className="slider-bubble" style={{ left: `${pct}%` }}>{formatted}{def.unit ?? ''}</output>}
        </div>
        <label
          className="calc-field"
          data-editing={editing ? 'true' : 'false'}
          data-invalid={editing && draft.trim() && parsedDraft === null ? 'true' : 'false'}
          title={locale === 'pt'
            ? `Digite um valor ou cálculo, como 100/2. Faixa: ${min} a ${max}; precisão: ${interactionStep}.`
            : `Type a value or calculation, such as 100/2. Range: ${min} to ${max}; precision: ${interactionStep}.`}
        >
          <span className="calc-mark" aria-hidden="true">ƒx</span>
          <input
            className="calc-input"
            type="text"
            inputMode="text"
            spellCheck={false}
            value={editing ? draft : formatted}
            aria-label={locale === 'pt' ? `${label(def.label)}: valor ou cálculo` : `${label(def.label)}: value or calculation`}
            onFocus={(event) => {
              const input = event.currentTarget;
              setDraft(formatted);
              setEditing(true);
              requestAnimationFrame(() => input.select());
            }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (cancelBlurRef.current) {
                cancelBlurRef.current = false;
                setDraft(formatted);
                setEditing(false);
                return;
              }
              applyDraft();
            }}
            onKeyDown={(event) => {
              const next=numericKeyValue(event,parseNumericExpression(draft,def.unit??'')??num,{step:interactionStep,min,max,integer});
              if(next!==null){event.preventDefault();event.stopPropagation();setDraft(String(next));onChange(next);return;}
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                cancelBlurRef.current = true;
                event.currentTarget.blur();
              }
            }}
          />
          {def.unit && <span className="calc-unit" aria-hidden="true">{def.unit}</span>}
        </label>
      </div>
      {editing && (
        <output className={`calc-feedback ${parsedDraft === null ? 'invalid' : ''}`} aria-live="polite">
          {parsedDraft === null
            ? (tx(locale === 'pt', 'Cálculo inválido', 'Invalid calculation'))
            : isCalculation
              ? `= ${calculated?.toFixed(Math.max(decimals,numericDecimals(calculated??0)))}${def.unit ?? ''}${adjustedToControl ? (tx(locale === 'pt', ' · ajustado ao limite/passo', ' · adjusted to range/step')) : ''}`
              : (tx(locale === 'pt', 'Enter para aplicar', 'Press Enter to apply'))}
        </output>
      )}
    </div>
  );
}

export function controlVisible(def: ControlDef, values: Record<string, any>): boolean {
  const rule = def.visibleWhen;
  if (!rule) return true;
  const current = values[rule.key];
  if (rule.equals !== undefined && current !== rule.equals) return false;
  if (rule.not !== undefined && current === rule.not) return false;
  return true;
}

function ToggleControl({ def, value, onChange }: RowProps) {
  const { option } = useI18n();
  const options = def.options ?? ['on', 'off'];
  return (
    <div className="segmented">
      {options.map((opt) => (
        <button key={opt} className={`seg ${value === opt ? 'active' : ''}`} onClick={() => onChange(opt)}>{option(opt)}</button>
      ))}
    </div>
  );
}

function PillsControl({ def, value, onChange }: RowProps) {
  const { option } = useI18n();
  const options = def.options ?? [];
  return (
    <div className={`pills ${options.length <= 4 ? 'pills-fit' : ''}`}>
      {options.map((opt) => (
        <button key={opt} className={`pill ${value === opt ? 'active' : ''}`} onClick={() => onChange(opt)}>{option(opt)}</button>
      ))}
    </div>
  );
}

function SelectControl({ def, value, onChange }: RowProps) {
  const { option } = useI18n();
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {(def.options ?? []).map((opt) => <option key={opt} value={opt}>{option(opt)}</option>)}
    </select>
  );
}

function ColorControl({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <div className="color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <input className="field" type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function XYAxisField({ axis, value, onChange, range, label }: { axis: string; value: number; onChange: (value: number) => void; range: number; label: string }) {
  const [draft, setDraft] = useState(String(value)), [editing, setEditing] = useState(false), cancel = useRef(false);
  useEffect(() => { if (!editing) setDraft(String(Math.round(value * 100) / 100)); }, [value, editing]);
  return <label className="xy-axis-field"><span>{axis.toUpperCase()}</span><input type="text" aria-label={`${label} ${axis.toUpperCase()}: valor ou cálculo`} value={draft} onFocus={() => setEditing(true)} onChange={e => setDraft(e.target.value)} onBlur={() => { const result = parseNumericExpression(draft); if (!cancel.current && result !== null) onChange(Math.max(-range, Math.min(range, result))); cancel.current = false; setEditing(false); setDraft(String(value)); }} onKeyDown={e => {const next=numericKeyValue(e,parseNumericExpression(draft)??value,{min:-range,max:range});if(next!==null){e.preventDefault();e.stopPropagation();setDraft(String(next));onChange(next);return;} if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { e.stopPropagation(); cancel.current = true; e.currentTarget.blur(); } }} /></label>;
}

function XYPadControl({ def, value, onChange }: RowProps) {
  const { t, label } = useI18n();
  const mobile = useMobileInteractions();
  const ref = useRef<HTMLDivElement>(null);
  const range = def.max ?? 400;
  const v = value ?? { x: 0, y: 0 };

  const setFromEvent = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onChange(xyPadPoint(clientX - rect.left, clientY - rect.top, rect.width, rect.height, range));
  };

  const dotX = ((v.x / range + 1) / 2) * 100;
  const dotY = ((v.y / range + 1) / 2) * 100;

  return (
    <div className="xypad-wrap">
      <div
        ref={ref}
        className="xypad"
        tabIndex={0} role="group" aria-label={`${label(def.label)} XY`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFromEvent(e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (e.buttons === 1) setFromEvent(e.clientX, e.clientY); }}
        onDoubleClick={() => onChange({ x: 0, y: 0 })}
        onKeyDown={e => {const delta=numericKeyValue(e,0,{horizontal:true});if(delta===null)return;e.preventDefault();e.stopPropagation();const axis=e.key==='ArrowLeft'||e.key==='ArrowRight'?'x':'y';onChange({...v,[axis]:Math.max(-range,Math.min(range,v[axis]+(axis==='y'?-delta:delta)))});}}
      >
        <div className="xypad-cross-h" />
        <div className="xypad-cross-v" />
        <div className="xypad-dot" style={{ left: `${dotX}%`, top: `${dotY}%` }} />
      </div>
      <div className="xy-fields">{(['x', 'y'] as const).map(axis => <XYAxisField key={axis} axis={axis} value={v[axis]} range={range} label={label(def.label)} onChange={value => onChange({ ...v, [axis]: value })} />)}</div>
      {mobile && <button className="xypad-reset" onClick={() => onChange({ x: 0, y: 0 })}>{t('resetCenter')}</button>}
    </div>
  );
}

function UploadControl({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const { t } = useI18n();
  return (
    <label className="upload">
      <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(URL.createObjectURL(f)); }} />
      <span>{value ? t('replaceFile') : t('chooseFile')}</span>
    </label>
  );
}

function TextControl({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return <input className="field" type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}
