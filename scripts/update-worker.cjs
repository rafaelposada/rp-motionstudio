// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
const c=require('./update-common.cjs');
async function prepare(root,id){
  const stateDir=c.path.join(root,'updates'),jobFile=c.path.join(stateDir,'job.json'),job=await c.readJson(jobFile);
  if(!job||job.id!==id||!c.SHA.test(job.sha)||!c.VERSION.test(job.version)||job.phase!=='queued')throw Error('Pedido de atualização inválido.');
  const staging=c.path.join(stateDir,'staging',id),release=c.path.join(root,'releases',`${job.version}-${job.sha.slice(0,12)}-${id.slice(0,8)}`);
  if(!/^[a-f0-9-]{36}$/.test(id)||!c.contained(stateDir,staging)||!c.contained(root,release))throw Error('Destino inválido.');
  const progress=async(phase,message)=>c.atomic(jobFile,{...job,phase,message,workerPid:process.pid,updatedAt:Date.now()});
  try{
    const stat=await c.fs.statfs(root);if(Number(stat.bavail)*Number(stat.bsize)<3*1024**3)throw Error('A atualização precisa de pelo menos 3 GB livres temporariamente.');
    await c.fs.mkdir(staging,{recursive:true});const hooks=c.path.join(staging,'.empty-hooks');await c.fs.mkdir(hooks);await progress('downloading','Baixando a versão confirmada…');
    await c.command('git',['init','--quiet'],staging);
    await c.command('git',['remote','add','origin',c.REPOSITORY],staging);
    await c.command('git',['-c',`core.hooksPath=${hooks}`,'fetch','--depth=1','origin',job.sha],staging);
    await c.command('git',['-c',`core.hooksPath=${hooks}`,'checkout','--detach','--quiet','FETCH_HEAD'],staging);
    const head=(await c.command('git',['rev-parse','HEAD'],staging)).trim();if(head!==job.sha)throw Error('A revisão baixada não corresponde à confirmação.');
    const pkg=await c.readJson(c.path.join(staging,'package.json'));if(pkg?.name!=='rp-motionstudio'||pkg.version!==job.version)throw Error('Versão baixada não confere.');
    await progress('dependencies','Preparando dependências…');await c.npm(['ci','--include=dev','--no-audit','--no-fund'],staging);
    await progress('building','Compilando e verificando a nova versão…');await c.npm(['run','build'],staging);
    await progress('testing','Executando verificações…');await c.npm(['test'],staging);
    await c.copyApp(staging,release);await c.validRelease(root,{dir:release,version:job.version});
    await progress('ready','Nova versão preparada. Reiniciando…');
    await c.atomic(c.path.join(stateDir,'pending.json'),{id,release:{dir:release,version:job.version,sha:job.sha}});
  }catch(error){await progress('error',String(error.message||error).slice(0,1000));if(c.contained(c.path.join(root,'releases'),release))await c.fs.rm(release,{recursive:true,force:true});throw error;}
  finally{if(c.contained(c.path.join(stateDir,'staging'),staging))await c.fs.rm(staging,{recursive:true,force:true});}
}
module.exports={prepare};
if(require.main===module)prepare(c.path.resolve(process.argv[2]),process.argv[3]).catch(e=>{console.error(e.message);process.exitCode=1;});
