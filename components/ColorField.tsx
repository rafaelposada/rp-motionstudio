'use client';
import { useEffect, useState } from 'react';
import { parseNumericExpression } from '@/lib/numericExpression';
function hsv(hex: string) {
  const [r,g,b] = [1,3,5].map((i) => parseInt(hex.slice(i,i+2),16)/255), max = Math.max(r,g,b), min = Math.min(r,g,b), d=max-min;
  const h = !d ? 0 : max===r ? ((g-b)/d+6)%6*60 : max===g ? ((b-r)/d+2)*60 : ((r-g)/d+4)*60;
  return {h,s:max ? d/max : 0,v:max};
}
function hexFrom(h:number,s:number,v:number) {
  const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c;
  const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+rgb.map((n)=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
export default function ColorField({label,color,opacity=1,onChange,pt=true}: {label:string;color:string;opacity?:number;onChange:(color:string,opacity:number)=>void;pt?:boolean}) {
  const [open,setOpen]=useState(false), [draft,setDraft]=useState(color.replace('#','')), [alpha,setAlpha]=useState(String(Math.round(opacity*100))), [invalid,setInvalid]=useState(false);
  const [hue,setHue]=useState(()=>hsv(color).h);
  useEffect(()=>{setDraft(color.replace('#','')); const next=hsv(color); if(next.s>.001)setHue(next.h);},[color]);
  useEffect(()=>setAlpha(String(Math.round(opacity*100))),[opacity]);
  const {s,v}=hsv(color);
  const commit=()=>{ const raw=draft.replace(/^#/,''); const expanded=raw.length===3 ? [...raw].map(c=>c+c).join(''):raw; if(!/^[0-9a-f]{6}$/i.test(expanded)){setInvalid(true);return;} const n=parseNumericExpression(alpha.replace('%','')); if(n===null){setInvalid(true);return;} onChange('#'+expanded.toLowerCase(),Math.max(0,Math.min(1,n/100)));setInvalid(false);};
  const setPoint=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect();onChange(hexFrom(hue,Math.max(0,Math.min(1,(e.clientX-r.x)/r.width)),1-Math.max(0,Math.min(1,(e.clientY-r.y)/r.height))),opacity);};
  return <div className="color-editor"><button type="button" className="color-field-trigger" aria-expanded={open} onClick={()=>setOpen(!open)}><span className="color-swatch" style={{background:color,opacity}}/><span>{label}</span><code>{color.toUpperCase()}</code><span>{Math.round(opacity*100)}%</span></button>
    {open&&<div className="color-popover" role="group" aria-label={label}><header><strong>{label}</strong><button type="button" aria-label={pt?'Fechar seletor':'Close color picker'} onClick={()=>setOpen(false)}>×</button></header>
      <div className="color-sv" style={{backgroundColor:hexFrom(hue,1,1)}} onPointerDown={(e)=>{e.currentTarget.setPointerCapture(e.pointerId);setPoint(e);}} onPointerMove={(e)=>{if(e.buttons===1)setPoint(e);}}><i style={{left:`${s*100}%`,top:`${(1-v)*100}%`}}/></div>
      <label className="color-range-label">{pt?'Matiz':'Hue'}<input aria-label={`${label}: ${pt?'matiz':'hue'}`} className="color-hue" type="range" min="0" max="359" value={Math.round(hue)} onChange={(e)=>{const h=Number(e.target.value);setHue(h);onChange(hexFrom(h,s,v),opacity);}}/></label>
      <label className="color-range-label">{pt?'Opacidade':'Opacity'}<input className="color-alpha" style={{backgroundImage:`linear-gradient(to right, transparent, ${color}), repeating-conic-gradient(#777 0% 25%, #bbb 0% 50%)`}} aria-label={`${label}: ${pt?'opacidade':'opacity'}`} type="range" min="0" max="100" value={Math.round(opacity*100)} onChange={(e)=>onChange(color,Number(e.target.value)/100)}/></label>
      <div className="color-inputs"><label>HEX<input aria-label={`${label}: HEX`} value={draft} aria-invalid={invalid} onChange={(e)=>{setDraft(e.target.value);setInvalid(false);}} onBlur={commit} onKeyDown={(e)=>{if(e.key==='Enter')commit();if(e.key==='Escape')setOpen(false);}}/></label><label>%<input aria-label={`${label}: %`} value={alpha} onChange={(e)=>setAlpha(e.target.value)} onBlur={commit} onKeyDown={(e)=>{if(e.key==='Enter')commit();}}/></label></div>
      {invalid&&<p role="alert">{pt?'Cor ou opacidade inválida.':'Invalid color or opacity.'}</p>}
    </div>}
  </div>;
}
