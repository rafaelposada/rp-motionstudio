const c=require('./update-common.cjs'),{spawn}=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function healthy(port,version,child){for(let i=0;i<40;i++){if(child.exitCode!==null||child.signalCode!==null)return false;try{const response=await fetch(`http://127.0.0.1:${port}/api/diagnostics`,{signal:AbortSignal.timeout(1500)}),data=await response.json();if(response.ok&&data.version===`${version}-local`&&(data.instance===child.rpInstance||(child.rpAllowLegacy&&!data.instance)))return true;}catch{}await delay(500);}return false;}
async function stop(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;child.kill('SIGTERM');for(let i=0;i<40;i++){if(child.exitCode!==null||child.signalCode!==null)return;await delay(100);}child.kill('SIGKILL');await delay(200);}
function start(root,release,port){const instance=c.crypto.randomUUID(),child=spawn(process.execPath,[c.path.join(release.dir,'server.js')],{cwd:release.dir,stdio:'inherit',windowsHide:true,env:{...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port),RP_MOTION_INSTALL_ROOT:root,RP_MOTION_MANAGED:'1',RP_MOTION_MANAGER_PID:String(process.pid),RP_MOTION_INSTANCE:instance}});child.rpInstance=instance;child.rpAllowLegacy=release.legacy===true;return child;}
async function manager(root,port){
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Porta local inválida.');
  const manifestFile=c.path.join(root,'installation.json'),state=c.path.join(root,'updates');await c.fs.mkdir(state,{recursive:true});
  const lockPath=c.path.join(state,'manager.lock');
  let lock;try{lock=await c.fs.open(lockPath,'wx');}catch(e){const old=await c.readJson(lockPath);try{process.kill(old.pid,0);throw Error('O gerenciador deste aplicativo já está aberto.');}catch(error){if(error.code!=='ESRCH')throw error;}await c.fs.rm(lockPath);lock=await c.fs.open(lockPath,'wx');}
  await lock.writeFile(JSON.stringify({pid:process.pid}));await lock.close();
  let manifest=await c.readJson(manifestFile),child,closing=false;
  await c.validRelease(root,manifest?.active);
  const shutdown=async()=>{if(closing)return;closing=true;await stop(child);await c.fs.rm(lockPath,{force:true});process.exit(0);};
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  child=start(root,manifest.active,port);
  if(!await healthy(port,manifest.active.version,child)){
    await stop(child);
    try{
      const previous=await c.validRelease(root,manifest.previous);child=start(root,previous,port);
      if(!await healthy(port,previous.version,child))throw Error('A versão anterior também não iniciou.');
      manifest={...manifest,active:previous,previous:manifest.active};await c.atomic(manifestFile,manifest);
      const interrupted=await c.readJson(c.path.join(state,'job.json'));
      await c.atomic(c.path.join(state,'job.json'),{...interrupted,phase:'rolledBack',message:'A versão instalada não iniciou. A anterior foi restaurada.'});
      await c.fs.rm(c.path.join(state,'pending.json'),{force:true});
    }catch{await stop(child);await c.fs.rm(lockPath,{force:true});throw Error('Não foi possível iniciar o aplicativo nem restaurar a versão anterior.');}
  }
  // Recover an interrupted preparation; the active runtime remains intact.
  const previousJob=await c.readJson(c.path.join(state,'job.json'));
  if(previousJob&&!['done','error','rolledBack','ready'].includes(previousJob.phase)){
    let running=false;try{process.kill(previousJob.workerPid,0);running=true;}catch{}
    if(!running){await c.atomic(c.path.join(state,'job.json'),{...previousJob,phase:'error',message:'Preparação interrompida. A versão anterior foi mantida.'});if(/^[a-f0-9-]{36}$/.test(previousJob.id)){const stage=c.path.join(state,'staging',previousJob.id);if(c.contained(c.path.join(state,'staging'),stage))await c.fs.rm(stage,{recursive:true,force:true});}}
  }
  while(!closing){
    const pending=await c.readJson(c.path.join(state,'pending.json'));
    if(!pending){
      const job=await c.readJson(c.path.join(state,'job.json'));
      if(job&&['queued','downloading','dependencies','building','testing','ready'].includes(job.phase)&&Date.now()-(job.updatedAt||job.createdAt||0)>30000){
        let alive=false;if(Number.isInteger(job.workerPid)&&job.workerPid>0){try{process.kill(job.workerPid,0);alive=true;}catch{}}
        if(!alive){await c.atomic(c.path.join(state,'job.json'),{...job,phase:'error',message:'A preparação foi interrompida. A versão instalada foi mantida.'});if(/^[a-f0-9-]{36}$/.test(job.id)){const stage=c.path.join(state,'staging',job.id);if(c.contained(c.path.join(state,'staging'),stage))await c.fs.rm(stage,{recursive:true,force:true});}}
      }
    }
    if(pending){
      const job=await c.readJson(c.path.join(state,'job.json'));let next;
      try{
        if(job?.id!==pending.id||job.phase!=='ready')throw Error('Troca de versão não autorizada.');
        next=await c.validRelease(root,pending.release);
        const before=manifest;await stop(child);
        await c.atomic(manifestFile,{...manifest,active:next,previous:before.active});
        child=start(root,next,port);
        if(!await healthy(port,next.version,child)){
          await stop(child);await c.atomic(manifestFile,before);child=start(root,before.active,port);
          await healthy(port,before.active.version,child);
          await c.atomic(c.path.join(state,'job.json'),{...job,phase:'rolledBack',message:'A nova versão não iniciou. A versão anterior foi restaurada.'});
        }else{
          manifest={...manifest,active:next,previous:before.active};
          await c.atomic(c.path.join(state,'job.json'),{...job,phase:'done',message:job.rollback?'Versão anterior restaurada.':'Aplicativo atualizado.',updatedAt:Date.now()});
          // Only generated release folders are pruned; legacy App and all
          // project/export/media folders are deliberately excluded.
          const releases=c.path.join(root,'releases');
          for(const name of await c.fs.readdir(releases).catch(()=>[])){
            const dir=c.path.join(releases,name);if(dir===manifest.active.dir||dir===manifest.previous?.dir||!/^\d+\.\d+\.\d+-[a-f0-9]{12}-[a-f0-9]{8}$/.test(name))continue;
            await c.fs.rm(dir,{recursive:true,force:true});
          }
        }
      }catch(error){await c.atomic(c.path.join(state,'job.json'),{...job,phase:'error',message:error.message});}
      await c.fs.rm(c.path.join(state,'pending.json'),{force:true});
    }
    if(child.exitCode!==null||child.signalCode!==null){await c.fs.rm(lockPath,{force:true});throw Error('O serviço local foi encerrado. Abra novamente o aplicativo.');}
    await delay(1000);
  }
}
async function bootstrap(root,source){
  const existing=await c.readJson(c.path.join(root,'installation.json'));if(existing)return;
  const pkg=await c.readJson(c.path.join(source,'package.json'));if(pkg?.name!=='rp-motionstudio')throw Error('Execute dentro da pasta RP MotionStudio.');
  if(Number(process.versions.node.split('.')[0])<24)throw Error('Instale Node.js 24 ou mais recente.');
  console.log('Preparando a instalação local atualizável…');await c.npm(['run','build'],source,text=>process.stdout.write(text.slice(-1000)));
  const sha='000000000000',dir=c.path.join(root,'releases',`${pkg.version}-${sha}-${c.crypto.randomUUID().slice(0,8)}`);
  await c.copyApp(source,dir);await c.atomic(c.path.join(root,'installation.json'),{schema:1,active:{dir,version:pkg.version}});
  await c.fs.mkdir(c.path.join(root,'Launcher'),{recursive:true});
  for(const file of ['local-app.cjs','update-common.cjs'])await c.fs.copyFile(c.path.join(source,'scripts',file),c.path.join(root,'Launcher',file));
}
module.exports={manager,bootstrap,healthy,stop};
if(require.main===module){const arg=process.argv.indexOf('--root'),root=c.path.resolve(arg>=0?process.argv[arg+1]:process.env.RP_MOTION_INSTALL_ROOT||c.defaultRoot()),port=Number(process.env.PORT||3000);(async()=>{if(!process.argv.includes('--serve'))await bootstrap(root,process.cwd());await manager(root,port);})().catch(e=>{console.error(e.message);process.exitCode=1;});}
