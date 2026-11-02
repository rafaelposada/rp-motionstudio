// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const generatedBy='rp-motionstudio-desktop-runtime';
async function marker(directory){try{return JSON.parse(await fs.readFile(path.join(directory,'.rp-runtime.json'),'utf8'));}catch{return null;}}
async function prepareRuntime(source,root){
  // Next writes route caches and video proxies. Never run it inside a signed
  // application bundle; Browser/Config/projects remain outside this disposable copy.
  const buildId=(await fs.readFile(path.join(source,'.next','BUILD_ID'),'utf8')).trim();
  if(!/^[\w-]{1,128}$/.test(buildId))throw Error('Identificação de compilação inválida.');
  const id=crypto.createHash('sha256').update(buildId).update(await fs.readFile(path.join(source,'server.js'))).digest('hex').slice(0,24);
  const target=path.join(root,id);
  await fs.mkdir(root,{recursive:true});
  try{
    await fs.access(target);
    const known=await marker(target);
    if(known?.generatedBy!==generatedBy||known.id!==id)throw Error('A pasta de execução contém arquivos não identificados.');
  }catch(error){
    if(error.code!=='ENOENT')throw error;
    const temporary=path.join(root,`.prepare-${crypto.randomUUID()}`);
    const excluded=['.next/cache','.next/server/route-cache','public/exports'].map(name=>path.join(source,name));
    try{
      await fs.cp(source,temporary,{recursive:true,verbatimSymlinks:true,filter:file=>!excluded.some(dir=>file===dir||file.startsWith(dir+path.sep))});
      await fs.writeFile(path.join(temporary,'.rp-runtime.json'),JSON.stringify({generatedBy,id}),{mode:0o600});
      await fs.rename(temporary,target);
    }finally{await fs.rm(temporary,{recursive:true,force:true});}
  }
  // Only older, explicitly marked generated runtimes may be removed. User
  // projects and unknown directories are never cleanup targets.
  for(const entry of await fs.readdir(root,{withFileTypes:true})){
    if(!entry.isDirectory()||entry.name===id||!/^[a-f0-9]{24}$/.test(entry.name))continue;
    const older=path.join(root,entry.name),known=await marker(older);
    if(known?.generatedBy===generatedBy&&known.id===entry.name)await fs.rm(older,{recursive:true,force:true}).catch(()=>{});
  }
  return target;
}
module.exports={prepareRuntime};
