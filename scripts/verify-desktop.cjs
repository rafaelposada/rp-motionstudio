// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {trustedURL,externalURL,closeCoordinator,closeCopy}=require('../desktop/policy.cjs');
const {prepareRuntime}=require('../desktop/runtime.cjs');
async function main(){
  require('sucrase/register');
  const {mediaExecutable}=require('../lib/mediaExecutable');
  assert.equal(mediaExecutable('ffmpeg','darwin',{}),'ffmpeg');
  assert.equal(mediaExecutable('ffprobe','darwin',{RP_MOTION_DESKTOP:'1',RP_MEDIA_BIN:'/bundle/media/bin'}),'/bundle/media/bin/ffprobe');
  assert.equal(mediaExecutable('ffmpeg','win32',{RP_MOTION_DESKTOP:'1',RP_MEDIA_BIN:'/bundle/media/bin'}),'/bundle/media/bin/ffmpeg.exe');
  assert.throws(()=>mediaExecutable('ffmpeg','darwin',{RP_MOTION_DESKTOP:'1'}),/Componentes de mídia ausentes/);
  const temporary=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'rp-runtime-verification-'));
  try{
    const source=path.join(temporary,'bundle'),root=path.join(temporary,'data');
    for(const dir of ['.next/cache','.next/server/route-cache','public/exports'])fs.mkdirSync(path.join(source,dir),{recursive:true});
    fs.writeFileSync(path.join(source,'server.js'),'fixture service');fs.writeFileSync(path.join(source,'.next/BUILD_ID'),'fixture-1');
    fs.writeFileSync(path.join(source,'.next/cache/test'),'discardable cache');fs.writeFileSync(path.join(source,'public/exports/test'),'private proxy');
    const first=await prepareRuntime(source,root);
    assert.notEqual(first,source);assert.equal(fs.readFileSync(path.join(first,'server.js'),'utf8'),'fixture service');
    assert.equal(fs.existsSync(path.join(first,'public/exports/test')),false);assert.equal(fs.existsSync(path.join(first,'.next/cache/test')),false);
    fs.mkdirSync(path.join(first,'.next/server/route-cache'),{recursive:true});fs.writeFileSync(path.join(first,'.next/server/route-cache/new'),'new cache');
    assert.equal(fs.existsSync(path.join(source,'.next/server/route-cache/new')),false,'Runtime writes must leave the bundled source intact');
    assert.equal(await prepareRuntime(source,root),first,'Reopen must reuse the generated copy');
    fs.writeFileSync(path.join(source,'public/apple-touch-icon.png'),'updated icon');
    const refreshed=await prepareRuntime(source,root);
    assert.notEqual(refreshed,first,'An icon update must refresh the disposable runtime without touching project data');
    assert.equal(fs.existsSync(first),false);
    fs.mkdirSync(path.join(root,'user-files'));fs.writeFileSync(path.join(root,'user-files/project'),'preserve');
    fs.writeFileSync(path.join(source,'.next/BUILD_ID'),'fixture-2');const second=await prepareRuntime(source,root);
    assert.notEqual(refreshed,second);assert.equal(fs.existsSync(refreshed),false);assert.equal(fs.readFileSync(path.join(root,'user-files/project'),'utf8'),'preserve');
    fs.writeFileSync(path.join(second,'.rp-runtime.json'),'{}');await assert.rejects(()=>prepareRuntime(source,root),/não identificados/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
  for(const u of ['rp-motion://app/','rp-motion://app/?x=1'])assert.ok(trustedURL(u));
  for(const u of ['https://app/','rp-motion://evil/','rp-motion://user@app/','rp-motion://app:80/','file:///tmp/test','javascript:alert(1)'])assert.equal(trustedURL(u),false);
  for(const u of ['https://rafaelposada.com','mailto:contato@rafaelposada.com'])assert.ok(externalURL(u));
  for(const u of ['file:///etc/passwd','javascript:alert(1)','http://localhost:3000','https://user:pass@example.com'])assert.equal(externalURL(u),false);
  for(const pt of [true,false])for(const unsaved of [true,false])assert.equal(closeCopy(pt,{name:'Fixture',unsaved}).buttons.length,3);
  for(const choice of [0,1,2,undefined]){
    const actions=[],errors=[];let finished=0;
    const close=closeCoordinator({request:async action=>{actions.push(action);return {pt:true,hasProject:true,name:'Fixture'};},confirm:async()=>choice,showError:async e=>errors.push(e),finish:async()=>{finished++;}});
    assert.equal(await close(),choice===0||choice===1);assert.equal(finished,choice===0||choice===1?1:0);assert.deepEqual(actions,choice===0?['status','save-draft']:['status']);assert.equal(errors.length,0);
  }
  for(const failure of ['status','save-draft']){
    let finished=false,error='';const close=closeCoordinator({request:async action=>{if(action===failure)throw Error('Disk full');return {hasProject:true};},confirm:async()=>0,showError:async e=>{error=e;},finish:async()=>{finished=true;}});
    assert.equal(await close(),false);assert.equal(finished,false);assert.equal(error,'Disk full');
  }
  let response,finished=0,prompts=0;
  const close=closeCoordinator({request:()=>new Promise(resolve=>{response=resolve;}),confirm:async()=>{prompts++;return 1;},showError:async()=>{},finish:async()=>{finished++;}});
  const first=close();assert.equal(await close(),false,'Repeated close events must not stack dialogs');response({hasProject:true});assert.equal(await first,true);assert.equal(finished,1);assert.equal(prompts,1);
  const busyClose=closeCoordinator({request:async()=>({busy:true,pt:true}),confirm:async()=>{throw Error('Should not prompt');},showError:async()=>{},finish:async()=>{throw Error('Must not close while writing');}});assert.equal(await busyClose(),false);
  const source=fs.readFileSync(path.join(__dirname,'../desktop/main.cjs'),'utf8');
  for(const guard of ['contextIsolation:true','nodeIntegration:false','sandbox:true','webSecurity:true','permission','validSender','127.0.0.1','rp:ready'])assert.ok(source.toLowerCase().includes(guard.toLowerCase()));
  const bridge=fs.readFileSync(path.join(__dirname,'../components/DesktopSystem.tsx'),'utf8');
  const importFlow=bridge.slice(bridge.indexOf("action==='open-project'"));
  assert.ok(importFlow.indexOf('.open(imported.id)')<importFlow.indexOf('.refresh()'),'Hydrate imported composition before refreshing the persisted active id');
  assert.match(bridge,/finally\{if\(ownsWork\)working=false;/,'A rejected overlapping request must not release another operation');
  assert.match(source,/accelerator:'CmdOrCtrl\+A'.*menuCommand\('select-all'\)/);
  const welcome=fs.readFileSync(path.join(__dirname,'../components/WelcomeDialog.tsx'),'utf8');
  assert.match(welcome,/Apache 2.0/);assert.doesNotMatch(welcome,/type="checkbox"|PolyForm|non-commercial|uso comercial/i);
  const renderer=fs.readFileSync(path.join(__dirname,'../lib/renderer.ts'),'utf8');
  assert.match(renderer,/if \(desktopAPI\(\)\) await import\('pixi.js\/unsafe-eval'\)/);
  assert.doesNotMatch(source,/script-src[^";]*'unsafe-eval'/,'The desktop must keep runtime code generation blocked');
  console.log('Desktop checks passed: immutable bundled runtime, marked cache cleanup, URL/IPC policy, all close choices, duplicate close, disk failure, busy guard and isolated renderer.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
