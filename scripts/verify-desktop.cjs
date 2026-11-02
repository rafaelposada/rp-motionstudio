// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {trustedURL,externalURL,closeCoordinator,closeCopy}=require('../desktop/policy.cjs');
async function main(){
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
  console.log('Desktop checks passed: URL/IPC policy, all close choices, duplicate close, disk failure, busy guard and isolated renderer.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
