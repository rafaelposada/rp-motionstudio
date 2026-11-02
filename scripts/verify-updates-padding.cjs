// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),{spawn}=require('node:child_process'),net=require('node:net');
require('sucrase/register');const project=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(request,parent,...args){return resolve.call(this,request.startsWith('@/')?path.join(project,request.slice(2)):request,parent,...args);};
const common=require('./update-common.cjs'),{textPadding,textBackdropBox}=require('../lib/textPadding'),{TextCompositor}=require('../lib/textLayers'),{buildScenePartial}=require('../lib/scenePersist'),{useSceneStore}=require('../store/useSceneStore');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(check,ms=15000){const end=Date.now()+ms;while(Date.now()<end){const result=await check();if(result)return result;await delay(100);}throw Error('Timeout da verificação.');}
async function freePort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
async function main(){
  assert.deepEqual(textPadding(),[15,18,15,18]);assert.deepEqual(textPadding(0),[0,0,0,0]);assert.deepEqual(textPadding(20),[20,20,20,20]);assert.deepEqual(textPadding([-4,800,NaN,7]),[0,400,0,7]);
  assert.deepEqual(textBackdropBox(100,40,'center',[10,20,30,40]),{x:-90,y:-30,width:160,height:80});
  assert.equal(textBackdropBox(100,40,'left',0).x,0);assert.equal(textBackdropBox(100,40,'right',0).x,-100);
  const scene=useSceneStore.getState();scene.resetScene();scene.addTextLayer();const id=useSceneStore.getState().textLayers[0].id;scene.patchTextLayer(id,{backdrop:true,backdropPadding:[10,20,30,40]});assert.deepEqual(buildScenePartial(useSceneStore.getState()).textLayers[0].backdropPadding,[10,20,30,40]);
  const rectangles=[];const ctx=new Proxy({globalAlpha:1,measureText:t=>({width:t.length*10}),roundRect(...args){rectangles.push(args);}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  global.document={createElement:()=>({width:600,height:600,style:{setProperty(){},removeProperty(){}},getContext:()=>ctx,remove(){}})};
  const layer={...useSceneStore.getState().textLayers[0],text:'Teste',size:20,lineHeight:1,x:300,y:300,entrance:'none',exit:'none',start:0,end:5,backdropPadding:[10,20,30,40]};
  new TextCompositor().render(document.createElement('canvas'),[layer],600,600,1,false,null,true);
  new TextCompositor().render(document.createElement('canvas'),[layer],600,600,1,false,null,true,true);
  assert.deepEqual(rectangles[0],rectangles[1]);assert.deepEqual(rectangles[0].slice(0,4),[-65,-20,110,60]);
  for(const pair of [['1.2.10','1.2.9'],['2.0.0','1.99.99']])assert.equal(common.newer(...pair),true);
  for(const pair of [['1.2.8','1.2.8'],['1.2.7','1.2.8'],['1.2.9-beta','1.2.8'],['x','0.0.0']])assert.equal(common.newer(...pair),false);
  assert.equal(common.contained('/tmp/app','/tmp/application/x'),false);assert.equal(common.contained('/tmp/app','/tmp/app'),false);assert.equal(common.contained('/tmp/app','/tmp/app/../x'),false);
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'rp-update-test-'))),port=await freePort();let manager;
  try{
    const release=async(version,fail=false)=>{const dir=path.join(root,'releases',`${version}-aaaaaaaaaaaa-12345678`);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name:'rp-motionstudio',version,failStartup:fail}));await fs.copyFile(path.join(__dirname,'fixtures','updater-server.cjs'),path.join(dir,'server.js'));return {dir,version};};
    const one=await release('1.0.0'),two=await release('1.0.1');
    await common.atomic(path.join(root,'installation.json'),{schema:1,active:one});
    await assert.rejects(common.validRelease(root,{dir:project,version:'1.2.8'}));
    manager=spawn(process.execPath,[path.join(__dirname,'local-app.cjs'),'--serve','--root',root],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
    const version=async()=>{try{return (await (await fetch(`http://127.0.0.1:${port}/api/diagnostics`,{signal:AbortSignal.timeout(500)})).json()).version;}catch{return '';}};
    await waitFor(async()=>await version()==='1.0.0-local');
    const transition=async(release,id)=>{await common.atomic(path.join(root,'updates','job.json'),{id,phase:'ready',version:release.version});await common.atomic(path.join(root,'updates','pending.json'),{id,release});};
    await transition(two,'fixture-success');await waitFor(async()=>(await common.readJson(path.join(root,'updates','job.json')))?.phase==='done');assert.equal(await version(),'1.0.1-local');
    const manifest=await common.readJson(path.join(root,'installation.json'));assert.equal(manifest.previous.version,'1.0.0');await fs.access(one.dir);
    const bad=await release('1.0.2',true);await transition(bad,'fixture-failure');await waitFor(async()=>(await common.readJson(path.join(root,'updates','job.json')))?.phase==='rolledBack');assert.equal(await version(),'1.0.1-local');
    await transition(one,'fixture-restore');await waitFor(async()=>(await common.readJson(path.join(root,'updates','job.json')))?.phase==='done');assert.equal(await version(),'1.0.0-local');
    manager.kill('SIGTERM');await waitFor(async()=>manager.exitCode!==null||manager.signalCode!==null);
    const interrupted=await release('1.0.3',true);await common.atomic(path.join(root,'installation.json'),{schema:1,active:interrupted,previous:one});
    manager=spawn(process.execPath,[path.join(__dirname,'local-app.cjs'),'--serve','--root',root],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
    await waitFor(async()=>await version()==='1.0.0-local');await waitFor(async()=>(await common.readJson(path.join(root,'installation.json'))).active.version==='1.0.0');
    process.env.RP_MOTION_INSTALL_ROOT=root;process.env.RP_MOTION_MANAGED='1';
    const server=require('../lib/updateServer'),route=require('../app/api/updates/route'),{NextRequest}=require('next/server');
    const oldFetch=global.fetch;global.fetch=async url=>new Response(JSON.stringify(String(url).includes('raw.githubusercontent')?{name:'rp-motionstudio',version:'9.0.0'}:[{sha:'a'.repeat(40),commit:{message:'Versão de teste\nCorpo omitido'}}]),{status:200,headers:{'Content-Type':'application/json'}});
    server.state.lastAttempt=0;await server.checkRemote(true);assert.equal(server.state.latest.version,'9.0.0');assert.deepEqual(server.state.latest.notes,['Versão de teste']);
    global.fetch=async()=>{throw Error('offline');};server.state.lastAttempt=0;await server.checkRemote(true);assert.equal(server.state.latest.version,'9.0.0');assert.ok(server.state.error);global.fetch=oldFetch;
    const request=(url,body,origin='http://127.0.0.1:3002')=>new NextRequest(url,{method:body?'POST':'GET',headers:{host:new URL(url).host,origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await route.GET(request('http://evil.example/api/updates'))).status,403);
    assert.equal((await route.POST(request('http://127.0.0.1:3002/api/updates',{confirm:true,token:server.state.token},'https://evil.example'))).status,403);
    assert.equal((await route.POST(request('http://127.0.0.1:3002/api/updates',{confirm:true,token:'bad'}))).status,403);
    global.motionExports=new Map([['fixture',{cancelled:false}]]);assert.equal((await route.POST(request('http://127.0.0.1:3002/api/updates',{action:'install',confirm:true,token:server.state.token}))).status,409);global.motionExports.clear();
    assert.equal((await route.GET(request('http://127.0.0.1:3002/api/updates'))).status,200);
  }finally{
    if(manager){manager.kill('SIGTERM');await waitFor(async()=>manager.exitCode!==null||manager.signalCode!==null,6000).catch(()=>manager.kill('SIGKILL'));}
    if(path.basename(root).startsWith('rp-update-test-'))await fs.rm(root,{recursive:true,force:true});
  }
  console.log('Update/Padding checks passed: linked/split padding and blur geometry, persistence, version ordering, same-origin protections, export lock, pinned metadata, real manager swap, startup rollback and manual restore.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
