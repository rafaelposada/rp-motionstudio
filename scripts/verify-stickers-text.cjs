const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module');
require('sucrase/register');const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...args);};
const {getTemplate,defaultsFor,templateList}=require('../templates');
const {stickerSchedule,stickerMetrics}=require('../templates/stickersExact');
const {makeStickerRollGeometry}=require('../three3d/cardMesh');
const THREE=require('three');
const {useSceneStore}=require('../store/useSceneStore'),{useUIStore}=require('../store/useUIStore'),{useHistoryStore}=require('../store/useHistoryStore');
const {addCompositionText,textToolShortcut}=require('../lib/textActions');
const {trackAssetIndices}=require('../lib/tracks'),{countDemoSlotsInUse}=require('../lib/demoUsage');
const media=[{id:'demo1',origin:'demo'},{id:'photo',origin:'upload'},{id:'demo2',origin:'demo'}];
const repeatedTrack={id:'stickers',templateId:'stickers-03',visible:true,opacity:1,assetIds:[],values:{count:9}};
assert.deepEqual(trackAssetIndices(repeatedTrack,media,true),[1],'Repeated fields must use imported media instead of leftover demos');
assert.deepEqual(trackAssetIndices(repeatedTrack,media),[0,1,2],'Non-repeating positional slots must stay unchanged');
assert.deepEqual(trackAssetIndices({...repeatedTrack,assetIds:['demo2']},media,true),[2],'Explicit track subsets must not pull media from other tracks');
assert.deepEqual(trackAssetIndices(repeatedTrack,media.filter(a=>a.origin==='demo'),true),[0,1],'Demo-only projects must retain placeholders');
assert.equal(countDemoSlotsInUse({tracks:[repeatedTrack],assets:media}),0,'Export warning must agree with repeated preview media');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const base={fps:30,width:810,height:1080,duration:8,totalFrames:240,ease:x=>x,easedPhase:x=>x,cardAspect:1};
const schedule=stickerSchedule(17,'in',1);assert.equal(schedule,stickerSchedule(17,'in',1),'Per-card transforms must reuse the same schedule');
assert.ok(Math.min(...schedule.actions)>1,'Short clips cannot collapse roll actions to 0.01 seconds');
const rolling=getTemplate('stickers-01'),values=defaultsFor('stickers-01'),fronts=new Set();
for(let frame=0;frame<=240;frame++)fronts.add(rolling.transform3d(frame,8,17,values,base).stickerPeelFront.toFixed(4));
assert.ok(fronts.size>8,'An 8-second clip needs intermediate roll frames rather than popping cards');
let checked=0;
for(const height of [720,1080,2160,3840])for(const id of ['stickers-01','stickers-02','stickers-03','poster-01']){
  const t=getTemplate(id),v=defaultsFor(id),ctx={...base,height},nearPlane=t.camera(v,ctx).near;
  const camera=new THREE.PerspectiveCamera(65,1,nearPlane,height*8),distance=height/2/Math.tan(65*Math.PI/360);
  camera.position.z=distance;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const a=t.transform3d(0,0,v.count,v,ctx),b=t.transform3d(0,1,v.count,v,ctx);
  const za=new THREE.Vector3(0,0,a.z).project(camera).z,zb=new THREE.Vector3(0,0,b.z).project(camera).z;
  assert.ok(Math.abs(za-zb)/2*(2**24-1)>4,`${id} needs separable depth even at ${height}px`);
}
for(const template of templateList.filter(t=>t.meta.group==='Stickers')){
  const v=defaultsFor(template.meta.id),count=Number(v.count);
  for(const aspect of [9/16,4/5,1,16/9])for(const phase of [0,.1,.25,.5,.75,.99,1])for(let index=0;index<count;index++){
    const pose=template.transform3d(phase*240,index,count,v,{...base,cardAspect:aspect});
    for(const value of Object.values(pose))if(typeof value==='number')assert.ok(Number.isFinite(value),template.meta.id);
    assert.ok(pose.scale>0&&pose.alpha>=0&&pose.alpha<=1);checked++;
  }
}
for(const id of ['stickers-01','stickers-02','stickers-03']){
  const t=getTemplate(id),v=defaultsFor(id),a=t.transform3d(0,0,v.count,v,base),b=t.transform3d(0,1,v.count,v,base);
  assert.ok(b.z-a.z>.5,`${id}: image layers need pixel-scale depth separation`);
  for(const phase of [.05,.25,.5,.75,.95]){
    const a=t.transform3d(phase*240,1,v.count,v,base),b=t.transform3d(phase*1080,1,v.count,v,{...base,totalFrames:1080,duration:36});
    near(a.stickerPeelFront,b.stickerPeelFront);
  }
}
for(const aspect of [9/16,4/5,1,16/9])for(const direction of [0,50,90,130,180,270,310]){
  const t=getTemplate('stickers-03'),v={...defaultsFor('stickers-03'),angle:'normal',peelFrom:({0:'right',50:'top right',90:'top',130:'top left',180:'left',270:'bottom',310:'bottom right'})[direction],peelAmount:0,amount:'random'};
  const ctx={...base,cardAspect:aspect},pose=t.transform3d(120,1,v.count,v,ctx),metrics=stickerMetrics(v.cardSize,ctx);
  const edge=(metrics.width*Math.abs(Math.cos(direction*Math.PI/180))+metrics.height*Math.abs(Math.sin(direction*Math.PI/180)))/2/metrics.width;
  near(pose.stickerPeelFront,edge);
  const flat=makeStickerRollGeometry(pose.stickerPeelFront,pose.stickerCurlRadius,direction,aspect),p=flat.attributes.position,uv=flat.attributes.uv;
  for(let i=0;i<p.count;i++){near(p.getZ(i),0);near(p.getX(i),uv.getX(i)-.5);near(p.getY(i),uv.getY(i)-.5);}flat.dispose();
  const bent=makeStickerRollGeometry(0,.15,direction,aspect),bp=bent.attributes.position;
  for(let i=0;i<bp.count;i++)for(let axis=0;axis<3;axis++)assert.ok(Number.isFinite(bp.array[i*3+axis]));
  // Physical edges cannot stretch when a portrait or landscape card curls.
  const distance=(i,j)=>Math.hypot(bp.getX(i)-bp.getX(j),(bp.getY(i)-bp.getY(j))/aspect,bp.getZ(i)-bp.getZ(j));
  for(let row=0;row<33;row++)for(let col=0;col<33;col++){
    const i=row*33+col;if(col<32)assert.ok(distance(i,i+1)<=1/32+1e-5);if(row<32)assert.ok(distance(i,i+33)<=1/32/aspect+1e-5);
  }bent.dispose();
}
const random=getTemplate('stickers-03'),rv=defaultsFor('stickers-03');
const right=random.transform3d(120,0,rv.count,{...rv,peelFrom:'right'},base),top=random.transform3d(120,0,rv.count,{...rv,peelFrom:'top'},base);
near((top.peelDirection-right.peelDirection+360)%360,90);
assert.ok(textToolShortcut({key:'t'}));assert.ok(textToolShortcut({key:'T'}));
for(const flag of ['repeat','isComposing','metaKey','ctrlKey','altKey','defaultPrevented'])assert.equal(textToolShortcut({key:'t',[flag]:true}),false);
const s=useSceneStore.getState();s.resetScene();s.setFrame(60);useUIStore.setState({locale:'pt'});
const history=useHistoryStore.getState(),stop=history.start();history.reset();
assert.equal(addCompositionText({x:-1,y:40}),null);assert.equal(useSceneStore.getState().textLayers.length,0);
const id=addCompositionText({x:120,y:240}),created=useSceneStore.getState().textLayers[0];
assert.equal(created.id,id);assert.equal(created.text,'Seu texto');assert.equal(created.x,120);assert.equal(created.y,240);assert.equal(created.align,'left');assert.equal(useSceneStore.getState().playing,false);
assert.equal(useUIStore.getState().selectedTextId,id);assert.equal(useHistoryStore.getState().past.length,1);
history.undo();assert.equal(useSceneStore.getState().textLayers.length,0);history.redo();assert.equal(useSceneStore.getState().textLayers[0].x,120);
stop();history.reset();
console.log(`Stickers/text checks passed: ${checked} family poses, stable pixel depth, duration-independent rolls, cached schedules, zero peel, directional/aspect-correct folds and one-step text creation/undo.`);
