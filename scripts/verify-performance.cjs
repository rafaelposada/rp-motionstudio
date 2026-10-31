const assert = require('node:assert/strict');
require('sucrase/register');
const { loadImage, loadPreviewImage, previewImageSize, clearPreviewImages } = require('../lib/textureLoad');
const { OverlayRaster, textMotion } = require('../lib/textLayers');
const { shadowRenderRegion } = require('../lib/textShadow');
let decodes=0,active=0,peak=0,draws=0;
global.Image=class {
  width=6000;height=4000;naturalWidth=6000;naturalHeight=4000;complete=true;
  async decode(){decodes++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));active--;}
};
const context=()=>new Proxy({globalAlpha:1,measureText:t=>({width:t.length*30}),getTransform:()=>({a:2,b:0,c:0,d:2,e:1080,f:1920})},{get:(obj,key)=>key in obj?obj[key]:(...args)=>{if(key==='drawImage')draws++;},set:(obj,key,value)=>{obj[key]=value;return true;}});
global.document={fonts:{check:()=>true},createElement:()=>{const ctx=context();return{width:0,height:0,style:{setProperty(){},removeProperty(){}},getContext:()=>ctx,remove(){}};}};
async function main(){
  assert.deepEqual(previewImageSize(6000,4000),{width:2048,height:1365});
  assert.deepEqual(previewImageSize(4000,6000),{width:1365,height:2048});
  assert.deepEqual(previewImageSize(500,700),{width:500,height:700});
  const requests=Array.from({length:10},()=>loadPreviewImage('photo-main'));
  const sources=await Promise.all(requests);
  assert.equal(decodes,1,'Duplicate preview requests share one decode');
  assert.ok(sources.every(source=>source===sources[0]));
  assert.equal(sources[0].width,2048);
  const original=await loadImage('photo-main');
  assert.equal(original.width,6000,'Export loading retains original pixel dimensions');
  const before=decodes;await loadPreviewImage('photo-main');assert.equal(decodes,before,'A prepared preview is reused');
  await Promise.all(Array.from({length:12},(_,i)=>loadPreviewImage(`batch-${i}`)));
  assert.ok(peak<=2,'At most two full photo decodes run concurrently');
  clearPreviewImages();
  const layer={id:'test',text:'Texto de diagnóstico',font:'Arial',weight:400,size:64,color:'#ffffff',x:540,y:960,rotation:0,opacity:1,align:'center',lineHeight:1.2,visible:true,start:0,end:10,animation:'fade',shadowColor:'#000000',shadowType:'realistic'};
  const raster=new OverlayRaster();let settled=0;draws=0;
  for(let i=0;i<30;i++)if(raster.update(layer,1080,1920,2,1+i/30))settled++;
  assert.equal(settled,1,'A settled text entrance with shadow reuses one raster for 30 frames');
  assert.deepEqual(textMotion(layer,1),textMotion(layer,1.9));
  let transition=0;for(let i=0;i<10;i++)if(raster.update(layer,1080,1920,2,i/30))transition++;
  assert.ok(transition>=9,'The entrance still animates');
  assert.equal(raster.update({...layer,color:'#ff0000'},1080,1920,2,2),true,'Edits invalidate the cache');
  assert.equal(raster.update(layer,1080,1920,3,2),true,'Export density invalidates the cache');
  const settings={color:'#000000',opacity:.5,blur:12,x:5,y:10,spread:3,position:'outside',type:'realistic'};
  const region=shadowRenderRegion(2160,3840,2,settings,{x:-300,y:-64,width:600,height:128},{a:2,b:0,c:0,d:2,e:1080,f:1920});
  assert.ok(region.width*region.height<2160*3840*.25,'Shadow masks use the text region instead of the entire composition');
  assert.ok(region.x>=0&&region.y>=0&&region.x+region.width<=2160&&region.y+region.height<=3840);
  raster.destroy();
  console.log(`Performance checks passed: 6000×4000 → 2048×1365 preview, originals unchanged; peak ${peak} concurrent decodes; settled animated shadow ${settled}/30 rasters; shadow masks ${region.width}×${region.height} instead of 2160×3840.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
