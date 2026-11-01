'use client';
import { useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { gradientFor, gradientCSS, GRADIENT_PRESETS, type BackgroundGradient } from '@/lib/backgroundGradient';
import { useHistoryStore } from '@/store/useHistoryStore';
import { ControlRow } from './Controls';
import ColorField from './ColorField';
export default function GradientEditor({pt}:{pt:boolean}) {
  const bg=useSceneStore(s=>s.background), set=useSceneStore(s=>s.setBackground),spec=gradientFor(bg);
  const [selected,setSelected]=useState(spec.stops[0].id);
  const active=spec.stops.find(s=>s.id===selected)??spec.stops[0];
  const update=(next:BackgroundGradient)=>{const sorted=[...next.stops].sort((a,b)=>a.position-b.position);set({gradientSpec:next,color:sorted[0].color,color2:sorted.at(-1)!.color});};
  const patch=(value:Partial<typeof active>)=>update({...spec,stops:spec.stops.map(s=>s.id===active.id?{...s,...value}:s)});
  const add=()=>{
    const sorted=spec.stops; let index=0;for(let i=1;i<sorted.length-1;i++)if(sorted[i+1].position-sorted[i].position>sorted[index+1].position-sorted[index].position)index=i;
    const a=sorted[index],b=sorted[index+1], id=crypto.randomUUID();
    const rgb=[1,3,5].map(i=>Math.round((parseInt(a.color.slice(i,i+2),16)+parseInt(b.color.slice(i,i+2),16))/2).toString(16).padStart(2,'0')).join('');
    update({...spec,stops:[...spec.stops,{id,color:'#'+rgb,opacity:(a.opacity+b.opacity)/2,position:(a.position+b.position)/2}]});setSelected(id);
  };
  return <div className="gradient-editor">
    <div className="gradient-presets" aria-label={pt?'Presets de gradiente':'Gradient presets'}>{GRADIENT_PRESETS.map((p,i)=><button key={p.name} aria-label={(pt?'Preset de gradiente ':'Gradient preset ')+(pt?p.name:['Iris','Solar','Ocean','Plum','Rose','Night'][i])} title={pt?p.name:['Iris','Solar','Ocean','Plum','Rose','Night'][i]} style={{background:`linear-gradient(135deg,${p.colors.join(',')})`}} onClick={()=>{const stops=p.colors.map((color,i)=>({id:'preset-'+i,color,opacity:1,position:i/(p.colors.length-1)}));update({...spec,stops});setSelected(stops[0].id);}}/>)}</div>
    <div className="gradient-ramp" style={{background:gradientCSS({...spec,shape:'linear',angle:0})}} aria-label={pt?'Pontos do gradiente':'Gradient stops'}>
      {spec.stops.map(stop=><button key={stop.id} className={stop.id===active.id?'selected':''} style={{left:`${stop.position*100}%`,background:stop.color}} aria-label={`${pt?'Ponto':'Stop'} ${Math.round(stop.position*100)}%`} aria-pressed={stop.id===active.id} onFocus={()=>setSelected(stop.id)} onLostPointerCapture={()=>useHistoryStore.getState().endGesture()} onClick={()=>setSelected(stop.id)}
        onPointerDown={e=>{e.preventDefault();setSelected(stop.id);e.currentTarget.setPointerCapture(e.pointerId);useHistoryStore.getState().beginGesture();}}
        onPointerMove={e=>{if(e.buttons!==1 || !e.currentTarget.hasPointerCapture(e.pointerId))return;const r=e.currentTarget.parentElement!.getBoundingClientRect();const current=gradientFor(useSceneStore.getState().background);update({...current,stops:current.stops.map(s=>s.id===stop.id?{...s,position:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))}:s)});}}
        onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);useHistoryStore.getState().endGesture();}}
        onPointerCancel={()=>useHistoryStore.getState().endGesture()}
        onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();patch({position:Math.max(0,Math.min(1,stop.position+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?.1:.01)))});}}}/>)}
    </div>
    <div className="gradient-actions"><button className="btn" onClick={()=>update({...spec,stops:spec.stops.map(s=>({...s,position:1-s.position}))})}>{pt?'Inverter':'Reverse'}</button><button className="btn" disabled={spec.stops.length>=8} onClick={add}>{pt?'+ Ponto':'+ Stop'} {spec.stops.length}/8</button><button className="btn" disabled={spec.stops.length<=2} onClick={()=>update({...spec,stops:spec.stops.filter(s=>s.id!==active.id)})}>{pt?'Remover':'Remove'}</button></div>
    <ColorField pt={pt} label={pt?'Cor do ponto':'Stop color'} color={active.color} opacity={active.opacity} onChange={(color,opacity)=>patch({color,opacity})}/>
    <ControlRow def={{key:'gradientPosition',label:pt?'Posição do ponto':'Stop position',type:'slider',min:0,max:100,step:.1,unit:'%',default:0}} value={active.position*100} onChange={value=>patch({position:Number(value)/100})}/>
    <label className="text-edit-label">{pt?'Forma do gradiente':'Gradient shape'}<select className="field" value={spec.shape} onChange={e=>update({...spec,shape:e.target.value as BackgroundGradient['shape']})}><option value="linear">{pt?'Linear':'Linear'}</option><option value="radial">{pt?'Radial':'Radial'}</option><option value="conic">{pt?'Cônico':'Conic'}</option></select></label>
    {spec.shape!=='radial'&&<ControlRow def={{key:'gradientAngle',label:pt?'Ângulo do gradiente':'Gradient angle',type:'slider',min:-180,max:180,step:1,unit:'°',default:90}} value={spec.angle} onChange={value=>update({...spec,angle:Number(value)})}/>}
    {spec.shape!=='linear'&&(['centerX','centerY','radius'] as const).filter(key=>key!=='radius'||spec.shape==='radial').map(key=><ControlRow key={key} def={{key:'gradient'+key,label:key==='radius'?(pt?'Raio do gradiente':'Gradient radius'):`${pt?'Centro':'Center'} ${key==='centerX'?'X':'Y'}`,type:'slider',min:key==='radius'?5:0,max:key==='radius'?200:100,step:1,unit:'%',default:50}} value={spec[key]*100} onChange={value=>update({...spec,[key]:Number(value)/100})}/>)}
  </div>;
}
