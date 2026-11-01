'use client';
import { useSceneStore } from '@/store/useSceneStore';
import type { TextLayer } from '@/lib/textLayers';
import { ControlRow } from './Controls';
const animations=[['none','Sem animação','None'],['fade','Desvanecer','Fade'],['rise','Subir','Rise'],['drop','Descer','Drop'],['slideLeft','Deslizar à esquerda','Slide left'],['slideRight','Deslizar à direita','Slide right'],['zoomIn','Aproximar','Zoom in'],['zoomOut','Afastar','Zoom out'],['pop','Salto suave','Pop'],['rotate','Girar','Rotate'],['typewriter','Máquina de escrever','Typewriter']];
export default function LayerAnimationControls({layer,pt}:{layer:TextLayer;pt:boolean}) {
  const patch=useSceneStore(s=>s.patchTextLayer), duration=useSceneStore(s=>s.duration), fps=useSceneStore(s=>s.fps);
  const enter=layer.entrance??layer.animation??'none', exit=layer.exit??(layer.animation&&layer.animation!=='none'?'fade':'none');
  const length=Math.max(1/fps,layer.end-layer.start);
  return <div className="layer-animation-controls">
    <label className="text-edit-label">{pt?'Animação de entrada':'Entrance animation'}<select className="field" value={enter} onChange={e=>patch(layer.id,{entrance:e.target.value as TextLayer['entrance']})}>
      {animations.filter(([id])=>!layer.media||id!=='typewriter').map(([id,br,en])=><option key={id} value={id}>{pt?br:en}</option>)}
    </select></label>
    {enter!=='none'&&<ControlRow def={{key:'entranceDuration',label:pt?'Duração da entrada':'Entrance duration',type:'slider',min:.05,max:Math.max(.05,length/2),step:.01,unit:'s',default:.35}} value={layer.entranceDuration??layer.animationDuration??.35} onChange={value=>patch(layer.id,{entranceDuration:Number(value)})}/>}
    <label className="text-edit-label">{pt?'Animação de saída':'Exit animation'}<select className="field" value={exit} onChange={e=>patch(layer.id,{exit:e.target.value as TextLayer['exit']})}>
      {animations.filter(([id])=>!layer.media||id!=='typewriter').map(([id,br,en])=><option key={id} value={id}>{pt?br:en}</option>)}
    </select></label>
    {exit!=='none'&&<ControlRow def={{key:'exitDuration',label:pt?'Duração da saída':'Exit duration',type:'slider',min:.05,max:Math.max(.05,length/2),step:.01,unit:'s',default:.35}} value={layer.exitDuration??layer.animationDuration??.35} onChange={value=>patch(layer.id,{exitDuration:Number(value)})}/>}
    <ControlRow def={{key:'start',label:pt?'Início da camada':'Layer start',type:'slider',min:0,max:Math.max(0,layer.end-1/fps),step:.01,unit:'s',default:0}} value={layer.start} onChange={value=>patch(layer.id,{start:Number(value)})}/>
    <ControlRow def={{key:'end',label:pt?'Fim da camada':'Layer end',type:'slider',min:Math.min(duration,layer.start+1/fps),max:duration,step:.01,unit:'s',default:duration}} value={layer.end} onChange={value=>patch(layer.id,{end:Number(value)})}/>
    <p className="ctl-hint">{pt?'As transições acontecem nos extremos do intervalo da camada. Reproduza ou mova o indicador de tempo até o início/fim para visualizar.':'Transitions run at the edges of the layer interval. Play or scrub to its start/end to preview.'}</p>
  </div>;
}
