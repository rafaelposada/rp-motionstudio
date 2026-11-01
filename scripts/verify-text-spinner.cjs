const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
require('sucrase/register');const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...args);};
const {templateList,defaultsFor,easingFor}=require('../templates'),{resolveEasing}=require('../lib/easing'),{cardOpacity}=require('../lib/cardOpacity');
const {historyShortcut}=require('../lib/historyShortcuts'),{useSceneStore}=require('../store/useSceneStore'),{useHistoryStore}=require('../store/useHistoryStore'),{buildScenePartial}=require('../lib/scenePersist');
const {TextCompositor}=require('../lib/textLayers');
const THREE=require('three'),near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const {previewMatrix}=require('../lib/templatePreviewGeometry');
for(const r of [-Math.PI,-.8,0,.8,Math.PI])for(const skew of [-Math.PI,-1.57,0,1.57,Math.PI]){
  const m=previewMatrix(r,skew,0);near(Math.hypot(m[0],m[1]),1);near(Math.hypot(m[2],m[3]),1);
}
const key=(extra={})=>({key:'z',code:'KeyZ',metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,...extra});
assert.equal(historyShortcut(key({metaKey:true})),'undo');assert.equal(historyShortcut(key({metaKey:true,shiftKey:true,key:'Z'})),'redo');
assert.equal(historyShortcut(key({ctrlKey:true})),'undo');assert.equal(historyShortcut(key({ctrlKey:true,shiftKey:true})),'redo');
assert.equal(historyShortcut(key({key:'y',code:'KeyY',ctrlKey:true})),'redo');
assert.equal(historyShortcut(key({ctrlKey:true,altKey:true})),null);assert.equal(historyShortcut(key({ctrlKey:true,isComposing:true})),null);
const s=useSceneStore.getState();s.resetScene();s.addTextLayer();const id=useSceneStore.getState().textLayers[0].id;
const history=useHistoryStore.getState(),stop=history.start();history.reset();
history.beginGesture();s.patchTextLayer(id,{text:'Texto confirmado com Esc',backdrop:true,backdropColor:'#123456',backdropOpacity:.4,backdropStroke:'#abcdef',backdropStrokeOpacity:.25,backdropStrokeWidth:6});history.endGesture();
assert.equal(history.past.length,0);assert.equal(useHistoryStore.getState().past.length,1);
history.undo();assert.notEqual(useSceneStore.getState().textLayers[0].text,'Texto confirmado com Esc');history.redo();
assert.equal(useSceneStore.getState().textLayers[0].text,'Texto confirmado com Esc');
const saved=buildScenePartial(useSceneStore.getState());s.hydrate(saved);assert.equal(useSceneStore.getState().textLayers[0].backdropStrokeOpacity,.25);stop();history.reset();
const records=[],stack=[];
const ctx=new Proxy({globalAlpha:1,fillStyle:'',strokeStyle:'',save(){stack.push({alpha:this.globalAlpha,fill:this.fillStyle,stroke:this.strokeStyle});},restore(){const v=stack.pop();this.globalAlpha=v.alpha;this.fillStyle=v.fill;this.strokeStyle=v.stroke;},measureText:t=>({width:t.length*20}),fill(){records.push(['fill',this.fillStyle,this.globalAlpha]);},stroke(){records.push(['stroke',this.strokeStyle,this.globalAlpha,this.lineWidth]);},fillText(){records.push(['text',this.fillStyle,this.globalAlpha]);}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
global.document={fonts:{check:()=>true},createElement:()=>({width:500,height:500,style:{setProperty(){},removeProperty(){}},getContext:()=>ctx,remove(){}})};
const layer={...useSceneStore.getState().textLayers[0],opacity:.5,animation:'none',entrance:'none',exit:'none'};
new TextCompositor().render(document.createElement('canvas'),[layer],500,500,1,false,null,true);
assert.deepEqual(records.find(r=>r[0]==='fill'),['fill','#123456',.2]);
assert.deepEqual(records.find(r=>r[0]==='stroke'),['stroke','#abcdef',.125,6]);
near(records.find(r=>r[0]==='text')[2],.5);
let checked=0;
for(const template of templateList.filter(t=>/^(spinner|hinge|fan)-/.test(t.meta.id))){
  for(const aspect of [9/16,4/5,1,4/3,16/9]){
    const v=defaultsFor(template.meta.id),ease=resolveEasing(easingFor(template.meta.id)),ctx={width:810,height:1080,fps:30,totalFrames:240,duration:8,ease,easedPhase:p=>Math.floor(p)+ease(p-Math.floor(p)),cardAspect:aspect};
    const pose=template.camera(v,ctx),camera=new THREE.PerspectiveCamera(pose.fov,ctx.width/ctx.height,pose.near,pose.far);
    camera.position.set(pose.position.x,-pose.position.y,pose.position.z);camera.lookAt(pose.target.x,-pose.target.y,pose.target.z);camera.updateMatrixWorld();camera.updateProjectionMatrix();
    for(const frame of [0,1,59,119,179,239])for(let i=0;i<v.count;i++){
      const a=template.transform(frame,i,v.count,v,ctx),b=template.transform3d(frame,i,v.count,v,ctx);
      for(const n of [a.x,a.y,a.scale,a.alpha,b.x,b.y,b.z,b.scale,b.alpha,b.solidAlpha])assert.ok(Number.isFinite(n));
      const q=b.quaternion;near(Math.hypot(q.x,q.y,q.z,q.w),1);
      const m=previewMatrix(a.rotation,a.skewX??0,a.skewY??0);
      const u=new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));
      const axisY=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));
      near(m[0]*(a.scaleX??1),u.x);near(m[1]*(a.scaleX??1),-u.y);
      near(m[2]*(a.scaleY??1),axisY.x);near(m[3]*(a.scaleY??1),-axisY.y);
      const projected=new THREE.Vector3(b.x,-b.y,b.z).project(camera);near(projected.x*ctx.width/2,a.x);near(-projected.y*ctx.height/2,a.y);
      checked++;
    }
    const a=template.transform3d(0,0,v.count,v,ctx),z=template.transform3d(240,0,v.count,v,ctx);near(a.x,z.x);near(a.y,z.y);near(a.z,z.z);
    const fade={...v,fade:80,fadeMode:'alpha',frontface:'show',backface:'show'};
    for(let i=0;i<v.count;i++){const t=template.transform3d(40,i,v.count,fade,ctx);near(cardOpacity(t.alpha,false,t.solidAlpha),1);near(cardOpacity(t.alpha,true,t.solidAlpha),t.alpha);}
    const hidden={...v,frontface:'hide',backface:'hide'};near(template.transform3d(40,0,v.count,hidden,ctx).solidAlpha,0);
    const mutable={...v,fade:50};template.transform3d(30,0,v.count,mutable,ctx);mutable.rotateX+=31;mutable.axis=mutable.axis==='vertical'?'horizontal':'vertical';
    near(template.transform3d(30,0,v.count,mutable,ctx).alpha,template.transform3d(30,0,v.count,{...mutable},ctx).alpha);
  }
}
const inline=fs.readFileSync(path.join(root,'components/CanvasInlineTextEditor.tsx'),'utf8');assert.ok(!inline.includes('finish(true)'),'Escape commits inline text');
assert.match(fs.readFileSync(path.join(root,'lib/renderer3d.ts'),'utf8'),/singlePass = !physical && !bent/);
async function asynchronousRedoRegression(){
  const state=useSceneStore.getState();state.resetScene();state.addTextLayer();
  const id=useSceneStore.getState().textLayers[0].id,h=useHistoryStore.getState(),unsubscribe=h.start();h.reset();
  h.beginGesture();state.patchTextLayer(id,{text:'Persistir refazer após restaurar mídia'});h.endGesture();h.undo();
  await useSceneStore.getState().rehydrateUploads();
  const before=useSceneStore.getState();await before.rehydrateUploads();assert.equal(useSceneStore.getState(),before,'Repeated upload restoration is a true no-op');
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(useHistoryStore.getState().canRedo,true,'Async media restoration must not erase Redo');
  h.redo();assert.equal(useSceneStore.getState().textLayers[0].text,'Persistir refazer após restaurar mídia');
  unsubscribe();h.reset();
  console.log(`Text/Spinner checks passed: Mac/Windows undo-redo including async restoration, committed text and backdrop persistence, independent fill/stroke alpha, ${checked} camera/pose projections across Spinner/Hinge/Fan, loop closure and visibility/depth toggles.`);
}
asynchronousRedoRegression().catch(error=>{console.error(error);process.exitCode=1;});
