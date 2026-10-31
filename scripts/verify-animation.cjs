const path=require('node:path'),Module=require('module'),assert=require('node:assert/strict');
require('sucrase/register');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...args);};
const {templateList,defaultsFor,easingFor}=require('../templates');
const {resolveEasing}=require('../lib/easing');
const {cardAspectFor}=require('../lib/crop');
const {cardOpacity}=require('../lib/cardOpacity');
const canvas=templateList.find(t=>t.meta.id==='blank-01'),defaults=defaultsFor('blank-01');
assert.equal(canvas.meta.staticByDefault,true);
const ctx={fps:30,width:810,height:1080,duration:8,totalFrames:240,ease:t=>t,easedPhase:t=>t,cardAspect:4/5};
let layouts=0;
for(const aspect of [9/16,3/4,4/5,1,16/9])for(const count of [1,3,4,5,12])for(const columns of [1,2,6])for(const size of [50,220,500])for(const gap of [0,40,100]){
  const v={...defaults,count,cols:columns,cardSize:size,gap},cols=Math.min(count,columns),poses=Array.from({length:count},(_,i)=>canvas.transform(0,i,count,v,{...ctx,cardAspect:aspect}));
  const width=size*Math.min(1,aspect),height=size*Math.min(1,1/aspect);
  for(let row=0;row<Math.ceil(count/cols);row++){
    const items=poses.slice(row*cols,Math.min(count,(row+1)*cols));
    assert.ok(Math.abs((items[0].x+items.at(-1).x)/2)<1e-8,'Every Canvas row is centered, including a partial last row');
    for(let i=1;i<items.length;i++)assert.ok(Math.abs(items[i].x-items[i-1].x-width-gap)<1e-8,'Horizontal gap matches final rendered card width');
    if(row>0)assert.ok(Math.abs(items[0].y-poses[(row-1)*cols].y-height-gap)<1e-8,'Vertical gap matches final rendered card height');
  }
  layouts++;
}
assert.deepEqual(canvas.transform(0,0,4,defaults,ctx),canvas.transform(60,0,4,defaults,ctx),'Legacy/default Canvas stays static');
const floating={...defaults,motion:'float',amplitude:12};
assert.notDeepEqual(canvas.transform(0,0,4,floating,ctx),canvas.transform(60,0,4,floating,ctx),'Optional float actually moves');
for(let i=0;i<4;i++){
  const a=canvas.transform(0,i,4,floating,ctx),b=canvas.transform(240,i,4,floating,ctx);
  assert.ok(Math.abs(a.x-b.x)<1e-8&&Math.abs(a.y-b.y)<1e-8,'Float closes its loop');
}
let animated=0;
for(const template of templateList){
  const v=defaultsFor(template.meta.id),count=Math.max(1,Math.round(v.count??6)),ease=resolveEasing(easingFor(template.meta.id));
  const context={...ctx,ease,easedPhase:p=>Math.floor(p)+ease(p-Math.floor(p)),cardAspect:cardAspectFor(template.meta,810,1080)};
  const transform=template.meta.engine==='webgl'&&template.transform3d?template.transform3d:template.transform;
  const initial=Array.from({length:count},(_,i)=>transform(0,i,count,v,context));let moves=false;
  for(let frame=1;frame<240;frame+=7)for(let i=0;i<count;i++){
    const pose=transform(frame,i,count,v,context);
    if(Object.keys(pose).some(key=>typeof pose[key]==='number'&&Math.abs(pose[key]-(initial[i][key]??0))>1e-6))moves=true;
    const alpha=cardOpacity(pose.alpha,false,pose.solidAlpha);
    assert.ok(alpha>=0&&alpha<=1,'Card alpha must remain in range');
    assert.ok(Math.abs(alpha-Math.max(0,Math.min(1,pose.solidAlpha??pose.alpha)))<1e-8,'Solid mode preserves temporal/visibility envelopes');
    assert.ok(Math.abs(cardOpacity(pose.alpha,true)-Math.max(0,Math.min(1,pose.alpha)))<1e-8,'Automatic mode retains original template fades');
  }
  if(!template.meta.staticByDefault)assert.ok(moves,`${template.meta.name} unexpectedly has no motion at defaults`);
  if(moves)animated++;
}
assert.equal(cardOpacity(0),0);assert.equal(cardOpacity(.6,false,1),1);assert.equal(cardOpacity(.6,true,1),.6);
assert.equal(cardOpacity(.3,false,.5),.5,'Removing depth dimming retains the entrance envelope');
const pulse=templateList.find(template=>template.meta.id==='flicker-01');
if(pulse){const v=defaultsFor(pulse.meta.id);for(let frame=0;frame<240;frame+=7){const pose=pulse.transform(frame,0,v.count,v,ctx);assert.equal(cardOpacity(pose.alpha,false,pose.solidAlpha),pose.alpha,'Crossfades remain active in Pulse');}}
console.log(`Animation checks passed: ${layouts} Canvas layouts, static/float and loop; ${animated}/${templateList.length} moving defaults (one intentional static base); card alpha checked across the catalogue.`);
