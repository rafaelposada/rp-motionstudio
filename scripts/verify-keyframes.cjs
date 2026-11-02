// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module');
require('sucrase/register');const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...args);};
const k=require('../lib/keyframes');
const {useSceneStore}=require('../store/useSceneStore'),{buildScenePartial}=require('../lib/scenePersist');
const {audioGain,audioFilter}=require('../lib/audioEnvelope');
const {snapAlignment}=require('../lib/alignment');

// Interpolation and holds.
const list=[{t:0,v:0,ease:'linear'},{t:2,v:100}];
assert.equal(k.valueAt(list,-1,5),0);assert.equal(k.valueAt(list,1,5),50);assert.equal(k.valueAt(list,3,5),100);assert.equal(k.valueAt(undefined,1,7),7);
assert.equal(k.valueAt([{t:0,v:0,ease:'hold'},{t:1,v:10}],.9,0),0,'hold keeps the value until the next key');
const eased=k.valueAt([{t:0,v:0,ease:'ease'},{t:1,v:100}],.25,0);assert.ok(eased>0&&eased<25,'ease starts slower than linear');
// Editing keys.
let keys=k.setKey([],1,10);keys=k.setKey(keys,0,0);keys=k.setKey(keys,1+1e-4,20);
assert.deepEqual(keys.map(x=>[x.t,x.v]),[[0,0],[1,20]],'a key near an existing time replaces it, list stays sorted');
assert.equal(k.removeKey(keys,1).length,1);assert.ok(k.keyAt(keys,0));assert.equal(k.neighbourKey({keyframes:{x:keys}},0,1),1);assert.equal(k.neighbourKey({keyframes:{x:keys}},1,1),null);
// Layers: keyed props follow the curve, edits on keyed props write keys.
const layer={id:'a',x:10,y:20,opacity:1,rotation:0,keyframes:{x:[{t:0,v:0,ease:'linear'},{t:2,v:200}]}};
assert.equal(k.animatedLayer(layer,1).x,100);assert.equal(k.animatedLayer(layer,1).y,20,'unkeyed props keep their base value');
const patch=k.keyedPatch(layer,{x:50,y:5},1);assert.equal(patch.y,5);assert.equal(patch.x,undefined,'keyed x is written as a key, not the base');
assert.deepEqual(patch.keyframes.x.map(x=>[x.t,x.v]),[[0,0],[1,50],[2,200]]);
const on=k.toggleKeying({id:'b',opacity:.4},'opacity',1.5);assert.deepEqual(on.keyframes.opacity,[{t:1.5,v:.4}]);
const off=k.toggleKeying({id:'b',opacity:.4,keyframes:on.keyframes},'opacity',1.5);assert.equal(off.opacity,.4);assert.equal(off.keyframes.opacity,undefined);
// Persistence: keyframes and ruler guides travel with the project.
const s=useSceneStore.getState();s.resetScene();s.addTextLayer();const id=useSceneStore.getState().textLayers[0].id;
s.patchTextLayer(id,{keyframes:{y:[{t:0,v:100},{t:1,v:300}]}});s.setGuides({x:[100,NaN],y:[540]});
const saved=JSON.parse(JSON.stringify(buildScenePartial(useSceneStore.getState())));
assert.deepEqual(saved.guides,{x:[100],y:[540]},'non-finite guides are dropped');assert.equal(saved.textLayers[0].keyframes.y[1].v,300);
s.resetScene();s.hydrate(saved);assert.deepEqual(useSceneStore.getState().guides,{x:[100],y:[540]});assert.equal(useSceneStore.getState().textLayers[0].keyframes.y.length,2);
// Audio mute and ruler guide snapping.
assert.equal(audioGain({volume:1,fadeIn:0,fadeOut:0,muted:true},1,4),0);assert.ok(audioFilter({volume:.8,fadeIn:0,fadeOut:0,muted:true},4).startsWith('volume=0'));
const g=snapAlignment({x:10,y:96,width:10,height:10},[],6,{x:[],y:[100]});assert.equal(g.y,100);assert.equal(g.x,null);
console.log('Keyframe checks passed: interpolation/holds/easing, key editing and navigation, keyed edits, toggling, project persistence of keys and guides, audio mute and guide snapping.');
