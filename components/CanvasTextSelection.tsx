// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { useSceneStore, type SceneState } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { captionFontSize, textMotion, textFontRevision, type TextLayer } from '@/lib/textLayers';
import type { MotionTrack } from '@/lib/tracks';
import { getRendererInstance } from '@/lib/rendererInstance';
import { compositionOrder } from '@/lib/composition';
import { arrangeCompositionLayers, deleteCompositionLayers, duplicateCompositionLayers, layerDisplayName } from '@/lib/compositionActions';
import { compositionArrangeShortcut } from '@/lib/compositionShortcuts';
import { groupFrame, transformGroupMember } from '@/lib/groupTransform';
import { snapAlignment, type AlignBox } from '@/lib/alignment';
import { ANCHOR_AXES, RESIZE_ANCHORS, bounded, frameAABB, mapFramePoint, normalizedAngle, normalizedRadii, pointerRotation, resizeCursor, resizeFrame, rotatePoint, type ResizeAnchor, type TransformFrame, type TransformPoint } from '@/lib/transformGeometry';
import { modelPathOffset } from '@/lib/modelMotionPath';
import CanvasInlineTextEditor from './CanvasInlineTextEditor';
import {textBackdropBox} from '@/lib/textPadding';
import {addCompositionText,textToolShortcut} from '@/lib/textActions';
import {layoutText,boxLeft,anchorAlign} from '@/lib/textLayout';
import { tx } from '@/lib/tx';
import EditorRulers from './EditorRulers';
import { animatedLayer, keyedPatch } from '@/lib/keyframes';
import { isTextLayer, shapeRadii } from '@/lib/textLayers';
import { layerBounds as bounds, layerFrame } from '@/lib/layerBounds';

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
  originalSelection?: string[];
  members?: Gesture[];
  viewport?: { left: number; top: number; width: number; height: number; canvasWidth: number; canvasHeight: number };
}
const sameFrame = (a: TransformFrame, b: TransformFrame) => (Object.keys(a) as (keyof TransformFrame)[]).every(key => Math.abs(a[key] - b[key]) < .01);

type ArrangeKind = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'distribute-h' | 'distribute-v';
const ARRANGE: { kind: ArrangeKind; pt: string; en: string }[] = [
  { kind: 'left', pt: 'Alinhar à esquerda', en: 'Align left' }, { kind: 'hcenter', pt: 'Centralizar na horizontal', en: 'Align horizontal centers' },
  { kind: 'right', pt: 'Alinhar à direita', en: 'Align right' }, { kind: 'top', pt: 'Alinhar ao topo', en: 'Align top' },
  { kind: 'vcenter', pt: 'Centralizar na vertical', en: 'Align vertical centers' }, { kind: 'bottom', pt: 'Alinhar à base', en: 'Align bottom' },
  { kind: 'distribute-h', pt: 'Distribuir na horizontal (3 ou mais)', en: 'Distribute horizontally (3 or more)' }, { kind: 'distribute-v', pt: 'Distribuir na vertical (3 ou mais)', en: 'Distribute vertically (3 or more)' },
];
function ArrangeIcon({ kind }: { kind: ArrangeKind }) {
  const p = { stroke: 'currentColor', strokeWidth: 1.3, fill: 'none', strokeLinecap: 'round' as const };
  const shapes: Record<ArrangeKind, React.ReactNode> = {
    left: <><path d="M2.5 2v12" {...p}/><rect x="5" y="6" width="8" height="4" rx="1.2" {...p}/></>,
    hcenter: <><path d="M8 2v12" {...p}/><rect x="3.5" y="6" width="9" height="4" rx="1.2" {...p}/></>,
    right: <><path d="M13.5 2v12" {...p}/><rect x="3" y="6" width="8" height="4" rx="1.2" {...p}/></>,
    top: <><path d="M2 2.5h12" {...p}/><rect x="6" y="5" width="4" height="8" rx="1.2" {...p}/></>,
    vcenter: <><path d="M2 8h12" {...p}/><rect x="6" y="3.5" width="4" height="9" rx="1.2" {...p}/></>,
    bottom: <><path d="M2 13.5h12" {...p}/><rect x="6" y="3" width="4" height="8" rx="1.2" {...p}/></>,
    'distribute-h': <><path d="M2.5 2v12M13.5 2v12" {...p}/><rect x="6" y="5" width="4" height="6" rx="1.2" {...p}/></>,
    'distribute-v': <><path d="M2 2.5h12M2 13.5h12" {...p}/><rect x="5" y="6" width="6" height="4" rx="1.2" {...p}/></>,
  };
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{shapes[kind]}</svg>;
}
// Align or distribute the selection: one element aligns to the composition,
// several align to their shared bounds. Distribution keeps the outer elements
// in place and evens the gaps between them. Locked layers stay put.
function arrangeSelection(kind: ArrangeKind) {
  const s = useSceneStore.getState(), ids = useUIStore.getState().selectedLayerIds, seconds = s.frame / s.fps;
  type Item = { id: string; overlay?: TextLayer; track?: MotionTrack; box: { x: number; y: number; width: number; height: number } };
  const items = ids.flatMap((id): Item[] => {
    const overlay = s.textLayers.find((l) => l.id === id);
    if (overlay) return overlay.locked ? [] : [{ id, overlay, box: frameAABB(layerFrame(overlay, s.width, seconds)) }];
    const track = s.tracks.find((t) => t.id === id), frame = track && modelFrame(id);
    return track && frame ? [{ id, track, box: frameAABB(frame) }] : [];
  });
  if (!items.length || (kind.startsWith('distribute') && items.length < 3)) return;
  const x0 = Math.min(...items.map((i) => i.box.x)), y0 = Math.min(...items.map((i) => i.box.y));
  const ref = items.length === 1 ? { x: 0, y: 0, width: s.width, height: s.height } : { x: x0, y: y0, width: Math.max(...items.map((i) => i.box.x + i.box.width)) - x0, height: Math.max(...items.map((i) => i.box.y + i.box.height)) - y0 };
  const offsets = new Map<string, { dx: number; dy: number }>();
  if (kind === 'distribute-h' || kind === 'distribute-v') {
    const h = kind === 'distribute-h', key = h ? 'x' : 'y', size = h ? 'width' : 'height';
    const sorted = [...items].sort((a, b) => (a.box[key] + a.box[size] / 2) - (b.box[key] + b.box[size] / 2));
    const gap = (ref[size] - sorted.reduce((sum, i) => sum + i.box[size], 0)) / (sorted.length - 1);
    let cursor = ref[key];
    for (const item of sorted) { const d = cursor - item.box[key]; offsets.set(item.id, h ? { dx: d, dy: 0 } : { dx: 0, dy: d }); cursor += item.box[size] + gap; }
  } else for (const { id, box } of items) offsets.set(id, {
    dx: kind === 'left' ? ref.x - box.x : kind === 'hcenter' ? ref.x + ref.width / 2 - (box.x + box.width / 2) : kind === 'right' ? ref.x + ref.width - (box.x + box.width) : 0,
    dy: kind === 'top' ? ref.y - box.y : kind === 'vcenter' ? ref.y + ref.height / 2 - (box.y + box.height / 2) : kind === 'bottom' ? ref.y + ref.height - (box.y + box.height) : 0,
  });
  const history = useHistoryStore.getState(); history.beginGesture();
  for (const item of items) {
    const o = offsets.get(item.id); if (!o || (Math.abs(o.dx) < .01 && Math.abs(o.dy) < .01)) continue;
    if (item.overlay) { const now = animatedLayer(item.overlay, seconds); s.patchTextLayer(item.id, keyedPatch(item.overlay, { x: now.x + o.dx, y: now.y + o.dy }, seconds)); }
    else if (item.track) s.patchTrack(item.id, { transform: { ...item.track.transform, x: item.track.transform.x + o.dx, y: item.track.transform.y + o.dy } });
  }
  history.endGesture();
}
export default function CanvasTextSelection() {
  const root = useRef<HTMLDivElement>(null), drag = useRef<Gesture | null>(null);
  const layers = useSceneStore(s => s.textLayers), tracks = useSceneStore(s => s.tracks);
  const width = useSceneStore(s => s.width), height = useSceneStore(s => s.height), frame = useSceneStore(s => s.frame), fps = useSceneStore(s => s.fps);
  const selected = useUIStore(s => s.selectedTextId), selectedMotion = useUIStore(s => s.selectedMotionId), show = useUIStore(s => s.showSelectionBox);
  const selectedIds = useUIStore(s => s.selectedLayerIds);
  const canvasTools = useUIStore(s => s.showCanvasTools), arrangeTools = useUIStore(s => s.showArrangeTools);
  const rulers = useUIStore(s => s.showRulers), guides = useUIStore(s => s.smartGuides), snap = useUIStore(s => s.snapEnabled), pt = useUIStore(s => s.locale) === 'pt';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [textTool,setTextTool]=useState(false),textToolRef=useRef(false);
  const [rotationReadout, setRotationReadout] = useState<{x:number;y:number;angle:number} | null>(null);
  const [groupTransform, setGroupTransform] = useState<TransformFrame | null>(null);
  const [guide, setGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [rect, setRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [renderedModels, setRenderedModels] = useState<Record<string, TransformFrame>>({});
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
    window.addEventListener('motion-preview-view', measure);
    measure(); return () => { resize.disconnect(); mutation.disconnect(); window.removeEventListener('motion-preview-view', measure); };
  }, [width, height]);
  useEffect(() => {
    const update = () => {
      const revision = textFontRevision(); if (revision !== fontVersion.current) { fontVersion.current = revision; setFontVersion(revision); }
      const s = useSceneStore.getState(), next: Record<string, TransformFrame> = {};
      for (const id of useUIStore.getState().selectedLayerIds) {
        if (!s.tracks.some(t => t.id === id && t.visible)) continue;
        const box = modelFrame(id);
        if (box && Object.values(box).every(Number.isFinite) && box.width > 0 && box.height > 0) next[id] = box;
      }
      setRenderedModels(prev => Object.keys(prev).length === Object.keys(next).length && Object.keys(next).every(id => prev[id] && sameFrame(prev[id], next[id])) ? prev : next);
    };
    window.addEventListener('motion-preview-rendered', update); update();
    return () => window.removeEventListener('motion-preview-rendered', update);
  }, [selectedIds]);
  const finish = (cancel = false) => {
    const d = drag.current; if (!d) return;
    drag.current = null; setRotationReadout(null); setGroupTransform(null);
    if (cancel) {
      const s = useSceneStore.getState();
      if (d.duplicateBaseline) {
        useSceneStore.setState(d.duplicateBaseline);
        useUIStore.getState().setLayerSelection(d.originalSelection ?? [d.originalId!], d.originalId, d.overlay ? 'overlay' : 'motion');
      } else for (const member of d.members ?? [d]) {
        if (member.overlay) s.patchTextLayer(member.id, member.overlay);
        else if (member.track) s.patchTrack(member.id, { transform: member.track.transform, values: member.track.values });
      }
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
      if(drag.current)return;
      if(textToolShortcut(e)){e.preventDefault();e.stopImmediatePropagation();textToolRef.current=true;setTextTool(true);window.dispatchEvent(new Event('motion-text-tool'));return;}
      if(e.key==='Escape'&&textToolRef.current){e.preventDefault();e.stopImmediatePropagation();textToolRef.current=false;setTextTool(false);return;}
      const ui = useUIStore.getState(), ids = ui.selectedLayerIds;
      const arrange=compositionArrangeShortcut(e);
      if(arrange&&ids.length){e.preventDefault();e.stopImmediatePropagation();arrangeCompositionLayers(ids,arrange);}
      else if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'd' && ids.length) { e.preventDefault(); e.stopImmediatePropagation(); duplicateCompositionLayers(ids); }
      else if (['Backspace', 'Delete'].includes(e.key) && ids.length) { e.preventDefault(); if (!e.repeat) void deleteCompositionLayers(ids); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && (e.target as HTMLElement).closest('.canvas-selection,.tl-lanes,.layers-panel')) {
        e.preventDefault(); const s = useSceneStore.getState(); ui.setLayerSelection(compositionOrder(s.tracks, s.textLayers).map(l => l.id));
      }
    };
    const blur = () => finishRef.current();
    const navigation = () => finishRef.current(true);
    const selectionTool=()=>{textToolRef.current=false;setTextTool(false);};
    window.addEventListener('motion-selection-tool',selectionTool);
    window.addEventListener('motion-preview-navigation', navigation);
    window.addEventListener('keydown', key, true); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('motion-selection-tool',selectionTool); window.removeEventListener('motion-preview-navigation', navigation); window.removeEventListener('keydown', key, true); window.removeEventListener('blur', blur); finishRef.current(); };
  }, []);
  const active = layers.find(l => l.id === selected && l.visible && seconds >= l.start && seconds < l.end), track = tracks.find(t => t.id === selectedMotion);
  const selectedFrames = selectedIds.map(id => {
    const l = layers.find(l => l.id === id && l.visible && seconds >= l.start && seconds < l.end);
    return l ? layerFrame(l, width, seconds) : renderedModels[id];
  }).filter((f): f is TransformFrame => !!f);
  const selection = groupTransform ?? (selectedFrames.length > 1 ? groupFrame(selectedFrames) : selectedFrames[0] ?? null);
  const viewport = () => { const r = root.current!.getBoundingClientRect(); return { left: r.x + rect.x, top: r.y + rect.y, width: rect.width, height: rect.height, canvasWidth: width, canvasHeight: height }; };
  const point = (e: PointerEvent) => { const r = drag.current?.viewport ?? viewport(); return { x: (e.clientX - r.left) * r.canvasWidth / r.width, y: (e.clientY - r.top) * r.canvasHeight / r.height }; };
  const singleSnapshot = (kind: Operation, start: TransformPoint, id?: string): Gesture | null => {
    const s = useSceneStore.getState(), ui = useUIStore.getState();
    const overlay = s.textLayers.find(l => l.id === (id ?? ui.selectedTextId)), model = s.tracks.find(t => t.id === (id ?? ui.selectedMotionId));
    if (overlay?.locked) return null;
    const box = overlay ? layerFrame(overlay, s.width, s.frame / s.fps) : model ? modelFrame(model.id) : null;
    return box && box.width > 0 && box.height > 0 ? { id: overlay?.id ?? model!.id, kind, start, frame: box, overlay: overlay && animatedLayer(overlay, s.frame / s.fps), track: overlay ? undefined : model } : null;
  };
  const snapshot = (kind: Operation, start: TransformPoint, id?: string): Gesture | null => {
    const ids = useUIStore.getState().selectedLayerIds;
    if (ids.length < 2) return singleSnapshot(kind, start, id ?? ids[0]);
    const s = useSceneStore.getState();
    const members = ids.filter(id => s.textLayers.some(l => l.id === id && l.visible && seconds >= l.start && seconds < l.end) || s.tracks.some(t => t.id === id && t.visible))
      .map(id => singleSnapshot(kind, start, id)).filter((d): d is Gesture => !!d);
    const box = groupFrame(members.map(d => d.frame));
    return box && members.length ? { ...members[0], kind, start, frame: box, members } : null;
  };
  const patchFrame = (d: Gesture, next: TransformFrame, grouped = false) => {
    if (d.members) { setGroupTransform(next); for (const member of d.members) patchFrame(member, transformGroupMember(member.frame, d.frame, next), true); return; }
    const s = useSceneStore.getState(), motion = d.overlay ? textMotion(d.overlay, s.frame / s.fps) : {x:0,y:0,rotation:0,scale:1}, motionY=motion.y;
    const path = d.track ? modelPathOffset(d.track, s.frame, s.fps, width, height) : { x: 0, y: 0 };
    const origin = d.overlay ? { x: d.overlay.x+motion.x, y: d.overlay.y + motionY } : { x: width / 2 + d.track!.transform.x + path.x, y: height / 2 + d.track!.transform.y + path.y };
    const p = mapFramePoint(origin, d.frame, next);
    if (d.overlay) {
      const l = d.overlay, sx = bounded(l.scaleX ?? 1, .05, 20), sy = bounded(l.scaleY ?? 1, .05, 20);
      const patch: Partial<TextLayer> = { x: p.x-motion.x, y: p.y - motionY, rotation: next.rotation-motion.rotation };
      if (l.media) patch.media = { ...l.media, width: next.width / sx / motion.scale, height: next.height / sy / motion.scale };
      else if (l.shape) patch.shape = { ...l.shape, width: next.width / sx / motion.scale, height: l.shape.kind === 'line' ? l.shape.height : next.height / sy / motion.scale };
      else if ((l.boxWidth ?? 0) > 0 && !grouped && d.kind === 'resize') patch.boxWidth = Math.max(20, Math.min(8000, Math.round(next.width / sx / motion.scale)));
      else { patch.scaleX = sx * next.width / d.frame.width; patch.scaleY = sy * next.height / d.frame.height; }
      const stored = s.textLayers.find(l => l.id === d.id);
      s.patchTextLayer(d.id, stored ? keyedPatch(stored, patch, s.frame / s.fps) : patch);
    } else {
      const t = d.track!;
      s.patchTrack(d.id, { transform: { ...t.transform, x: p.x - width / 2 - path.x, y: p.y - height / 2 - path.y, scale: t.transform.scale * next.width / d.frame.width, rotation: normalizedAngle(t.transform.rotation + next.rotation - d.frame.rotation) } });
    }
  };
  const apply = (d: Gesture, p: TransformPoint, shift: boolean, alt: boolean, snapOff = false) => {
    const s = useSceneStore.getState(), delta = { x: p.x - d.start.x, y: p.y - d.start.y };
    if (d.kind === 'rotate') {
      const initial = d.members ? d.frame.rotation : d.overlay?.rotation ?? d.track!.transform.rotation, rotation = pointerRotation(d.frame, d.start, p, initial, shift);
      patchFrame(d, { ...d.frame, rotation: d.frame.rotation + normalizedAngle(rotation - initial) });
      setRotationReadout({x:rect.x+p.x*ratio+18,y:rect.y+p.y*ratio+18,angle:rotation}); return;
    }
    if (d.kind === 'radius') {
      const i = d.corner!, [x, y] = ANCHOR_AXES[CORNERS[i]], local = rotatePoint(delta, -d.frame.rotation);
      if (d.overlay) {
        const l = d.overlay, b = bounds(l, width), sx = bounded(l.scaleX ?? 1, .05, 20), sy = bounded(l.scaleY ?? 1, .05, 20);
        const initial = l.backdropRadius ?? 12;
        const radii = normalizedRadii(b.width, b.height, l.media?.cornerRadii ?? (l.media ? [0, 0, 0, 0] : [initial, initial, initial, initial]));
        const r = bounded(radii[i] + (-x * local.x / sx - y * local.y / sy) / 2, 0, Math.min(b.width, b.height) / 2);
        if (l.media) { const next = alt ? [...radii] as typeof radii : [r, r, r, r] as typeof radii; next[i] = r; s.patchTextLayer(d.id, { media: { ...l.media, cornerRadii: next } }); }
        else if (l.shape) { const current = shapeRadii(l.shape), value = bounded(current[i] + (-x * local.x / sx - y * local.y / sy) / 2, 0, Math.min(b.width, b.height) / 2), next = alt ? [...current] as typeof current : [value, value, value, value] as typeof current; next[i] = value; s.patchTextLayer(d.id, { shape: { ...l.shape, cornerRadii: next } }); }
        else s.patchTextLayer(d.id, { backdropRadius: r });
      } else {
        const r = bounded(Number(d.track!.values.cornerRadius ?? 0) + (-x * local.x - y * local.y) * 100 / Math.max(1, Math.min(d.frame.width, d.frame.height)), 0, 100);
        s.patchTrack(d.id, { values: { ...d.track!.values, cornerRadius: r } });
      }
      return;
    }
    const excluded = (d.members ?? [d]).map(m => m.id);
    const targets: AlignBox[] = [{ x: 0, y: 0, width, height }, ...s.textLayers.filter(l => !excluded.includes(l.id) && l.visible && seconds >= l.start && seconds < l.end).map(l => frameAABB(layerFrame(l, width, seconds))), ...s.tracks.filter(t => !excluded.includes(t.id) && t.visible).map(t => getRendererInstance()?.selectionBounds?.(t.id)).filter((b): b is AlignBox => !!b)];
    const box = frameAABB(d.frame);
    const match = snapAlignment(d.kind === 'move' ? { ...box, x: box.x + delta.x, y: box.y + delta.y } : { x: p.x, y: p.y, width: 0, height: 0 }, targets, 6 / Math.max(.01, ratio), s.guides);
    if (snap && !alt && !snapOff) { delta.x += match.dx; delta.y += match.dy; }
    setGuide(guides && !alt && !snapOff ? { x: match.x, y: match.y } : { x: null, y: null });
    if (d.kind === 'move') {
      if (shift) { if (Math.abs(delta.x) > Math.abs(delta.y)) delta.y = 0; else delta.x = 0; }
      patchFrame(d, { ...d.frame, cx: d.frame.cx + delta.x, cy: d.frame.cy + delta.y }); return;
    }
    const l = d.overlay, t = d.track;
    if (d.members) {
      const minScale = Math.max(...d.members.map(m => m.track ? .1 / m.track.transform.scale : m.overlay?.media ? 1 / Math.min(m.frame.width, m.frame.height) : .05 / Math.min(m.overlay?.scaleX ?? 1, m.overlay?.scaleY ?? 1)));
      const maxScale = Math.min(...d.members.map(m => m.track ? 3 / m.track.transform.scale : m.overlay?.media ? 4000 / Math.max(m.frame.width, m.frame.height) : 20 / Math.max(m.overlay?.scaleX ?? 1, m.overlay?.scaleY ?? 1)));
      patchFrame(d, resizeFrame(d.frame, delta, d.anchor!, { minWidth: d.frame.width * minScale, minHeight: d.frame.height * minScale, maxWidth: d.frame.width * maxScale, maxHeight: d.frame.height * maxScale, proportional: true, centered: alt })); return;
    }
    // A fixed-width text box only gets wider or narrower; its lines rewrap.
    if (l && isTextLayer(l) && (l.boxWidth ?? 0) > 0) {
      const local = rotatePoint(delta, -d.frame.rotation), along = rotatePoint({ x: local.x, y: 0 }, d.frame.rotation);
      patchFrame(d, resizeFrame(d.frame, along, d.anchor!, { minWidth: 20, minHeight: 1, maxWidth: 8000, maxHeight: 8000, proportional: false, centered: alt })); return;
    }
    const limits = t ? { minWidth: d.frame.width * .1 / t.transform.scale, minHeight: d.frame.height * .1 / t.transform.scale, maxWidth: d.frame.width * 3 / t.transform.scale, maxHeight: d.frame.height * 3 / t.transform.scale }
      : l!.media || l!.shape ? { minWidth: 1, minHeight: 1, maxWidth: 8000, maxHeight: 8000 }
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
      const initial = d.members ? d.frame.rotation : d.overlay?.rotation ?? d.track!.transform.rotation, rotation = normalizedAngle(initial + (positive ? 1 : -1) * (e.shiftKey ? 15 : 1));
      patchFrame(d, { ...d.frame, rotation: d.frame.rotation + normalizedAngle(rotation - initial) });
    } else {
      let delta = { x: e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0, y: e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0 };
      if (kind === 'radius') { const [x, y] = ANCHOR_AXES[CORNERS[corner!]]; delta = rotatePoint({ x: -x * (positive ? step : -step), y: -y * (positive ? step : -step) }, d.frame.rotation); }
      apply(d, { x: start.x + delta.x, y: start.y + delta.y }, e.shiftKey, e.altKey, true);
    }
    useHistoryStore.getState().endGesture(); setGroupTransform(null); setGuide({ x: null, y: null });
  };
  const names: Record<ResizeAnchor, string> = pt ? { nw: 'canto superior esquerdo', n: 'borda superior', ne: 'canto superior direito', e: 'borda direita', se: 'canto inferior direito', s: 'borda inferior', sw: 'canto inferior esquerdo', w: 'borda esquerda' } : { nw: 'top left corner', n: 'top edge', ne: 'top right corner', e: 'right edge', se: 'bottom right corner', s: 'bottom edge', sw: 'bottom left corner', w: 'left edge' };
  const fixedText = selectedIds.length === 1 && !!active && isTextLayer(active) && (active.boxWidth ?? 0) > 0;
  const radiusEnabled = selectedIds.length === 1 && !!(active?.media || active?.backdrop || active?.shape?.kind === 'rect' || track && !active);
  const cornerValue = (i: number) => active ? active.media ? normalizedRadii(active.media.width, active.media.height, active.media.cornerRadii)[i] : active.shape ? shapeRadii(active.shape)[i] : active.backdropRadius ?? 12 : Number(track?.values.cornerRadius ?? 0);
  const editingLayer = layers.find(l => l.id === editingId && isTextLayer(l));
  const editFrame = editingLayer ? layerFrame(editingLayer,width,seconds) : null;
  return <div ref={root} className={`canvas-selection${textTool?' canvas-text-tool':''}${rulers?' rulers-on':''}`} tabIndex={-1} onPointerDown={e => {
    if (e.button !== 0 || !rect.width || drag.current || (e.target as HTMLElement).closest('.canvas-inline-text')) return;
    const p = point(e), s = useSceneStore.getState(), order = compositionOrder(tracks, layers);
    const hit = [...order].reverse().filter(l => l.kind === 'overlay').map(item => layers.find(l => l.id === item.id)!).find(l => {
      if (!l.visible || l.opacity < .02 || seconds < l.start || seconds >= l.end) return false;
      const f = layerFrame(l, width, seconds), local = rotatePoint({ x: p.x - f.cx, y: p.y - f.cy }, -f.rotation);
      return Math.abs(local.x) <= f.width / 2 + 6 / Math.max(.01, ratio) && Math.abs(local.y) <= f.height / 2 + 6 / Math.max(.01, ratio);
    });
    const modelId = getRendererInstance()?.hitTest?.(p.x, p.y), id = modelId && (!hit || order.findIndex(l => l.id === modelId) > order.findIndex(l => l.id === hit.id)) ? modelId : hit?.id;
    if(textToolRef.current){
      e.preventDefault();e.stopPropagation();
      const existing=hit&&hit.id===id&&isTextLayer(hit)&&!hit.locked?hit:null;
      const textId=existing?.id??addCompositionText(p);
      if(textId){s.setPlaying(false);useUIStore.getState().selectText(textId);textToolRef.current=false;setTextTool(false);setEditingId(textId);}return;
    }
    const ui = useUIStore.getState();
    if (id) {
      ui.selectLayer(id, id === modelId ? 'motion' : 'overlay', e.shiftKey, !e.shiftKey, 'canvas');
      if (id === modelId) { const t = s.tracks.find(t => t.id === id); if (t) useSceneStore.setState({ activeTrackId: id, activeTemplateId: t.templateId, values: t.values, easing: t.easing }); }
    } else if (!e.shiftKey) ui.setLayerSelection([]);
    if (e.shiftKey) { e.preventDefault(); return; }
    if (!id || hit?.id === id && hit.locked) return;
    const d = snapshot('move', p, id); if (!d) return;
    e.currentTarget.focus({ preventScroll: true });
    s.setPlaying(false); useHistoryStore.getState().beginGesture();
    drag.current = { ...d, pointerId: e.pointerId, duplicatePending: e.altKey, viewport: viewport() }; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
  }} onDoubleClick={e => {
    if (!rect.width || root.current?.parentElement?.classList.contains('preview-loupe')) return;
    const v=viewport(), p={x:(e.clientX-v.left)*width/v.width,y:(e.clientY-v.top)*height/v.height};
    const order=compositionOrder(tracks,layers);
    const hit=[...order].reverse().filter(item=>item.kind==='overlay').map(item=>layers.find(l=>l.id===item.id)!).find(l=>{
      if(!l.visible || l.opacity<.02 || seconds<l.start || seconds>=l.end)return false;
      const f=layerFrame(l,width,seconds), local=rotatePoint({x:p.x-f.cx,y:p.y-f.cy},-f.rotation);
      return Math.abs(local.x)<=f.width/2 && Math.abs(local.y)<=f.height/2;
    });
    const model=getRendererInstance()?.hitTest?.(p.x,p.y);
    if(!hit || !isTextLayer(hit) || hit.locked || model && order.findIndex(l=>l.id===model)>order.findIndex(l=>l.id===hit.id))return;
    e.preventDefault(); finish(); useSceneStore.getState().setPlaying(false); useUIStore.getState().selectText(hit.id); setEditingId(hit.id);
  }} onPointerMove={e => {
    let d = drag.current; if (!d) return;
    const p = point(e);
    if (d.duplicatePending) {
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) * ratio < 3) return;
      const s = useSceneStore.getState();
      const baseline = { tracks: s.tracks, textLayers: s.textLayers, activeTrackId: s.activeTrackId, activeTemplateId: s.activeTemplateId, values: s.values, easing: s.easing, compositeMode: s.compositeMode };
      const members = d.members ?? [d], originals = members.map(m => m.id);
      const ordered = compositionOrder(s.tracks, s.textLayers).filter(l => originals.includes(l.id));
      const copies = duplicateCompositionLayers(originals, 0, false); if (copies.length !== members.length) return;
      const copyMap = new Map(ordered.map((l, i) => [l.id, copies[i]]));
      const copyId = copyMap.get(d.id)!;
      const next = useSceneStore.getState();
      const copyMember = (m: Gesture): Gesture => ({ ...m, id: copyMap.get(m.id)!, overlay: m.overlay ? next.textLayers.find(l => l.id === copyMap.get(m.id)) : undefined, track: m.track ? next.tracks.find(t => t.id === copyMap.get(m.id)) : undefined });
      d = { ...copyMember(d), originalId: d.id, originalSelection: originals, duplicatePending: false, duplicateBaseline: baseline, members: d.members?.map(copyMember) };
      drag.current = d;
    }
    apply(d, p, e.shiftKey, e.altKey);
  }} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish()}>
    {canvasTools&&<div className="alignment-toolbar" onPointerDown={e=>e.stopPropagation()}>{([['showRulers',tx(pt, 'Réguas', 'Rulers'),tx(pt, 'Exibe réguas em pixels nas bordas da composição.', 'Show pixel rulers at the edges of the composition.')],['smartGuides',tx(pt, 'Guias', 'Guides'),tx(pt, 'Mostra linhas de alinhamento ao mover ou redimensionar elementos.', 'Show alignment guides while moving or resizing elements.')],['snapEnabled',tx(pt, 'Encaixar', 'Snap'),tx(pt, 'Encaixa elementos nas bordas e centros próximos. Alt suspende o encaixe durante o arraste.', 'Snap elements to nearby edges and centers. Alt temporarily disables snapping.')]] as const).map(([key,label,help])=><button key={key} title={help} aria-label={`${label}: ${help}`} aria-pressed={key==='showRulers'?rulers:key==='smartGuides'?guides:snap} onClick={()=>useUIStore.getState().setAlignmentOption(key,!(key==='showRulers'?rulers:key==='smartGuides'?guides:snap))}>{label}</button>)}<button title={tx(pt, 'Mostra ou oculta a caixa delimitadora e as alças de transformação da seleção.', 'Show or hide the selection bounding box and transform handles.')} aria-label="BBox" aria-pressed={show} onClick={()=>useUIStore.getState().setShowSelectionBox(!show)}>BBox</button></div>}
    {arrangeTools&&selectedIds.length>0&&<div className={`arrange-toolbar ${canvasTools?'':'solo'}`} role="toolbar" aria-label={tx(pt,'Alinhar e distribuir','Align and distribute')} onPointerDown={e=>e.stopPropagation()}>{ARRANGE.map((item,index)=><span key={item.kind} className="arrange-slot">{index===6&&<span className="alignment-sep" aria-hidden="true"/>}<button className="arrange-btn" disabled={item.kind.startsWith('distribute')&&selectedIds.length<3} title={tx(pt,item.pt,item.en)} aria-label={tx(pt,item.pt,item.en)} onClick={()=>arrangeSelection(item.kind)}><ArrangeIcon kind={item.kind}/></button></span>)}</div>}
    <EditorRulers root={root} rect={rect} width={width} height={height} rulers={rulers} pt={pt}/>
    {(guide.x!==null||guide.y!==null)&&<svg className="editor-guides">{guide.x!==null&&<line x1={rect.x+guide.x/width*rect.width} x2={rect.x+guide.x/width*rect.width} y1={rect.y} y2={rect.y+rect.height}/>} {guide.y!==null&&<line y1={rect.y+guide.y/height*rect.height} y2={rect.y+guide.y/height*rect.height} x1={rect.x} x2={rect.x+rect.width}/>}</svg>}

    {show && !textTool && !editingLayer && selection && ratio > 0 && <div className="canvas-selection-box transform-selection" role="group" aria-label={tx(pt, 'Transformar camada selecionada', 'Transform selected layer')} style={{ left: rect.x + selection.cx / width * rect.width, top: rect.y + selection.cy / height * rect.height, width: selection.width * ratio, height: selection.height * ratio, transform: `translate(-50%, -50%) rotate(${selection.rotation}deg)` }}>
      <span className="canvas-selection-label">{selectedIds.length > 1 ? `${selectedIds.length} ${tx(pt, 'camadas', 'layers')}` : active?.text.slice(0, 30) || layerDisplayName(track?.name ?? '', pt)}{active?.locked ? ' 🔒' : ''}</span>
      {(!active?.locked || selectedIds.length > 1) && <>
        {RESIZE_ANCHORS.filter(anchor => !(fixedText && (anchor === 'n' || anchor === 's'))).map(anchor => { const [x, y] = ANCHOR_AXES[anchor]; const label = `${tx(pt, 'Redimensionar', 'Resize')}: ${names[anchor]}`; return <button key={anchor} type="button" className="transform-handle" aria-label={label} title={label + (tx(pt, '. Shift mantém proporção; Alt redimensiona pelo centro.', '. Shift preserves aspect; Alt scales from the center.'))} style={{ left: `${(x + 1) * 50}%`, top: `${(y + 1) * 50}%`, cursor: resizeCursor(anchor, selection.rotation) }} onPointerDown={e => begin(e, 'resize', anchor)} onKeyDown={e => handleKey(e, 'resize', anchor)} />; })}
        {RESIZE_ANCHORS.map(anchor=>{const [x,y]=ANCHOR_AXES[anchor]; return <button key={`rotate-${anchor}`} type="button" className="transform-rotate-zone" aria-label={`${tx(pt, 'Rotacionar', 'Rotate')}: ${names[anchor]}`} title={tx(pt, 'Arraste por fora da alça para girar. Shift: 15°. Esc: cancelar.', 'Drag outside the handle to rotate. Shift: 15°. Esc: cancel.')} style={{left:`calc(${(x+1)*50}% + ${x*18}px)`,top:`calc(${(y+1)*50}% + ${y*18}px)`}} onPointerDown={e=>begin(e,'rotate')} onKeyDown={e=>handleKey(e,'rotate')}/>;})}
        {radiusEnabled && selection.width * ratio > 64 && selection.height * ratio > 64 && CORNERS.map((corner, i) => {
          const [x, y] = ANCHOR_AXES[corner], r = cornerValue(i);
          const rx = active ? r * bounded(active.scaleX ?? 1, .05, 20) * ratio : r / 100 * selection.width * ratio / 2;
          const ry = active ? r * bounded(active.scaleY ?? 1, .05, 20) * ratio : r / 100 * selection.height * ratio / 2;
          const ix = Math.min(selection.width * ratio / 2 - 10, Math.max(16, rx)), iy = Math.min(selection.height * ratio / 2 - 10, Math.max(16, ry));
          const label = `${tx(pt, 'Arredondar', 'Round')}: ${names[corner]}`;
          return <button key={corner} type="button" className="transform-corner" aria-label={label} title={label + (active?.media || active?.shape ? (tx(pt, '. Alt ajusta só este canto.', '. Alt changes this corner only.')) : active ? (tx(pt, '. Ajusta os cantos do fundo do texto.', '. Changes the text backdrop corners.')) : (tx(pt, '. Ajusta os cantos de todos os cartões do modelo.', '. Changes every card in the model.')))} style={{ left: x < 0 ? ix : selection.width * ratio - ix, top: y < 0 ? iy : selection.height * ratio - iy }} onPointerDown={e => begin(e, 'radius', undefined, i)} onKeyDown={e => handleKey(e, 'radius', undefined, i)} />;
        })}
      </>}
    </div>}
    {editingLayer && editFrame && ratio>0 && <CanvasInlineTextEditor key={editingLayer.id} layer={editingLayer} left={rect.x+editFrame.cx*ratio} top={rect.y+editFrame.cy*ratio} width={editFrame.width*ratio} height={editFrame.height*ratio} ratio={ratio} pt={pt} onDone={()=>setEditingId(null)}/>}
    {rotationReadout && <output className="transform-angle-readout" style={{left:rotationReadout.x,top:rotationReadout.y}}>{((rotationReadout.angle%360+360)%360).toFixed(1)}°</output>}
    {drag.current && <div className="transform-gesture-hint" role="status">{tx(pt, 'Shift: proporção / 15° · Alt: centro / canto individual · Esc: cancelar', 'Shift: aspect / 15° · Alt: center / individual corner · Esc: cancel')}</div>}
  </div>;
}
