// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
export interface TextShadowSettings {
  color: string; opacity: number; x: number; y: number; blur: number; spread: number;
  position: 'outside'|'inside'; type: 'box'|'realistic';
}
let mask: HTMLCanvasElement | undefined, shape: HTMLCanvasElement | undefined, effect: HTMLCanvasElement | undefined;
export interface ShadowBounds {x:number;y:number;width:number;height:number}
export function shadowRenderRegion(width:number,height:number,scale:number,settings:TextShadowSettings,bounds?:ShadowBounds,matrix?:DOMMatrix):ShadowBounds {
  if(!bounds||!matrix||!Number.isFinite(matrix.a))return{x:0,y:0,width,height};
  const points=[[bounds.x,bounds.y],[bounds.x+bounds.width,bounds.y],[bounds.x,bounds.y+bounds.height],[bounds.x+bounds.width,bounds.y+bounds.height]].map(([x,y])=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f}));
  const k=settings.type==='realistic'?1.2:1;
  const glyphScale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
  const pad=Math.ceil((3*settings.blur*k+Math.max(Math.abs(settings.x),Math.abs(settings.y))*k)*scale+Math.abs(settings.spread)*glyphScale)+3;
  const x=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-pad)),y=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-pad));
  const right=Math.min(width,Math.ceil(Math.max(...points.map(p=>p.x))+pad)),bottom=Math.min(height,Math.ceil(Math.max(...points.map(p=>p.y))+pad));
  return{x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};
}
function surface(canvas:HTMLCanvasElement|undefined,width:number,height:number) {
  canvas??=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;
}
// Scratch surfaces are shared by all synchronous rasterizations. They do not
// remain allocated once the effect has been copied into the cached overlay.
export function drawTextShadow(target:CanvasRenderingContext2D,width:number,height:number,scale:number,settings:TextShadowSettings,drawMask:(ctx:CanvasRenderingContext2D,spread:number)=>void,bounds?:ShadowBounds) {
  if(settings.opacity<=0)return;
  const transform=target.getTransform(),region=shadowRenderRegion(width,height,scale,settings,bounds,transform);
  if(!region.width||!region.height)return;
  width=region.width;height=region.height;
  mask=surface(mask,width,height);shape=surface(shape,width,height);effect=surface(effect,width,height);
  const original=mask.getContext('2d')!,shaped=shape.getContext('2d')!,out=effect.getContext('2d')!;
  if(bounds&&Number.isFinite(transform.a)){
    original.setTransform(transform.a,transform.b,transform.c,transform.d,transform.e-region.x,transform.f-region.y);
    shaped.setTransform(transform.a,transform.b,transform.c,transform.d,transform.e-region.x,transform.f-region.y);
  }else{original.setTransform(transform);shaped.setTransform(transform);}
  drawMask(original,0);drawMask(shaped,settings.position==='inside'?-settings.spread:settings.spread);
  shaped.setTransform(1,0,0,1,0,0);
  if(settings.position==='inside'){
    shaped.globalCompositeOperation='destination-out';
    // Invert the glyph mask within the composition, including the boundary.
    out.fillStyle='#fff';out.fillRect(0,0,width,height);out.globalCompositeOperation='destination-out';out.drawImage(shape,0,0);
    shaped.clearRect(0,0,width,height);shaped.globalCompositeOperation='source-over';shaped.drawImage(effect,0,0);
    out.clearRect(0,0,width,height);out.globalCompositeOperation='source-over';
  }
  const passes=settings.type==='realistic'?[{weight:.2,k:.35},{weight:.3,k:.7},{weight:.5,k:1.2}]:[{weight:1,k:1}];
  for(const pass of passes){
    out.globalAlpha=pass.weight;
    // Native canvas shadows are supported by the Safari app as well as Chrome;
    // CanvasRenderingContext2D.filter is not required. Keep the source offscreen.
    out.shadowColor='#fff';out.shadowBlur=settings.blur*scale*pass.k;
    out.shadowOffsetX=width*2+settings.x*scale*pass.k;out.shadowOffsetY=settings.y*scale*pass.k;
    out.drawImage(shape,-width*2,0);
  }
  out.globalAlpha=1;out.shadowColor='transparent';out.shadowBlur=out.shadowOffsetX=out.shadowOffsetY=0;
  if(settings.position==='inside'){out.globalCompositeOperation='destination-in';out.drawImage(mask,0,0);}
  out.globalCompositeOperation='source-in';out.fillStyle=settings.color;out.fillRect(0,0,width,height);
  target.save();target.setTransform(1,0,0,1,0,0);target.globalAlpha*=settings.opacity;target.drawImage(effect,region.x,region.y);target.restore();
  mask.width=mask.height=shape.width=shape.height=effect.width=effect.height=1;
}
