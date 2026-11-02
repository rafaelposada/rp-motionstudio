// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// Shared background document and native Canvas raster for both GPU engines.
export interface GradientStop { id:string; color:string; opacity:number; position:number }
export interface BackgroundGradient { shape:'linear'|'radial'|'conic'; angle:number; centerX:number; centerY:number; radius:number; stops:GradientStop[] }
type LegacyBackground = {color:string;color2:string;gradientSpec?:BackgroundGradient};
const clamp=(v:unknown,min:number,max:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const color=(v:unknown,fallback:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:fallback;
export function gradientFor(bg:LegacyBackground):BackgroundGradient {
  const s=bg.gradientSpec;
  const stops=s && Array.isArray(s.stops) && s.stops.length>=2?s.stops.slice(0,8):[{id:'start',color:bg.color,position:0,opacity:1},{id:'end',color:bg.color2,position:1,opacity:1}];
  return {shape:s?.shape==='radial'||s?.shape==='conic'?s.shape:'linear',angle:clamp(s?.angle,-360,360,90),centerX:clamp(s?.centerX,0,1,.5),centerY:clamp(s?.centerY,0,1,.5),radius:clamp(s?.radius,.05,2,.7),
    stops:stops.map((stop,i)=>({id:typeof stop.id==='string'?stop.id:'stop-'+i,color:color(stop.color,'#000000'),opacity:clamp(stop.opacity,0,1,1),position:clamp(stop.position,0,1,i/(stops.length-1))})).sort((a,b)=>a.position-b.position)};
}
export function stopColor(stop:GradientStop) {
  const c=stop.color;return `rgba(${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)},${stop.opacity})`;
}
export function gradientCSS(spec:BackgroundGradient) {
  const stops=spec.stops.map(s=>`${stopColor(s)} ${s.position*100}%`).join(',');
  if(spec.shape==='radial')return `radial-gradient(circle at ${spec.centerX*100}% ${spec.centerY*100}%,${stops})`;
  if(spec.shape==='conic')return `conic-gradient(from ${spec.angle+90}deg at ${spec.centerX*100}% ${spec.centerY*100}%,${stops})`;
  return `linear-gradient(${spec.angle+90}deg,${stops})`;
}
export function gradientCanvas(spec:BackgroundGradient,width:number,height:number):HTMLCanvasElement {
  const canvas=document.createElement('canvas'), scale=Math.min(1,1024/Math.max(width,height));
  canvas.width=Math.max(2,Math.round(width*scale));canvas.height=Math.max(2,Math.round(height*scale));
  const ctx=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,angle=spec.angle*Math.PI/180;
  let gradient:CanvasGradient;
  if(spec.shape==='radial')gradient=ctx.createRadialGradient(w*spec.centerX,h*spec.centerY,0,w*spec.centerX,h*spec.centerY,Math.max(w,h)*spec.radius);
  else if(spec.shape==='conic')gradient=ctx.createConicGradient(angle,w*spec.centerX,h*spec.centerY);
  else {const x=Math.cos(angle),y=Math.sin(angle),length=Math.abs(w*x)+Math.abs(h*y);gradient=ctx.createLinearGradient(w/2-x*length/2,h/2-y*length/2,w/2+x*length/2,h/2+y*length/2);}
  spec.stops.forEach(s=>gradient.addColorStop(s.position,stopColor(s)));
  ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  return canvas;
}
export const GRADIENT_PRESETS = [
  {name:'Íris',colors:['#7597de','#5c60a6','#494184']},{name:'Solar',colors:['#ff5c21','#ffb30a']},
  {name:'Oceano',colors:['#082c35','#12c9b0']},{name:'Ameixa',colors:['#170e29','#562164']},
  {name:'Rosa',colors:['#e7a3b1','#ffe2da']},{name:'Noite',colors:['#403e65','#0d0d16']},
];
