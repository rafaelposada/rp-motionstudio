// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
require('sucrase/register');const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...args);};
const {textMotion,TextCompositor}=require('../lib/textLayers'),{audioGain,audioFilter}=require('../lib/audioEnvelope');
const {gradientFor,gradientCanvas,gradientCSS}=require('../lib/backgroundGradient');
const {useSceneStore}=require('../store/useSceneStore'),{buildScenePartial}=require('../lib/scenePersist');
const {controlHelp}=require('../lib/controlHelp');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const base={id:'text',text:'Teste',font:'Arial',weight:400,size:50,color:'#ffffff',x:100,y:100,rotation:0,opacity:.5,fillOpacity:.5,align:'center',lineHeight:1.2,visible:true,start:1,end:5};
for(const enter of ['none','fade','rise','typewriter'])for(const exit of ['none','fade','rise']){
  const layer={...base,entrance:enter,exit,entranceDuration:1,exitDuration:.5};
  near(textMotion(layer,1).opacity,enter==='none'?1:0);near(textMotion(layer,2).opacity,1);
  near(textMotion(layer,4.75).opacity,exit==='none'?1:.5);
  if(enter==='rise')assert.ok(textMotion(layer,1.25).y>0);
  if(exit==='rise')assert.ok(textMotion(layer,4.75).y<0);
}
const legacy={...base,animation:'fade',animationDuration:.5};
near(textMotion(legacy,1.25).opacity,.5);near(textMotion(legacy,4.75).opacity,.5);
near(textMotion({...legacy,entrance:'none',exit:'none'},1).opacity,1);
const paints=[],stack=[],gradients=[];
const ctx=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},fillText(){paints.push(this.globalAlpha);},measureText:t=>({width:t.length*25}),createLinearGradient(...args){const stops=[];gradients.push({args,stops});return{addColorStop:(...s)=>stops.push(s)};},createRadialGradient(...args){return this.createLinearGradient(...args);},createConicGradient(...args){return this.createLinearGradient(...args);}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
global.document={fonts:{check:()=>true},createElement:()=>({width:0,height:0,style:{setProperty(){},removeProperty(){}},getContext:()=>ctx,remove(){}})};
const compositor=new TextCompositor(),source=document.createElement('canvas');source.width=200;source.height=200;
for(const opacity of [0,.25,.5,1]){compositor.render(source,[{...base,opacity,entrance:'fade',entranceDuration:1}],200,200,1.5);near(paints.at(-1),opacity*.5*.5);}
assert.match(fs.readFileSync(path.join(root,'lib/renderer3d.ts'),'utf8'),/rt\.texture\.premultiplyAlpha = true/,'GPU canvas alpha must match the premultiplied compositor');
for(const shape of ['linear','radial','conic']){
  const spec=gradientFor({color:'#ff0000',color2:'#0000ff',gradientSpec:{shape,angle:0,centerX:.5,centerY:.5,radius:.7,stops:[{id:'a',color:'#ff0000',opacity:.5,position:1},{id:'b',color:'#0000ff',opacity:1,position:0}]}});
  assert.equal(spec.stops[0].id,'b');const canvas=gradientCanvas(spec,2160,3840);assert.ok(canvas.height<=1024);assert.match(gradientCSS(spec),/gradient/);
  assert.equal(gradients.at(-1).stops.length,2);assert.equal(gradients.at(-1).stops[0][0],0);
}
const old=gradientFor({color:'#102030',color2:'#405060'});assert.equal(old.angle,90);assert.equal(old.stops[1].color,'#405060');
for(const t of [0,.25,.5,1,1.5,1.75,2])near(audioGain({volume:.8,fadeIn:.5,fadeOut:.5},t,2),t===0||t===2?0:t===.25||t===1.75?.4:.8);
const filter=audioFilter({volume:.8,fadeIn:.5,fadeOut:.5},4,2);assert.match(filter,/afade=t=out:st=1.5:d=0.5/);assert.match(filter,/atrim=duration=4/);
useSceneStore.getState().hydrate({audioSettings:{volume:.4,fadeIn:1,fadeOut:2}});const saved=buildScenePartial(useSceneStore.getState());assert.equal(saved.audioSettings.fadeOut,2);
useSceneStore.getState().hydrate({});assert.equal(useSceneStore.getState().audioSettings.volume,1,'Old projects must not inherit previous audio settings');
const help=controlHelp({key:'lineHeight',label:'Entrelinha',type:'slider',default:1.2},'pt','Entrelinha');assert.ok(help.length<180&&!help.includes('cálculo'));assert.match(help,/linhas/);
const {pointedVertices,regularAspect,reshapePointed,vertexRadii,tracePointed}=require('../lib/shapeGeometry');
for(const shape of [{kind:'polygon',sides:3},{kind:'polygon',sides:6},{kind:'polygon',sides:7},{kind:'star',points:5,innerRadius:.38},{kind:'star',points:8,innerRadius:.6}]){
  const box={...shape,width:300,height:180},v=pointedVertices(box),xs=v.map(p=>p[0]),ys=v.map(p=>p[1]);
  assert.equal(v.length,shape.kind==='star'?shape.points*2:shape.sides);
  near(Math.min(...xs),-150);near(Math.max(...xs),150);near(Math.min(...ys),-90);near(Math.max(...ys),90);
  assert.ok(ys.indexOf(Math.min(...ys))===0,'First vertex points up');
}
near(regularAspect({kind:'polygon',sides:4}),1);assert.ok(regularAspect({kind:'polygon',sides:3})<1);
const tall=reshapePointed({kind:'star',points:5,innerRadius:.38,width:200,height:Math.round(200*regularAspect({kind:'star',points:5,innerRadius:.38}))*2},{points:6});
assert.ok(Math.abs(tall.height/(200*regularAspect({kind:'star',points:6,innerRadius:.38}))-2)<.02,'Changing points keeps the stretch');
const traced=[];const pathCtx=new Proxy({save(){},restore(){},beginPath(){traced.length=0;},moveTo(x,y){traced.push([x,y]);},lineTo(x,y){traced.push([x,y]);},fillText(){},measureText:t=>({width:t.length*25})},{get:(t,k)=>k in t?t[k]:()=>{},set:()=>true});
global.document={fonts:{check:()=>true},createElement:()=>({width:200,height:200,style:{setProperty(){},removeProperty(){}},getContext:()=>pathCtx,remove(){}})};
new TextCompositor().render(document.createElement('canvas'),[{...base,opacity:1,shape:{kind:'star',points:5,innerRadius:.38,width:120,height:100,fill:'#fff'}}],200,200,2);
assert.equal(traced.length,10,'The compositor traces every star vertex');
// Rounded corners: each corner keeps the requested radius until the edge is
// too short, then shrinks so neighbouring arcs never overlap.
const hexagon=pointedVertices({kind:'polygon',sides:6,width:200,height:Math.round(200*regularAspect({kind:'polygon',sides:6}))});
const small=vertexRadii(hexagon,10);small.forEach(r=>near(r,10));
vertexRadii(hexagon,1000).forEach((r,i)=>{
  const p=hexagon[(i+5)%6],v=hexagon[i],n=hexagon[(i+1)%6],a=[p[0]-v[0],p[1]-v[1]],b=[n[0]-v[0],n[1]-v[1]],la=Math.hypot(...a),lb=Math.hypot(...b);
  const tangent=r/Math.tan(Math.acos((a[0]*b[0]+a[1]*b[1])/(la*lb))/2);
  assert.ok(r>0&&r<1000&&tangent<=Math.min(la,lb)/2+1e-6,'A huge radius is capped by the shorter edge');
});
const arcs=[];tracePointed({moveTo(){},lineTo(){arcs.push('line');},arcTo(...a){arcs.push(a[4]);},closePath(){}},pointedVertices({kind:'star',points:5,innerRadius:.38,width:120,height:114}),6);
assert.equal(arcs.length,10);assert.ok(arcs.every(r=>typeof r==='number'&&r>0),'Every star point and notch is rounded');
const sharp=[];tracePointed({moveTo(){sharp.push('m');},lineTo(){sharp.push('l');},arcTo(){sharp.push('a');},closePath(){}},hexagon,0);assert.ok(!sharp.includes('a'),'Radius 0 keeps sharp corners');
// Media inside a shape: fill crops around the focal point, fit letterboxes,
// stretch covers the box; all draw centred on the layer origin.
const {drawShapeMedia}=require('../lib/shapeFill');
const draws=[];const mediaCtx={drawImage:(...a)=>draws.push(a)};const photo={width:400,height:200};
drawShapeMedia(mediaCtx,photo,{kind:'image',fit:'fill',crop:{x:1,y:.5}},100,100);
assert.deepEqual(draws.at(-1).slice(1),[200,0,200,200,-50,-50,100,100],'Fill crops the right side when the focal point is right');
drawShapeMedia(mediaCtx,photo,{kind:'image',fit:'fill',crop:{x:.5,y:.5,zoom:2}},100,100);
assert.deepEqual(draws.at(-1).slice(1),[150,50,100,100,-50,-50,100,100],'Zoom narrows the crop around the focal point');
drawShapeMedia(mediaCtx,photo,{kind:'image',fit:'fit'},100,100);assert.deepEqual(draws.at(-1).slice(1),[-50,-25,100,50],'Fit shows the whole photo');
drawShapeMedia(mediaCtx,photo,{kind:'image',fit:'stretch'},100,100);assert.deepEqual(draws.at(-1).slice(1),[-50,-50,100,100],'Stretch fills the box');
const filled={...base,id:'fill',shape:{kind:'star',points:5,width:100,height:95,media:{blobId:'shapefill_a',url:'blob:live',kind:'video',width:640,height:360}}};
const persisted=buildScenePartial({...useSceneStore.getState(),textLayers:[filled]}).textLayers[0];
assert.equal(persisted.shape.media.url,'',"Saved projects keep the shape media's bytes key, never a session blob URL");assert.equal(persisted.shape.media.blobId,'shapefill_a');
console.log('Finishing checks passed: polygon and star geometry, rounded corners, media fill framing, independent/legacy entrances and exits, raster opacity including zero, GPU alpha contract, shared gradients, audio envelopes and persistence, concise contextual help.');
