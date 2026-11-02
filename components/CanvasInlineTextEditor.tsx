// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef } from 'react';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { setCanvasEditing } from '@/lib/canvasEditing';
import { getRendererInstance } from '@/lib/rendererInstance';
import type { TextLayer } from '@/lib/textLayers';

export default function CanvasInlineTextEditor({ layer, left, top, width, height, ratio, pt, onDone }: { layer: TextLayer; left:number;top:number;width:number;height:number;ratio:number;pt:boolean;onDone:()=>void }) {
  const input = useRef<HTMLTextAreaElement>(null), revision = useRef(sceneRestoreRevision()), ended = useRef(false);
  useEffect(() => {
    ended.current = false;
    useHistoryStore.getState().beginGesture(); setCanvasEditing(layer.id); input.current?.focus(); input.current?.select();
    return () => { setCanvasEditing(null); if (!ended.current) { ended.current = true; useHistoryStore.getState().endGesture(); } };
  }, [layer.id]);
  const finish = () => {
    if (ended.current) return; ended.current = true;
    const s = useSceneStore.getState();
    setCanvasEditing(null); useHistoryStore.getState().endGesture(); onDone();
    getRendererInstance()?.renderFrame(s.frame);
  };
  const scaleY = layer.scaleY ?? 1, stretch = (layer.scaleX ?? 1) / scaleY;
  return <textarea ref={input} className="canvas-inline-text" aria-label={pt?'Editar texto na composição':'Edit text on canvas'} spellCheck={false} wrap="off" value={layer.text}
    style={{left,top,width:Math.max(60,width+4)/stretch,height:Math.max(24,height+4),transform:`translate(-50%,-50%) rotate(${layer.rotation}deg) scaleX(${stretch})`,fontFamily:`"${layer.font}",sans-serif`,fontWeight:layer.weight,fontSize:layer.size*scaleY*ratio,lineHeight:layer.lineHeight,letterSpacing:(layer.letterSpacing??0)*scaleY*ratio,textAlign:layer.align,color:layer.color,opacity:layer.opacity*(layer.fillOpacity??1)}}
    onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onChange={e=>{if(revision.current===sceneRestoreRevision())useSceneStore.getState().patchTextLayer(layer.id,{text:e.target.value});}}
    onBlur={()=>finish()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();finish();}else if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();finish();}}}/>;
}
