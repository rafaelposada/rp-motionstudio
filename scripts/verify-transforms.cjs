const path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
require('sucrase/register');
const resolve=Module._resolveFilename,root=path.resolve(__dirname,'..');
Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...args);};
const {resizeFrame,framePoint,mapFramePoint,pointerRotation,normalizedAngle,normalizedRadii,ANCHOR_AXES,RESIZE_ANCHORS}=require('../lib/transformGeometry');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
let cases=0;
for(const rotation of [-179,-90,-45,0,37,90,179])for(const anchor of RESIZE_ANCHORS)for(const [width,height] of [[100,200],[600,70],[10,10]])for(const [x,y] of [[-300,-200],[-15,70],[0,0],[20,30],[500,800]])for(const proportional of [false,true])for(const centered of [false,true]){
  const before={cx:230,cy:480,width,height,rotation},after=resizeFrame(before,{x,y},anchor,{proportional,centered,minWidth:4,minHeight:4,maxWidth:2000,maxHeight:2000});
  assert.ok(after.width>=4-1e-7&&after.height>=4-1e-7&&after.width<=2000+1e-7&&after.height<=2000+1e-7);
  const [ax,ay]=ANCHOR_AXES[anchor];
  if(centered){near(before.cx,after.cx);near(before.cy,after.cy);}
  else {const a=framePoint(before,-ax,-ay),b=framePoint(after,-ax,-ay);near(a.x,b.x);near(a.y,b.y);}
  if(proportional)near(after.width/after.height,width/height);
  const origin={x:73,y:159},mapped=mapFramePoint(origin,before,after),restored=mapFramePoint(mapped,after,before);
  near(restored.x,origin.x);near(restored.y,origin.y);cases++;
}
assert.equal(normalizedAngle(181),-179);assert.equal(normalizedAngle(-181),179);
const frame={cx:0,cy:0,width:100,height:200,rotation:0};
near(pointerRotation(frame,{x:0,y:-100},{x:100,y:0},0),90);
assert.equal(pointerRotation(frame,{x:0,y:-100},{x:20,y:-100},0,true),15);
assert.deepEqual(normalizedRadii(200,100,[-1,20,100,NaN]),[0,20,50,0]);

const {TextCompositor}=require('../lib/textLayers'),{useSceneStore}=require('../store/useSceneStore'),{useHistoryStore}=require('../store/useHistoryStore'),{buildScenePartial}=require('../lib/scenePersist');
const calls=[];const ctx=new Proxy({globalAlpha:1,measureText:t=>({width:t.length*20})},{get:(o,k)=>k in o?o[k]:(...args)=>{calls.push([k,...args]);},set:(o,k,v)=>{o[k]=v;return true;}});
global.document={createElement:()=>({width:0,height:0,style:{setProperty(){},removeProperty(){}},getContext:()=>ctx,remove(){}})};
const source={width:1600,height:2000,style:{removeProperty(){}}};
useSceneStore.getState().resetScene();useSceneStore.getState().addTextLayer();
const s=useSceneStore.getState(),id=s.textLayers[0].id;
s.patchTextLayer(id,{font:'Arial',scaleX:2,scaleY:.5,backdropRadius:22,media:{blobId:'fixture',url:'blob:fixture',width:200,height:100,fit:'cover',cornerRadii:[10,20,30,40]}});
const layer=useSceneStore.getState().textLayers[0];
new TextCompositor().render(source,[layer],800,1000,1,false,{width:100,height:100,complete:true},true);
assert.ok(calls.some(c=>c[0]==='scale'&&c[1]===2&&c[2]===.5),'Rasterization applies text/media scale in both backends');
const round=calls.find(c=>c[0]==='roundRect');assert.deepEqual(round.slice(1),[-100,-50,200,100,[10,20,30,40]],'Independent image corners clip the actual raster');
const saved=buildScenePartial(useSceneStore.getState());s.hydrate(saved);
assert.equal(useSceneStore.getState().textLayers[0].scaleX,2);
assert.deepEqual(useSceneStore.getState().textLayers[0].media.cornerRadii,[10,20,30,40]);
const h=useHistoryStore.getState(),stop=h.start();h.reset();
h.beginGesture();for(let i=1;i<=20;i++)useSceneStore.getState().patchTextLayer(id,{scaleX:2+i/20});
assert.equal(useHistoryStore.getState().past.length,0);h.endGesture();
assert.equal(useHistoryStore.getState().past.length,1,'One full drag creates one undo entry');
h.undo();near(useSceneStore.getState().textLayers[0].scaleX,2);h.redo();near(useSceneStore.getState().textLayers[0].scaleX,3);
const prior=useSceneStore.getState().textLayers[0],count=useHistoryStore.getState().past.length;
h.beginGesture();useSceneStore.getState().patchTextLayer(id,{rotation:70});useSceneStore.getState().patchTextLayer(id,prior);h.endGesture(true);
assert.equal(useHistoryStore.getState().past.length,count,'Esc restoration does not leave a no-op undo entry');
stop();h.reset();
console.log(`Transform checks passed: ${cases} rotated/anchored resize cases, center scaling, aspect, rotation snapping, raster corners, persistence and gesture undo/cancel.`);

// Exercise the real slot-binding method across an export/preview cache swap.
// No GPU is needed: the slot already exists, and only its async texture bind runs.
async function verifyTextureRestore(){
  const originalLoad=Module._load;
  Module._load=function(request,...args){
    if(['pixi.js','pixi-filters','@/effects'].includes(request))return {};
    return originalLoad.call(this,request,...args);
  };
  let SceneRenderer;
  try { ({SceneRenderer}=require('../lib/renderer')); } finally { Module._load=originalLoad; }
  const renderer=Object.create(SceneRenderer.prototype),url='blob:restore-test';
  const original={width:2000,height:3000},preview={width:200,height:300},painted=[];
  renderer.textureCache=new Map([[url,original]]);
  renderer.loadTexture=()=>Promise.resolve(renderer.textureCache.get(url));
  renderer.croppedView=(_url,base)=>{painted.push(base);return base;};
  renderer.placeholder={};
  const slot={sprite:{destroyed:false},label:{style:{}},bindKey:'',cornerR:-1};
  const runtime={slots:[slot],countSig:-1,assetSig:''};
  const scene=useSceneStore.getState(),track={...scene.tracks[0],values:{...scene.tracks[0].values,count:1},assetIds:['restore-test']};
  const state={...scene,assets:[{id:'restore-test',url,visible:true,origin:'upload',kind:'image',fit:'fill'}]};
  renderer.syncTrackSlots(track,runtime,state);
  renderer.textureCache.set(url,preview);runtime.assetSig='';runtime.countSig=-1;
  renderer.syncTrackSlots(track,runtime,state);
  await Promise.resolve();
  assert.deepEqual(painted,[preview],'Retired export textures must not create crops during preview restoration');
  assert.equal(slot.sprite.texture,preview);
  console.log('Export restoration check passed: stale original binding is ignored; the preview remains visible.');
}
verifyTextureRestore().catch(error=>{console.error(error);process.exitCode=1;});
