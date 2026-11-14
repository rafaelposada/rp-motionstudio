// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { animatedLayer, hasKeys, keyedPatch } from '@/lib/keyframes';
import { CODE_EXAMPLE, CODE_EXAMPLE_WEBGL, codeLayerError, normalizeCode, type CodeEngine } from '@/lib/codeLayer';
import { MEDIA_READY_EVENT } from '@/lib/shapeFill';
import type { TextLayer } from '@/lib/textLayers';
import { ControlRow } from './Controls';
import { KeyedRow } from './KeyframeControls';
import { BlendRow } from './BlendSelect';
import MaskControl from './MaskControl';
import LayerAnimationControls from './LayerAnimationControls';
import Tilt3DControls from './Tilt3DControls';
import { tx } from '@/lib/tx';

const ENGINES: { engine: CodeEngine; label: string }[] = [{ engine: '2d', label: 'Canvas 2D' }, { engine: 'webgl', label: 'WebGL' }];

export function addCodeLayer(engine: CodeEngine, pt: boolean) {
  const s = useSceneStore.getState();
  s.addTextLayer();
  const layer = useSceneStore.getState().textLayers.at(-1)!, size = Math.round(Math.min(s.width, s.height) * .8);
  s.patchTextLayer(layer.id, { text: tx(pt, 'Código', 'Code'), x: s.width / 2, y: s.height / 2, rotation: 0, opacity: 1, code: normalizeCode({ engine, width: size, height: size, source: engine === 'webgl' ? CODE_EXAMPLE_WEBGL : CODE_EXAMPLE }) });
  useUIStore.getState().selectText(layer.id);
  useUIStore.getState().setTimelineExpanded(true);
}

// The drawing's error, refreshed whenever the worker reports a frame or fails.
function useCodeError(id: string | undefined) {
  const [error, setError] = useState<ReturnType<typeof codeLayerError>>(null);
  useEffect(() => {
    if (!id) { setError(null); return; }
    const read = () => setError(codeLayerError(id));
    read(); window.addEventListener(MEDIA_READY_EVENT, read);
    return () => window.removeEventListener(MEDIA_READY_EVENT, read);
  }, [id]);
  return error;
}

function CodeEditor({ layer, pt }: { layer: TextLayer; pt: boolean }) {
  const code = layer.code!, [draft, setDraft] = useState(code.source), area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(code.source), [layer.id, code.source]);
  const error = useCodeError(layer.id), dirty = draft !== code.source;
  const apply = () => { if (dirty) useSceneStore.getState().patchTextLayer(layer.id, { code: normalizeCode({ ...code, source: draft }) }); };
  const lines = draft.split('\n').length;
  return <div className="code-editor">
    <div className="code-editor-field">
      <pre className="code-editor-gutter" aria-hidden="true">{Array.from({ length: lines }, (_, i) => <span key={i} className={error?.line === i + 1 ? 'error' : ''}>{i + 1}</span>)}</pre>
      <textarea ref={area} value={draft} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" aria-label={tx(pt, 'Código da camada', 'Layer code')}
        onChange={(e) => setDraft(e.target.value)}
        onScroll={(e) => { const gutter = e.currentTarget.previousElementSibling as HTMLElement | null; if (gutter) gutter.scrollTop = e.currentTarget.scrollTop; }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); apply(); return; }
          if (e.key === 'Tab') {
            e.preventDefault();
            const el = e.currentTarget, start = el.selectionStart, end = el.selectionEnd;
            const next = draft.slice(0, start) + '  ' + draft.slice(end);
            setDraft(next); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
          }
        }} />
    </div>
    <div className="code-editor-bar">
      <span className={`code-editor-status ${error ? 'error' : dirty ? 'dirty' : ''}`} role="status">
        {error ? `${error.line ? tx(pt, `Linha ${error.line}: `, `Line ${error.line}: `) : ''}${error.message}` : dirty ? tx(pt, 'Alterações ainda não aplicadas', 'Changes not applied yet') : tx(pt, 'Rodando', 'Running')}
      </span>
      <button type="button" className="btn solid" disabled={!dirty} onClick={apply} title="⌘/Ctrl + Enter">{tx(pt, 'Aplicar', 'Apply')}</button>
    </div>
  </div>;
}

export default function CodePanel() {
  const layers = useSceneStore((s) => s.textLayers), selected = useUIStore((s) => s.selectedTextId), pt = useUIStore((s) => s.locale) === 'pt';
  const layer = layers.find((l) => l.id === selected && l.code);
  const keyFrame = useSceneStore((s) => layer && hasKeys(layer) ? s.frame : 0), fps = useSceneStore((s) => s.fps);
  const seconds = (layer && hasKeys(layer) ? keyFrame : useSceneStore.getState().frame) / fps;
  const patch = (change: Partial<TextLayer>) => layer && useSceneStore.getState().patchTextLayer(layer.id, change);
  const live = layer ? animatedLayer(layer, seconds) : undefined;
  return <section className="code-panel">
    <h3>{tx(pt, 'Código', 'Code')}</h3>
    <p className="ctl-hint">{tx(pt, 'Desenhos e efeitos escritos em JavaScript, com Canvas 2D ou WebGL. Rodam isolados, sem internet, e saem iguais na exportação.', 'Drawings and effects written in JavaScript with Canvas 2D or WebGL. They run isolated, offline, and export exactly as previewed.')}</p>
    <div className="code-add" role="group" aria-label={tx(pt, 'Adicionar camada de código', 'Add code layer')}>
      {ENGINES.map((e) => <button key={e.engine} type="button" className="btn" onClick={() => addCodeLayer(e.engine, pt)}>+ {e.label}</button>)}
    </div>
    {layer?.code && live && <>
      <div className="media-fit-pills code-engine" role="group" aria-label={tx(pt, 'Tipo de desenho', 'Drawing type')}>
        {ENGINES.map((e) => <button key={e.engine} type="button" className={layer.code!.engine === e.engine ? 'active' : ''} aria-pressed={layer.code!.engine === e.engine}
          title={tx(pt, 'Troca o contexto entregue ao código (ctx ou gl).', 'Switches the context given to the code (ctx or gl).')}
          onClick={() => patch({ code: normalizeCode({ ...layer.code!, engine: e.engine }) })}>{e.label}</button>)}
      </div>
      <CodeEditor layer={layer} pt={pt} />
      <ControlRow def={{ key: 'codeWidth', label: tx(pt, 'Largura', 'Width'), type: 'slider', min: 16, max: 4096, step: 1, unit: 'px', default: 1080 }} value={layer.code.width} onChange={(v) => patch({ code: normalizeCode({ ...layer.code!, width: Number(v) }) })} />
      <ControlRow def={{ key: 'codeHeight', label: tx(pt, 'Altura', 'Height'), type: 'slider', min: 16, max: 4096, step: 1, unit: 'px', default: 1080 }} value={layer.code.height} onChange={(v) => patch({ code: normalizeCode({ ...layer.code!, height: Number(v) }) })} />
      {(['x', 'y', 'rotation'] as const).map((key) => <KeyedRow key={key} layer={layer} prop={key} pt={pt}><ControlRow def={{ key, label: key === 'rotation' ? tx(pt, 'Rotação', 'Rotation') : `${tx(pt, 'Posição', 'Position')} ${key.toUpperCase()}`, type: 'slider', min: -4000, max: 4000, step: 1, default: 0 }} value={live[key]} onChange={(v) => patch(keyedPatch(layer, { [key]: Number(v) }, seconds))} /></KeyedRow>)}
      <Tilt3DControls layer={layer} pt={pt} />
      <KeyedRow layer={layer} prop="opacity" pt={pt}><ControlRow def={{ key: 'opacity', label: tx(pt, 'Opacidade', 'Opacity'), type: 'slider', min: 0, max: 100, step: 1, unit: '%', default: 100 }} value={live.opacity * 100} onChange={(v) => patch(keyedPatch(layer, { opacity: Number(v) / 100 }, seconds))} /></KeyedRow>
      <BlendRow value={layer.blend} onChange={(blend) => patch({ blend })} />
      <MaskControl layer={layer} pt={pt} />
      <LayerAnimationControls layer={layer} pt={pt} />
    </>}
  </section>;
}
