'use client';
import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { textMotion, textFontRevision, type TextLayer } from '@/lib/textLayers';
import { getRendererInstance } from '@/lib/rendererInstance';
import { compositionOrder } from '@/lib/composition';
import { deleteCompositionLayer } from '@/lib/compositionActions';
import { snapAlignment, type AlignBox } from '@/lib/alignment';

let measureContext: CanvasRenderingContext2D | null = null;
const measuredBounds=new WeakMap<TextLayer,{revision:number;box:{width:number;height:number;left:number}}>();
function bounds(layer: TextLayer) {
  if (layer.media) return { width: layer.media.width, height: layer.media.height, left: -layer.media.width / 2 };
  const cached=measuredBounds.get(layer),revision=textFontRevision();if(cached?.revision===revision)return cached.box;
  const ctx = measureContext ??= document.createElement('canvas').getContext('2d')!;
  ctx.font = `${layer.weight} ${layer.size}px "${layer.font}", sans-serif`;
  const lines = layer.text.split('\n');
  const width = Math.max(20, ...lines.map((line) => ctx.measureText(line).width + Math.max(0, [...line].length - 1) * (layer.letterSpacing ?? 0)));
  const box = { width, height: lines.length * layer.size * layer.lineHeight, left: layer.align === 'left' ? 0 : layer.align === 'right' ? -width : -width / 2 };
  measuredBounds.set(layer,{revision,box});
  return box;
}

export default function CanvasTextSelection() {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; model?: boolean; x: number; y: number; startX: number; startY: number; box: AlignBox } | null>(null);
  const layers = useSceneStore((s) => s.textLayers);
  const width = useSceneStore((s) => s.width), height = useSceneStore((s) => s.height);
  const frame = useSceneStore((s) => s.frame), fps = useSceneStore((s) => s.fps);
  const selected = useUIStore((s) => s.selectedTextId), show = useUIStore((s) => s.showSelectionBox);
  const selectedMotion = useUIStore((s) => s.selectedMotionId);
  const tracks = useSceneStore((s) => s.tracks);
  const rulers=useUIStore(s=>s.showRulers), guides=useUIStore(s=>s.smartGuides), snap=useUIStore(s=>s.snapEnabled),pt=useUIStore(s=>s.locale)==='pt';
  const [guide,setGuide]=useState<{x:number|null;y:number|null}>({x:null,y:null});
  const worldBox=(layer:TextLayer):AlignBox=>{const b=bounds(layer),a=layer.rotation*Math.PI/180,w=Math.abs(Math.cos(a)*b.width)+Math.abs(Math.sin(a)*b.height),h=Math.abs(Math.sin(a)*b.width)+Math.abs(Math.cos(a)*b.height),cx=layer.x+(b.left+b.width/2)*Math.cos(a),cy=layer.y+(b.left+b.width/2)*Math.sin(a);return{x:cx-w/2,y:cy-h/2,width:w,height:h};};
  const [rect, setRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  useEffect(() => {
    const parent = root.current?.parentElement; if (!parent) return;
    const measure = () => {
      const canvas = [...parent.querySelectorAll('canvas.stage-canvas')].find((c) => getComputedStyle(c).display !== 'none'); if (!canvas) return;
      const a = canvas.getBoundingClientRect(), b = parent.getBoundingClientRect();
      setRect({ x: a.x - b.x, y: a.y - b.y, width: a.width, height: a.height });
    };
    const resize = new ResizeObserver(measure); resize.observe(parent);
    const mutation = new MutationObserver(measure); mutation.observe(parent, { childList: true });
    measure(); return () => { resize.disconnect(); mutation.disconnect(); };
  }, [width, height]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !['Backspace', 'Delete'].includes(e.key) || useUIStore.getState().settingsOpen || document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable=true]')) return;
      const ui = useUIStore.getState(), id = ui.selectedTextId ?? ui.selectedMotionId; if (!id) return;
      e.preventDefault();
      deleteCompositionLayer(id);
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  const active = layers.find((l) => l.id === selected && l.visible && frame / fps >= l.start && frame / fps < l.end);
  const box = active ? bounds(active) : null;
  const modelBox = selectedMotion ? getRendererInstance()?.selectionBounds?.(selectedMotion) : null;
  const point = (e: React.PointerEvent) => { const r = root.current!.getBoundingClientRect(); return { x: (e.clientX - r.x - rect.x) * width / rect.width, y: (e.clientY - r.y - rect.y) * height / rect.height }; };
  return <div ref={root} className="canvas-selection" onPointerDown={(e) => {
    if (e.button !== 0 || !rect.width) return;
    const p = point(e), seconds = frame / fps;
    const order = compositionOrder(tracks, layers);
    const hit = order.filter((l) => l.kind === 'overlay').reverse().map((item) => layers.find((l) => l.id === item.id)!).find((l) => {
      if (!l.visible || l.opacity < .02 || seconds < l.start || seconds >= l.end) return false;
      const b = bounds(l), angle = -l.rotation * Math.PI / 180;
      const dx = p.x - l.x, dy = p.y - l.y - textMotion(l, seconds).y;
      const x = dx * Math.cos(angle) - dy * Math.sin(angle), y = dx * Math.sin(angle) + dy * Math.cos(angle);
      return x >= b.left - 8 && x <= b.left + b.width + 8 && Math.abs(y) <= b.height / 2 + 8;
    });
    const modelId = getRendererInstance()?.hitTest?.(p.x, p.y);
    if (modelId && (!hit || order.findIndex((l) => l.id === modelId) > order.findIndex((l) => l.id === hit.id))) {
      const s = useSceneStore.getState(), track = s.tracks.find((l) => l.id === modelId)!;
      useUIStore.getState().selectMotion(modelId); s.setActiveTrack(modelId); s.setPlaying(false);
      drag.current = { id: modelId, model: true, x: track.transform.x, y: track.transform.y, startX: p.x, startY: p.y, box:getRendererInstance()?.selectionBounds?.(modelId)??{x:track.transform.x,y:track.transform.y,width:0,height:0} };
      e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    useUIStore.getState().selectText(hit?.id ?? null);
    if (!hit || hit.locked) return;
    useSceneStore.getState().setPlaying(false);
    drag.current = { id: hit.id, x: hit.x, y: hit.y, startX: p.x, startY: p.y, box:worldBox(hit) };
    e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
  }} onPointerMove={(e) => {
    const d=drag.current;if(!d)return;const p=point(e),s=useSceneStore.getState();let dx=p.x-d.startX,dy=p.y-d.startY;
    const targets:AlignBox[]=[{x:0,y:0,width,height},...layers.filter(l=>l.id!==d.id&&l.visible&&frame/fps>=l.start&&frame/fps<l.end).map(worldBox),...tracks.filter(t=>t.id!==d.id&&t.visible).map(t=>getRendererInstance()?.selectionBounds?.(t.id)).filter((b):b is AlignBox=>!!b)];
    const match=snapAlignment({...d.box,x:d.box.x+dx,y:d.box.y+dy},targets,6*width/Math.max(1,rect.width));
    if(!e.altKey&&snap){dx+=match.dx;dy+=match.dy;}if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
    setGuide(guides&&!e.altKey?{x:match.x,y:match.y}:{x:null,y:null});
    const x=Math.round(d.x+dx),y=Math.round(d.y+dy);if(d.model){const t=s.tracks.find(l=>l.id===d.id);if(t)s.patchTrack(d.id,{transform:{...t.transform,x,y}});}else s.patchTextLayer(d.id,{x,y});
  }} onPointerUp={() => { drag.current = null;setGuide({x:null,y:null}); }} onPointerCancel={() => { drag.current = null;setGuide({x:null,y:null}); }}>
    <div className="alignment-toolbar" onPointerDown={e=>e.stopPropagation()}>{([['showRulers',pt?'Réguas':'Rulers'],['smartGuides',pt?'Guias':'Guides'],['snapEnabled',pt?'Encaixar':'Snap']] as const).map(([key,label])=><button key={key} aria-pressed={key==='showRulers'?rulers:key==='smartGuides'?guides:snap} onClick={()=>useUIStore.getState().setAlignmentOption(key,!(key==='showRulers'?rulers:key==='smartGuides'?guides:snap))}>{label}</button>)}</div>
    {rulers&&rect.width>0&&<svg className="editor-rulers" aria-label={pt?'Réguas em pixels da composição':'Composition pixel rulers'}><rect x={rect.x} y={Math.max(0,rect.y-20)} width={rect.width} height="20"/><rect x={Math.max(0,rect.x-28)} y={rect.y} width="28" height={rect.height}/>{Array.from({length:11},(_,i)=>{const x=rect.x+rect.width*i/10,y=rect.y+rect.height*i/10;return <g key={i}><text x={x+2} y={Math.max(10,rect.y-7)}>{Math.round(width*i/10)}</text><path d={`M${x} ${rect.y-4}v4`}/><text x={Math.max(1,rect.x-26)} y={y+10}>{Math.round(height*i/10)}</text><path d={`M${rect.x-4} ${y}h4`}/></g>;})}</svg>}
    {(guide.x!==null||guide.y!==null)&&<svg className="editor-guides">{guide.x!==null&&<line x1={rect.x+guide.x/width*rect.width} x2={rect.x+guide.x/width*rect.width} y1={rect.y} y2={rect.y+rect.height}/>} {guide.y!==null&&<line y1={rect.y+guide.y/height*rect.height} y2={rect.y+guide.y/height*rect.height} x1={rect.x} x2={rect.x+rect.width}/>}</svg>}
    {show && modelBox && Number.isFinite(modelBox.width) && <div className="canvas-selection-box" style={{ left: rect.x + modelBox.x / width * rect.width, top: rect.y + modelBox.y / height * rect.height, width: modelBox.width / width * rect.width, height: modelBox.height / height * rect.height }}><span>{tracks.find((l) => l.id === selectedMotion)?.name}</span></div>}
    {show && active && box && <div className="canvas-selection-box" style={{ left: rect.x + active.x / width * rect.width, top: rect.y + (active.y + textMotion(active, frame / fps).y) / height * rect.height, width: box.width / width * rect.width, height: box.height / height * rect.height, transform: `translate(${box.left / box.width * 100}%, -50%) rotate(${active.rotation}deg)`, transformOrigin: `${-box.left / box.width * 100}% 50%` }}><span>{active.text.slice(0, 30)}</span></div>}
  </div>;
}
