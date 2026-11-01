const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
require('sucrase/register');const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...args);};
const {templateList,catalogTemplateList,defaultsFor,easingFor,layerCountFor}=require('../templates');
const {resolveEasing}=require('../lib/easing'),{textMotion,TextCompositor}=require('../lib/textLayers');
const {useSceneStore}=require('../store/useSceneStore'),{buildScenePartial}=require('../lib/scenePersist');
const THREE=require('three'),mesh=require('../three3d/cardMesh');
const modes=['none','fade','rise','drop','slideLeft','slideRight','zoomIn','zoomOut','pop','rotate','typewriter'];
const base={id:'test',text:'Olá 👋 mundo',font:'Arial',weight:600,size:48,x:300,y:300,rotation:0,opacity:.7,color:'#ffffff',align:'center',lineHeight:1.2,visible:true,start:1,end:4,entranceDuration:.5,exitDuration:.5};
for(const entrance of modes)for(const exit of modes){
  const layer={...base,entrance,exit};
  for(const time of [1,1.1,1.25,1.5,2,3.5,3.75,3.9,4]){
    const p=textMotion(layer,time);for(const key of ['x','y','rotation','scale','opacity'])assert.ok(Number.isFinite(p[key]));
    assert.ok(p.opacity>=0&&p.opacity<=1);assert.ok(p.scale>.1&&p.scale<2);
  }
  const held=textMotion(layer,2);assert.ok(Math.abs(held.x)<1e-9);assert.ok(Math.abs(held.y)<1e-9);assert.equal(held.scale,1);assert.ok(Math.abs(held.rotation)<1e-9);assert.equal(held.opacity,1);assert.equal(held.text,base.text);
}
assert.ok(textMotion({...base,entrance:'slideLeft'},1).x>0);
assert.ok(textMotion({...base,exit:'slideLeft'},4).x<0);
assert.equal(textMotion({...base,exit:'typewriter'},4).text,'');
let frames=0;
for(const t of templateList.filter(t=>t.meta.group==='Runway')){
  assert.notEqual(t.meta.engine,'webgl');assert.equal(t.transform3d,undefined);
  const v=defaultsFor(t.meta.id),ease=resolveEasing(easingFor(t.meta.id)),ctx={width:810,height:1080,cardAspect:.8,fps:30,duration:8,totalFrames:240,ease,easedPhase:p=>Math.floor(p)+ease(p-Math.floor(p))};
  for(let frame=0;frame<240;frame+=7){const poses=Array.from({length:v.count},(_,i)=>t.transform(frame,i,v.count,v,ctx));
    if(v.scaleFocus==='center'){const visible=poses.filter(p=>p.solidAlpha>.1).sort((a,b)=>Math.hypot(a.x-v.offset.x,a.y-v.offset.y)-Math.hypot(b.x-v.offset.x,b.y-v.offset.y));if(visible.length)assert.ok(visible.every(p=>p.depth<=visible[0].depth+1e-8));}frames++;}
}
for(const id of ['deck-r01','coil-01','ring-r01','stickers-01','poster-01','fold-01'])assert.ok(catalogTemplateList.some(t=>t.meta.id===id)||templateList.find(t=>t.meta.id===id)?.meta.catalogHidden);
assert.equal(layerCountFor('deck-r01',defaultsFor('deck-r01'),{width:810,height:1080}),24);
for(const sag of [-.3,-.04,.04,.3]){const g=mesh.makeBentPlaneGeometry(sag),p=g.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getZ(i))<.6);g.dispose();}
for(const g of [mesh.makeCurlPlaneGeometry(2),mesh.makeCornerPeelGeometry(.5,2,.3,45,.5),mesh.makeStickerRollGeometry(.2,.15,45)]){const p=g.attributes.position;for(let i=0;i<p.count;i++)for(const v of [p.getX(i),p.getY(i),p.getZ(i)])assert.ok(Number.isFinite(v));g.dispose();}
const records=[],stack=[];const ctx=new Proxy({globalAlpha:1,fillStyle:'',save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},measureText:t=>({width:[...t].length*20}),fill(){records.push(['fill',this.fillStyle,this.globalAlpha]);},fillText(){records.push(['text']);},stroke(){records.push(['stroke']);}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
global.document={createElement:()=>({width:600,height:600,style:{setProperty(){},removeProperty(){}},getContext:()=>ctx,remove(){}})};
new TextCompositor().render(document.createElement('canvas'),[{...base,backdrop:true,backdropBlur:20,backdropOpacity:0,backdropStroke:'#123456',entrance:'none',exit:'none'}],600,600,2,false,null,true,true);
assert.deepEqual(records,[['fill','#ffffff',.7]],'BG Blur mask is independent of tint alpha, and excludes glyphs/stroke');
const scene=useSceneStore.getState();scene.resetScene();scene.addTextLayer();const id=useSceneStore.getState().textLayers[0].id;scene.patchTextLayer(id,{backdrop:true,backdropBlur:22.5,entrance:'pop',exit:'slideLeft'});
const saved=buildScenePartial(useSceneStore.getState()).textLayers[0];assert.equal(saved.backdropBlur,22.5);assert.equal(saved.entrance,'pop');assert.equal(saved.exit,'slideLeft');
const renderer=fs.readFileSync(path.join(root,'lib/renderer3d.ts'),'utf8');
const make=renderer.match(/function makePlaceholderTexture[\s\S]*?\n}/)[0];
const build=new Function('document','THREE','placeholderHex','placeholderFill','placeholderLabel',`${require('sucrase').transform(make,{transforms:['typescript']}).code};return makePlaceholderTexture;`)(document,THREE,x=>x,()=> '#888888',()=> '#111111');
for(const aspect of [.5625,.8,1,1.4,1.7778]){const texture=build(1,aspect);assert.ok(Math.abs(texture.image.width/texture.image.height-aspect)<.004);texture.dispose();}
assert.ok(renderer.includes('texture2D(backdropMap,vUv).a'));assert.ok(renderer.includes('slot.front.renderOrder=t.depth*1000'));
const resize=renderer.slice(renderer.indexOf('  resize(width:'),renderer.indexOf('  setCaptureScale('));
assert.ok(resize.includes('rt.texture.dispose()')&&resize.includes('rt.mask?.dispose()')&&resize.includes('this.overlays.clear()'),'Capture resize must recreate immutable GPU text and blur textures');
console.log(`Runway/BG checks passed: ${frames} Runway frames, 121 entrance/exit pairs, independent blur mask, aspect-correct placeholders, new catalogue geometry and persistent settings.`);
