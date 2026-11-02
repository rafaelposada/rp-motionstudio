// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { setCanvasEditing } from '@/lib/canvasEditing';
import { getRendererInstance } from '@/lib/rendererInstance';
import type { TextLayer } from '@/lib/textLayers';
import { useUIStore } from '@/store/useUIStore';
import {remapTextRuns,resolvedTextSpans,type TextRun} from '@/lib/richText';
import { tx } from '@/lib/tx';

type Bookmark={anchor:number;focus:number};
type EditSnapshot={text:string;runs?:TextRun[];selection:Bookmark};
function selectionOffsets(root:HTMLElement):Bookmark|null{
  const selection=window.getSelection();
  if(!selection?.anchorNode||!selection.focusNode||!root.contains(selection.anchorNode)||!root.contains(selection.focusNode))return null;
  const offset=(node:Node,n:number)=>{const range=document.createRange();range.selectNodeContents(root);range.setEnd(node,n);return range.toString().length;};
  return {anchor:offset(selection.anchorNode,selection.anchorOffset),focus:offset(selection.focusNode,selection.focusOffset)};
}
function restoreOffsets(root:HTMLElement,bookmark:Bookmark){
  const locate=(offset:number):[Node,number]=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null,last:Node=root;while((node=walker.nextNode())){last=node;const length=node.textContent?.length??0;if(offset<=length)return[node,offset];offset-=length;}return[last,last===root?0:last.textContent?.length??0];};
  const [anchor,a]=locate(bookmark.anchor),[focus,f]=locate(bookmark.focus);
  window.getSelection()?.setBaseAndExtent(anchor,a,focus,f);
}

export default function CanvasInlineTextEditor({ layer, left, top, width, height, ratio, pt, onDone }: { layer: TextLayer; left:number;top:number;width:number;height:number;ratio:number;pt:boolean;onDone:()=>void }) {
  const input = useRef<HTMLDivElement>(null), revision = useRef(sceneRestoreRevision()), ended = useRef(false);
  const composing=useRef(false),before=useRef<Bookmark>({anchor:0,focus:0}),pending=useRef<Bookmark|null>(null);
  const edits=useRef<{past:EditSnapshot[];future:EditSnapshot[]}>({past:[],future:[]});
  const historyAction=useRef<(action:string)=>void>(()=>{});
  const captureSelection=()=>{
    const el=input.current;if(!el)return;
    const range=selectionOffsets(el),text=el.textContent??'';
    if(range)useUIStore.getState().setTextRange(range.anchor!==range.focus?{layerId:layer.id,text,start:Math.min(range.anchor,range.focus),end:Math.max(range.anchor,range.focus)}:null);
  };
  const currentLayer=()=>useSceneStore.getState().textLayers.find(item=>item.id===layer.id);
  const snapshot=(current:TextLayer,selection:Bookmark):EditSnapshot=>({text:current.text,runs:current.runs,selection});
  const commitInput=()=>{
    const el=input.current,current=currentLayer();if(!el||!current||composing.current||revision.current!==sceneRestoreRevision())return;
    const text=el.textContent??'',selection=selectionOffsets(el)??{anchor:text.length,focus:text.length};
    if(text!==current.text){
      edits.current.past.push(snapshot(current,before.current));if(edits.current.past.length>100)edits.current.past.shift();edits.current.future=[];
      pending.current=selection;
      useSceneStore.getState().patchTextLayer(layer.id,{text,runs:remapTextRuns(current,text)});
    }
    captureSelection();
  };
  const insertPlain=(text:string)=>{
    const el=input.current,selection=window.getSelection();if(!el||!selection)return;
    before.current=selectionOffsets(el)??{anchor:layer.text.length,focus:layer.text.length};
    const range=selection.rangeCount?selection.getRangeAt(0):document.createRange();
    if(!el.contains(range.commonAncestorContainer)){range.selectNodeContents(el);range.collapse(false);}
    range.deleteContents();const node=document.createTextNode(text.replace(/\r\n?/g,'\n'));range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);commitInput();
  };
  historyAction.current=action=>{
    const el=input.current,current=currentLayer();if(!el||!current||revision.current!==sceneRestoreRevision())return;
    const from=action==='undo'?edits.current.past:edits.current.future,to=action==='undo'?edits.current.future:edits.current.past,target=from.pop();if(!target)return;
    to.push(snapshot(current,selectionOffsets(el)??{anchor:current.text.length,focus:current.text.length}));pending.current=target.selection;
    useSceneStore.getState().patchTextLayer(layer.id,{text:target.text,runs:target.runs});
  };
  useLayoutEffect(()=>{
    const el=input.current;if(!el||composing.current)return;
    const focused=el===document.activeElement,selection=pending.current??selectionOffsets(el);
    const fragment=document.createDocumentFragment();
    for(const span of resolvedTextSpans(layer)){
      const node=document.createElement('span');node.textContent=span.text;
      node.style.fontFamily=`"${span.style.font}",sans-serif`;node.style.fontWeight=String(span.style.weight);node.style.color=span.style.color;node.style.opacity=String(span.style.fillOpacity);
      fragment.append(node);
    }
    if(!fragment.childNodes.length)fragment.append(document.createTextNode(''));
    // A final line break needs a line box so WebKit can place the caret after
    // it. The extra BR has no textContent and is never persisted in the layer.
    if(layer.text.endsWith('\n'))fragment.append(document.createElement('br'));
    el.replaceChildren(fragment);
    if(focused&&selection)restoreOffsets(el,selection);
    pending.current=null;
  },[layer.text,layer.runs,layer.font,layer.weight,layer.color,layer.fillOpacity]);
  useEffect(() => {
    ended.current = false;
    useHistoryStore.getState().beginGesture(); setCanvasEditing(layer.id);
    const el=input.current;el?.focus();if(el){restoreOffsets(el,{anchor:0,focus:layer.text.length});captureSelection();}
    const history=(event:Event)=>historyAction.current((event as CustomEvent<string>).detail);el?.addEventListener('rp-rich-text-history',history);
    return () => { el?.removeEventListener('rp-rich-text-history',history);setCanvasEditing(null); if (!ended.current) { ended.current = true; useHistoryStore.getState().endGesture(); } };
  }, [layer.id]);
  const finish = () => {
    if (ended.current) return; ended.current = true;
    const s = useSceneStore.getState();
    setCanvasEditing(null); useHistoryStore.getState().endGesture(); onDone();
    getRendererInstance()?.renderFrame(s.frame);
  };
  const scaleY = layer.scaleY ?? 1, stretch = (layer.scaleX ?? 1) / scaleY;
  return <div ref={input} className="canvas-inline-text" data-rich-editor="true" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={tx(pt, 'Editar texto na composição', 'Edit text on canvas')} spellCheck={false}
    style={{left,top,width:Math.max(60,width+4)/stretch,height:Math.max(24,height+4),transform:`translate(-50%,-50%) rotate(${layer.rotation}deg) scaleX(${stretch})`,fontFamily:`"${layer.font}",sans-serif`,fontWeight:layer.weight,fontSize:layer.size*scaleY*ratio,lineHeight:layer.lineHeight,letterSpacing:(layer.letterSpacing??0)*scaleY*ratio,textAlign:layer.align,textAlignLast:layer.align==='justify'?'left':undefined,...(layer.boxWidth?{whiteSpace:'pre-wrap',overflowWrap:'anywhere',textWrap:layer.wrap==='balance'?'balance':layer.wrap==='pretty'?'pretty':'wrap'}:{}),color:layer.color,opacity:layer.opacity,caretColor:'var(--accent-text)'} as React.CSSProperties}
    onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onSelect={captureSelection} onPointerUp={captureSelection} onKeyUp={captureSelection}
    onBeforeInput={()=>{if(input.current)before.current=selectionOffsets(input.current)??before.current;}} onInput={commitInput}
    onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;commitInput();}}
    onPaste={e=>{e.preventDefault();insertPlain(e.clipboardData.getData('text/plain'));}} onDrop={e=>e.preventDefault()}
    onBlur={()=>{captureSelection();commitInput();finish();}} onKeyDown={e=>{
      e.stopPropagation();if(e.nativeEvent.isComposing)return;
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();historyAction.current(e.shiftKey?'redo':'undo');return;}
      if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();historyAction.current('redo');return;}
      if((e.metaKey||e.ctrlKey)&&['b','i','u'].includes(e.key.toLowerCase())){e.preventDefault();return;}
      if(e.key==='Escape'){e.preventDefault();commitInput();finish();}else if(e.key==='Enter'){e.preventDefault();if(e.metaKey||e.ctrlKey){commitInput();finish();}else insertPlain('\n');}
    }}/>;
}
