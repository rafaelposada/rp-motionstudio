// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// Node-only helpers shared by the updater worker and the stable app manager.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os'),{spawn}=require('node:child_process');
const REPOSITORY='https://github.com/rafaelposada/rp-motionstudio.git';
const SHA=/^[a-f0-9]{40}$/,VERSION=/^\d+\.\d+\.\d+$/;
function defaultRoot(){return process.platform==='darwin'?path.join(os.homedir(),'Library','Application Support','Motion Studio'):process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'RP MotionStudio'):path.join(os.homedir(),'.local','share','rp-motionstudio');}
function contained(root,target){const rel=path.relative(path.resolve(root),path.resolve(target));return !!rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);}
async function readJson(file,fallback=null){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function atomic(file,data){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(data),{flag:'wx',mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
function newer(a,b){if(!VERSION.test(a)||!VERSION.test(b))return false;const av=a.split('.').map(Number),bv=b.split('.').map(Number);for(let i=0;i<3;i++)if(av[i]!==bv[i])return av[i]>bv[i];return false;}
async function validRelease(root,release){
  if(!release||!VERSION.test(release.version)||!contained(root,release.dir))throw Error('Versão local inválida.');
  const real=await fs.realpath(release.dir);if(real!==path.resolve(release.dir)||!contained(await fs.realpath(root),real))throw Error('Pasta de versão inválida.');
  const pkg=await readJson(path.join(real,'package.json'));if(pkg?.name!=='rp-motionstudio'||pkg.version!==release.version)throw Error('Identidade da versão inválida.');
  await fs.access(path.join(real,'server.js'));return release;
}
function command(cmd,args,cwd,onLog=()=>{},timeout=900000){return new Promise((resolve,reject)=>{
  // The standalone server injects its old project root/config and bundler into
  // process.env. Forwarding either makes a new checkout build against the old
  // runtime (distDirRoot panic) or selects two bundlers at once.
  const env={...process.env,GIT_TERMINAL_PROMPT:'0',NEXT_TELEMETRY_DISABLED:'1'};
  delete env.__NEXT_PRIVATE_STANDALONE_CONFIG;delete env.TURBOPACK;
  const child=spawn(cmd,args,{cwd,env,windowsHide:true,shell:false});let tail='';
  const timer=setTimeout(()=>{child.kill();reject(Error('A preparação excedeu o tempo limite.'));},timeout);
  const log=d=>{tail=(tail+d.toString()).slice(-4000);onLog(tail);};child.stdout?.on('data',log);child.stderr?.on('data',log);
  child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);code===0?resolve(tail):reject(Error(`${cmd} não concluiu a etapa (${code}). ${tail.slice(-800)}`));});
});}
async function npm(args,cwd,onLog){
  // npm_execpath is present for npm run app; the conventional sibling works
  // for Homebrew/official Node installations, including Windows npm-cli.js.
  const candidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
  for(const cli of candidates){try{await fs.access(cli);}catch{continue;}return command(process.execPath,[cli,...args],cwd,onLog);}
  if(process.platform==='win32')throw Error('Abra o app por npm run app para localizar o npm neste Windows.');
  return command('npm',args,cwd,onLog);
}
async function copyApp(source,destination){
  await fs.mkdir(destination,{recursive:true});
  await fs.cp(path.join(source,'.next','standalone'),destination,{recursive:true,filter:p=>!/(?:^|[\\/])\.env(?:\.|$)/.test(p)&&!/[ ]\d+(?:\.|$)/.test(path.basename(p))});
  await fs.cp(path.join(source,'.next','static'),path.join(destination,'.next','static'),{recursive:true});
  await fs.cp(path.join(source,'public'),path.join(destination,'public'),{recursive:true,filter:p=>!['exports','demo-arqe'].some(name=>p===path.join(source,'public',name)||contained(path.join(source,'public',name),p))});
  await fs.mkdir(path.join(destination,'scripts'),{recursive:true});
  for(const file of ['update-common.cjs','update-worker.cjs','local-app.cjs'])await fs.copyFile(path.join(source,'scripts',file),path.join(destination,'scripts',file));
  for(const file of ['LICENSE','NOTICE','licenses'])await fs.cp(path.join(source,file),path.join(destination,file),{recursive:true});
}
module.exports={fs,path,crypto,REPOSITORY,SHA,VERSION,defaultRoot,contained,readJson,atomic,newer,validRelease,command,npm,copyApp};
