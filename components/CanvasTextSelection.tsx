'use client';
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { useSceneStore, type SceneState } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { captionFontSize, textMotion, textFontRevision, type TextLayer } from '@/lib/textLayers';
import type { MotionTrack } from '@/lib/tracks';
import { getRendererInstance } from '@/lib/rendererInstance';
import { compositionOrder } from '@/lib/composition';
import { deleteCompositionLayer, duplicateCompositionLayer } from '@/lib/compositionActions';
import { snapAlignment, type AlignBox } from '@/lib/alignment';
import { ANCHOR_AXES, RESIZE_ANCHORS, bounded, frameAABB, mapFramePoint, normalizedAngle, normalizedRadii, pointerRotation, resizeCursor, resizeFrame, rotatePoint, type ResizeAnchor, type TransformFrame, type TransformPoint } from '@/lib/transformGeometry';
import { modelPathOffset } from '@/lib/modelMotionPath';

let measureContext: CanvasRenderingContext2D | null = null;
interface LocalBounds { width: number; height: number; left: number }
const measuredBounds = new WeakMap<TextLayer, { revision: number; canvasWidth: number; box: LocalBounds }>();
function bounds(layer: TextLayer, canvasWidth: number): LocalBounds {
  if (layer.media) return { width: layer.media.width, height: layer.media.height, left: -layer.media.width / 2 };
  const revision = textFontRevision(), cached = measuredBounds.get(layer);
  if (cached?.revision === revision && cached.canvasWidth === canvasWidth) return cached.box;
  const ctx = measureContext ??= document.createElement('canvas').getContext('2d')!;
  const font = (size: number) => `${layer.weight} ${size}px "${layer.font}", sans-serif`;
  ctx.font = font(layer.size);
  const lines = layer.text.split('\n'), spacing = layer.letterSpacing ?? 0;
  const lineWidth = (line: string) => ctx.measureText(line).width + Math.max(0, [...line].length - 1) * spacing;
  const size = layer.backdrop ? captionFontSize(layer.size, Math.max(0, ...lines.map(lineWidth)), canvasWidth) : layer.size;
  ctx.font = font(size);
  const w = Math.max(20, ...lines.map(lineWidth)), pad = layer.backdrop ? 18 : 0;
  const box = { width: w + pad * 2, height: lines.length * size * layer.lineHeight + (layer.backdrop ? 30 : 0), left: (layer.align === 'left' ? 0 : layer.align === 'right' ? -w : -w / 2) - pad };
  measuredBounds.set(layer, { revision, canvasWidth, box }); return box;
}
function layerFrame(layer: TextLayer, width: number, seconds: number): TransformFrame {
  const b = bounds(layer, width), sx = bounded(layer.scaleX ?? 1, .05, 20), sy = bounded(layer.scaleY ?? 1, .05, 20);
  const c = rotatePoint({ x: (b.left + b.width / 2) * sx, y: 0 }, layer.rotation);
  return { cx: layer.x + c.x, cy: layer.y + textMotion(layer, seconds).y + c.y, width: b.width * sx, height: b.height * sy, rotation: layer.rotation };
}
function modelFrame(id: string): TransformFrame | null {
  const renderer = getRendererInstance(), oriented = renderer?.selectionFrame?.(id);
  if (oriented) return oriented;
  const b = renderer?.selectionBounds?.(id);
  return b ? { cx: b.x + b.width / 2, cy: b.y + b.height / 2, width: b.width, height: b.height, rotation: 0 } : null;
}
const CORNERS: ResizeAnchor[] = ['nw', 'ne', 'se', 'sw'];
type Operation = 'move' | 'resize' | 'rotate' | 'radius';
interface Gesture {
  id: string; kind: Operation; frame: TransformFrame; start: TransformPoint;
  overlay?: TextLayer; track?: MotionTrack; anchor?: ResizeAnchor; corner?: number; pointerId?: number;
  duplicatePending?: boolean;
  duplicateBaseline?: Pick<SceneState, 'tracks' | 'textLayers' | 'activeTrackId' | 'activeTemplateId' | 'values' | 'easing' | 'compositeMode'>;
  originalId?: string;
  viewport?: { left: number; top: number; width: number; height: number; canvasWidth: number; canvasHeight: number };
}
const sameFrame = (a: TransformFrame, b: TransformFrame) => (Object.keys(a) as (keyof TransformFrame)[]).every(key => Math.abs(a[key] - b[key]) < .01);

export default function CanvasTextSelection() {
  const root = useRef<HTMLDivElement>(null), drag = useRef<Gesture | null>(null);
  const layers = useSceneStore(s => s.textLayers), tracks = useSceneStore(s => s.tracks);
  const width = useSceneStore(s => s.width), height = useSceneStore(s => s.height), frame = useSceneStore(s => s.frame), fps = useSceneStore(s => s.fps);
  const selected = useUIStore(s => s.selectedTextId), selectedMotion = useUIStore(s => s.selectedMotionId), show = useUIStore(s => s.showSelectionBox);
  const rulers = useUIStore(s => s.showRulers), guides = useUIStore(s => s.smartGuides), snap = useUIStore(s => s.snapEnabled), pt = useUIStore(s => s.locale) === 'pt';
  const [guide, setGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [rect, setRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [renderedModel, setRenderedModel] = useState<{ id: string; box: TransformFrame } | null>(null);
  const fontVersion = useRef(textFontRevision()), [, setFontVersion] = useState(fontVersion.current);
  const seconds = frame / fps, ratio = rect.width / width;
  useEffect(() => {
    const parent = root.current?.parentElement; if (!parent) return;
    const measure = () => {
      const canvas = [...parent.querySelectorAll('canvas.stage-canvas')].find(c => getComputedStyle(c).display !== 'none'); if (!canvas) return;
      const a = canvas.getBoundingClientRect(), b = parent.getBoundingClientRect();
      setRect({ x: a.x - b.x, y: a.y - b.y, width: a.width, height: a.height });
    };
    const resize = new ResizeObserver(measure); resize.observe(parent);
    const mutation = new MutationObserver(measure); mutation.observe(parent, { childList: true });
    measure(); return () => { resize.disconnect(); mutation.disconnect(); };
  }, [width, height]);
  useEffect(() => {
    const update = () => {
      const revision = textFontRevision(); if (revision !== fontVersion.current) { fontVersion.current = revision; setFontVersion(revision); }
      const id = useUIStore.getState().selectedMotionId, box = id ? modelFrame(id) : null;
      const valid = box && Object.values(box).every(Number.isFinite) && box.width > 0 && box.height > 0;
      setRenderedModel(prev => id && valid ? prev?.id === id && sameFrame(prev.box, box) ? prev : { id, box } : prev ? null : prev);
    };
    window.addEventListener('motion-preview-rendered', update); update();
    return () => window.removeEventListener('motion-preview-rendered', update);
  }, [selectedMotion]);
  const finish = (cancel = false) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    if (cancel) {
      const s = useSceneStore.getState();
      if (d.duplicateBaseline) {
        useSceneStore.setState(d.duplicateBaseline);
        if (d.overlay) useUIStore.getState().selectText(d.originalId!); else useUIStore.getState().selectMotion(d.originalId!);
      } else if (d.overlay) s.patchTextLayer(d.id, d.overlay);
      else if (d.track) s.patchTrack(d.id, { transform: d.track.transform, values: d.track.values });
    }
    if (d.pointerId !== undefined && root.current?.hasPointerCapture(d.pointerId)) root.current.releasePointerCapture(d.pointerId);
    setGuide({ x: null, y: null }); useHistoryStore.getState().endGesture(cancel);
  };
  const finishRef = useRef(finish); finishRef.current = finish;
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (drag.current && (e.key === 'Escape' || (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) { e.preventDefault(); e.stopImmediatePropagation(); finishRef.current(true); return; }
      if (e.defaultPrevented || useUIStore.getState().settingsOpen || document.querySelector('dialog[open]')) return;
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
      const ui = useUIStore.getState(), id = ui.selectedTextId ?? ui.selectedMotionId;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'd' && id) { e.preventDefault(); e.stopImmediatePropagation(); duplicateCompositionLayer(id); }
      else if (['Backspace', 'Delete'].includes(e.key) && id) { e.preventDefault(); deleteCompositionLayer(id); }
    };
    const blur = () => finishRef.current();
    window.addEventListener('keydown', key, true); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('blur', blur); finishRef.current(); };
  }, []);
  const active = layers.find(l => l.id === selected && l.visible && seconds >= l.start && seconds < l.end), track = tracks.find(t => t.id === selectedMotion);
  const selection = active ? layerFrame(active, width, seconds) : renderedModel?.id === selectedMotion ? renderedModel.box : null;
  const viewport = () => { const r = root.current!.getBoundingClientRect(); return { left: r.x + rect.x, top: r.y + rect.y, width: rect.width, height: rect.height, canvasWidth: width, canvasHeight: height }; };
  const point = (e: PointerEvent) => { const r = drag.current?.viewport ?? viewport(); return { x: (e.clientX - r.left) * r.canvasWidth / r.width, y: (e.clientY - r.top) * r.canvasHeight / r.height }; };
  const snapshot = (kind: Operation, start: TransformPoint, id?: string): Gesture | null => {
    const s = useSceneStore.getState(), ui = useUIStore.getState();
    const overlay = s.textLayers.find(l => l.id === (id ?? ui.selectedTextId)), model = s.tracks.find(t => t.id === (id ?? ui.selectedMotionId));
    if (overlay?.locked) return null;
    const box = overlay ? layerFrame(overlay, s.width, s.frame / s.fps) : model ? modelFrame(model.id) : null;
    return box && box.width > 0 && box.height > 0 ? { id: overlay?.id ?? model!.id, kind, start, frame: box, overlay, track: overlay ? undefined : model } : null;
  };
  const patchFrame = (d: Gesture, next: TransformFrame) => {
    const s = useSceneStore.getState(), motionY = d.overlay ? textMotion(d.overlay, s.frame / s.fps).y : 0;
    const path = d.track ? modelPathOffset(d.track, s.frame, s.fps, width, height) : { x: 0, y: 0 };
    const origin = d.overlay ? { x: d.overlay.x, y: d.overlay.y + motionY } : { x: width / 2 + d.track!.transform.x + path.x, y: height / 2 + d.track!.transform.y + path.y };
    const p = mapFramePoint(origin, d.frame, next);
    if (d.overlay) {
      const l = d.overlay, sx = bounded(l.scaleX ?? 1, .05, 20), sy = bounded(l.scaleY ?? 1, .05, 20);
      const patch: Partial<TextLayer> = { x: p.x, y: p.y - motionY, rotation: next.rotation };
      if (l.media) patch.media = { ...l.media, width: next.width / sx, height: next.height / sy };
      else { patch.scaleX = sx * next.width / d.frame.width; patch.scaleY = sy * next.height / d.frame.height; }
      s.patchTextLayer(d.id, patch);
    } else {
      const t = d.track!;
      s.patchTrack(d.id, { transform: { ...t.transform, x: p.x - width / 2 - path.x, y: p.y - height / 2 - path.y, scale: t.transform.scale * next.width / d.frame.width, rotation: normalizedAngle(t.transform.rotation + next.rotation - d.frame.rotation) } });
    }
  };
  const apply = (d: Gesture, p: TransformPoint, shift: boolean, alt: boolean, snapOff = false) => {
    const s = useSceneStore.getState(), delta = { x: p.x - d.start.x, y: p.y - d.start.y };
    if (d.kind === 'rotate') {
      const initial = d.overlay?.rotation ?? d.track!.transform.rotation, rotation = pointerRotation(d.frame, d.start, p, initial, shift);
      patchFrame(d, { ...d.frame, rotation: d.frame.rotation + normalizedAngle(rotation - initial) }); return;
    }
    if (d.kind === 'radius') {
      const i = d.corner!, [x, y] = ANCHOR_AXES[CORNERS[i]], local = rotatePoint(delta, -d.frame.rotation);
      if (d.overlay) {
        const l = d.overlay, b = bounds(l, width), sx = bounded(l.scaleX ?? 1, .05, 20), sy = bounded(l.scaleY ?? 1, .05, 20);
        const initial = l.backdropRadius ?? 12;
        const radii = normalizedRadii(b.width, b.height, l.media?.cornerRadii ?? (l.media ? [0, 0, 0, 0] : [initial, initial, initial, initial]));
        const r = bounded(radii[i] + (-x * local.x / sx - y * local.y / sy) / 2, 0, Math.min(b.width, b.height) / 2);
        if (l.media) { const next = alt ? [...radii] as typeof radii : [r, r, r, r] as typeof radii; next[i] = r; s.patchTextLayer(d.id, { media: { ...l.media, cornerRadii: next } }); }
        else s.patchTextLayer(d.id, { backdropRadius: r });
      } else {
        const r = bounded(Number(d.track!.values.cornerRadius ?? 0) + (-x * local.x - y * local.y) * 100 / Math.max(1, Math.min(d.frame.width, d.frame.height)), 0, 100);
        s.patchTrack(d.id, { values: { ...d.track!.values, cornerRadius: r } });
      }
      return;
    }
    const targets: AlignBox[] = [{ x: 0, y: 0, width, height }, ...s.textLayers.filter(l => l.id !== d.id && l.visible && seconds >= l.start && seconds < l.end).map(l => frameAABB(layerFrame(l, width, seconds))), ...s.tracks.filter(t => t.id !== d.id && t.visible).map(t => getRendererInstance()?.selectionBounds?.(t.id)).filter((b): b is AlignBox => !!b)];
    const box = frameAABB(d.frame);
    const match = snapAlignment(d.kind === 'move' ? { ...box, x: box.x + delta.x, y: box.y + delta.y } : { x: p.x, y: p.y, width: 0, height: 0 }, targets, 6 / Math.max(.01, ratio));
    if (snap && !alt && !snapOff) { delta.x += match.dx; delta.y += match.dy; }
    setGuide(guides && !alt && !snapOff ? { x: match.x, y: match.y } : { x: null, y: null });
    if (d.kind === 'move') {
      if (shift) { if (Math.abs(delta.x) > Math.abs(delta.y)) delta.y = 0; else delta.x = 0; }
      patchFrame(d, { ...d.frame, cx: d.frame.cx + delta.x, cy: d.frame.cy + delta.y }); return;
    }
    const l = d.overlay, t = d.track;
    const limits = t ? { minWidth: d.frame.width * .1 / t.transform.scale, minHeight: d.frame.height * .1 / t.transform.scale, maxWidth: d.frame.width * 3 / t.transform.scale, maxHeight: d.frame.height * 3 / t.transform.scale }
      : l!.media ? { minWidth: 1, minHeight: 1, maxWidth: 4000, maxHeight: 4000 }
      : { minWidth: bounds(l!, width).width * .05, minHeight: bounds(l!, width).height * .05, maxWidth: bounds(l!, width).width * 20, maxHeight: bounds(l!, width).height * 20 };
    patchFrame(d, resizeFrame(d.frame, delta, d.anchor!, { ...limits, proportional: !!t || shift, centered: alt }));
  };
  const begin = (e: PointerEvent, kind: Operation, anchor?: ResizeAnchor, corner?: number) => {
    if (e.button !== 0 || !rect.width || drag.current) return;
    e.stopPropagation(); e.preventDefault();
    const d = snapshot(kind, point(e)); if (!d) return;
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    useSceneStore.getState().setPlaying(false); useHistoryStore.getState().beginGesture();
    drag.current = { ...d, anchor, corner, pointerId: e.pointerId, viewport: viewport() }; root.current!.setPointerCapture(e.pointerId);
  };
  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, kind: Operation, anchor?: ResizeAnchor, corner?: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || !selection) return;
    e.preventDefault(); e.stopPropagation();
    const positive = ['ArrowRight', 'ArrowUp'].includes(e.key), step = e.shiftKey ? 10 : 1;
    const start = { x: selection.cx, y: selection.cy - selection.height / 2 - 40 / Math.max(.01, ratio) };
    const d = snapshot(kind, start); if (!d) return; d.anchor = anchor; d.corner = corner;
    useSceneStore.getState().setPlaying(false); useHistoryStore.getState().beginGesture();
    if (kind === 'rotate') {
      const initial = d.overlay?.rotation ?? d.track!.transform.rotation, rotation = normalizedAngle(initial + (positive ? 1 : -1) * (e.shiftKey ? 15 : 1));
      patchFrame(d, { ...d.frame, rotation: d.frame.rotation + normalizedAngle(rotation - initial) });
    } else {
      let delta = { x: e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0, y: e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0 };
      if (kind === 'radius') { const [x, y] = ANCHOR_AXES[CORNERS[corner!]]; delta = rotatePoint({ x: -x * (positive ? step : -step), y: -y * (positive ? step : -step) }, d.frame.rotation); }
      apply(d, { x: start.x + delta.x, y: start.y + delta.y }, e.shiftKey, e.altKey, true);
    }
    useHistoryStore.getState().endGesture(); setGuide({ x: null, y: null });
  };
  const names: Record<ResizeAnchor, string> = pt ? { nw: 'canto superior esquerdo', n: 'borda superior', ne: 'canto superior direito', e: 'borda direita', se: 'canto inferior direito', s: 'borda inferior', sw: 'canto inferior esquerdo', w: 'borda esquerda' } : { nw: 'top left corner', n: 'top edge', ne: 'top right corner', e: 'right edge', se: 'bottom right corner', s: 'bottom edge', sw: 'bottom left corner', w: 'left edge' };
  const radiusEnabled = !!(active?.media || active?.backdrop || track && !active);
  const cornerValue = (i: number) => active ? active.media ? normalizedRadii(active.media.width, active.media.height, active.media.cornerRadii)[i] : active.backdropRadius ?? 12 : Number(track?.values.cornerRadius ?? 0);
  return <div ref={root} className="canvas-selection" tabIndex={-1} onPointerDown={e => {
    if (e.button !== 0 || !rect.width || drag.current) return;
    const p = point(e), s = useSceneStore.getState(), order = compositionOrder(tracks, layers);
    const hit = [...order].reverse().filter(l => l.kind === 'overlay').map(item => layers.find(l => l.id === item.id)!).find(l => {
      if (!l.visible || l.opacity < .02 || seconds < l.start || seconds >= l.end) return false;
      const f = layerFrame(l, width, seconds), local = rotatePoint({ x: p.x - f.cx, y: p.y - f.cy }, -f.rotation);
      return Math.abs(local.x) <= f.width / 2 + 6 / Math.max(.01, ratio) && Math.abs(local.y) <= f.height / 2 + 6 / Math.max(.01, ratio);
    });
    const modelId = getRendererInstance()?.hitTest?.(p.x, p.y), id = modelId && (!hit || order.findIndex(l => l.id === modelId) > order.findIndex(l => l.id === hit.id)) ? modelId : hit?.id;
    if (id && id === modelId) { useUIStore.getState().selectMotion(id); s.setActiveTrack(id); } else useUIStore.getState().selectText(hit?.id ?? null);
    if (!id || hit?.id === id && hit.locked) return;
    const d = snapshot('move', p, id); if (!d) return;
    e.currentTarget.focus({ preventScroll: true });
    s.setPlaying(false); useHistoryStore.getState().beginGesture();
    drag.current = { ...d, pointerId: e.pointerId, duplicatePending: e.altKey, viewport: viewport() }; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
  }} onPointerMove={e => {
    let d = drag.current; if (!d) return;
    const p = point(e);
    if (d.duplicatePending) {
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) * ratio < 3) return;
      const s = useSceneStore.getState();
      const baseline = { tracks: s.tracks, textLayers: s.textLayers, activeTrackId: s.activeTrackId, activeTemplateId: s.activeTemplateId, values: s.values, easing: s.easing, compositeMode: s.compositeMode };
      const copyId = duplicateCompositionLayer(d.id, 0, false); if (!copyId) return;
      const next = useSceneStore.getState();
      d = { ...d, originalId: d.id, id: copyId, duplicatePending: false, duplicateBaseline: baseline, overlay: d.overlay ? next.textLayers.find(l => l.id === copyId) : undefined, track: d.track ? next.tracks.find(t => t.id === copyId) : undefined };
      drag.current = d;
    }
    apply(d, p, e.shiftKey, e.altKey);
  }} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish()}>
    <div className="alignment-toolbar" onPointerDown={e=>e.stopPropagation()}>{([['showRulers',pt?'Réguas':'Rulers'],['smartGuides',pt?'Guias':'Guides'],['snapEnabled',pt?'Encaixar':'Snap']] as const).map(([key,label])=><button key={key} aria-pressed={key==='showRulers'?rulers:key==='smartGuides'?guides:snap} onClick={()=>useUIStore.getState().setAlignmentOption(key,!(key==='showRulers'?rulers:key==='smartGuides'?guides:snap))}>{label}</button>)}</div>
    {rulers&&rect.width>0&&<svg className="editor-rulers" aria-label={pt?'Réguas em pixels da composição':'Composition pixel rulers'}><rect x={rect.x} y={Math.max(0,rect.y-20)} width={rect.width} height="20"/><rect x={Math.max(0,rect.x-28)} y={rect.y} width="28" height={rect.height}/>{Array.from({length:11},(_,i)=>{const x=rect.x+rect.width*i/10,y=rect.y+rect.height*i/10;return <g key={i}><text x={x+2} y={Math.max(10,rect.y-7)}>{Math.round(width*i/10)}</text><path d={`M${x} ${rect.y-4}v4`}/><text x={Math.max(1,rect.x-26)} y={y+10}>{Math.round(height*i/10)}</text><path d={`M${rect.x-4} ${y}h4`}/></g>;})}</svg>}
    {(guide.x!==null||guide.y!==null)&&<svg className="editor-guides">{guide.x!==null&&<line x1={rect.x+guide.x/width*rect.width} x2={rect.x+guide.x/width*rect.width} y1={rect.y} y2={rect.y+rect.height}/>} {guide.y!==null&&<line y1={rect.y+guide.y/height*rect.height} y2={rect.y+guide.y/height*rect.height} x1={rect.x} x2={rect.x+rect.width}/>}</svg>}

    {show && selection && ratio > 0 && <div className="canvas-selection-box transform-selection" role="group" aria-label={pt ? 'Transformar camada selecionada' : 'Transform selected layer'} style={{ left: rect.x + selection.cx / width * rect.width, top: rect.y + selection.cy / height * rect.height, width: selection.width * ratio, height: selection.height * ratio, transform: `translate(-50%, -50%) rotate(${selection.rotation}deg)` }}>
      <span className="canvas-selection-label">{active?.text.slice(0, 30) || track?.name}{active?.locked ? ' 🔒' : ''}</span>
      {!active?.locked && <>
        {RESIZE_ANCHORS.map(anchor => { const [x, y] = ANCHOR_AXES[anchor]; const label = `${pt ? 'Redimensionar' : 'Resize'}: ${names[anchor]}`; return <button key={anchor} type="button" className="transform-handle" aria-label={label} title={label + (pt ? '. Shift mantém proporção; Alt redimensiona pelo centro.' : '. Shift preserves aspect; Alt scales from the center.')} style={{ left: `${(x + 1) * 50}%`, top: `${(y + 1) * 50}%`, cursor: resizeCursor(anchor, selection.rotation) }} onPointerDown={e => begin(e, 'resize', anchor)} onKeyDown={e => handleKey(e, 'resize', anchor)} />; })}
        <i className="transform-rotation-stem" aria-hidden="true" />
        <button type="button" className="transform-rotation" aria-label={pt ? 'Rotacionar camada' : 'Rotate layer'} title={pt ? 'Rotacionar. Shift encaixa a cada 15°. Esc cancela.' : 'Rotate. Shift snaps every 15°. Esc cancels.'} onPointerDown={e => begin(e, 'rotate')} onKeyDown={e => handleKey(e, 'rotate')}><svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.6 6A6.5 6.5 0 1 0 16 13M15.6 2v4H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        {radiusEnabled && selection.width * ratio > 64 && selection.height * ratio > 64 && CORNERS.map((corner, i) => {
          const [x, y] = ANCHOR_AXES[corner], r = cornerValue(i);
          const rx = active ? r * bounded(active.scaleX ?? 1, .05, 20) * ratio : r / 100 * selection.width * ratio / 2;
          const ry = active ? r * bounded(active.scaleY ?? 1, .05, 20) * ratio : r / 100 * selection.height * ratio / 2;
          const ix = Math.min(selection.width * ratio / 2 - 10, Math.max(16, rx)), iy = Math.min(selection.height * ratio / 2 - 10, Math.max(16, ry));
          const label = `${pt ? 'Arredondar' : 'Round'}: ${names[corner]}`;
          return <button key={corner} type="button" className="transform-corner" aria-label={label} title={label + (active?.media ? (pt ? '. Alt ajusta só este canto.' : '. Alt changes this corner only.') : active ? (pt ? '. Ajusta os cantos do fundo do texto.' : '. Changes the text backdrop corners.') : (pt ? '. Ajusta os cantos de todos os cartões do modelo.' : '. Changes every card in the model.'))} style={{ left: x < 0 ? ix : selection.width * ratio - ix, top: y < 0 ? iy : selection.height * ratio - iy }} onPointerDown={e => begin(e, 'radius', undefined, i)} onKeyDown={e => handleKey(e, 'radius', undefined, i)} />;
        })}
      </>}
    </div>}
    {drag.current && <div className="transform-gesture-hint" role="status">{pt ? 'Shift: proporção / 15° · Alt: centro / canto individual · Esc: cancelar' : 'Shift: aspect / 15° · Alt: center / individual corner · Esc: cancel'}</div>}
  </div>;
}
