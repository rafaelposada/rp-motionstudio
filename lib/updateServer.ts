// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {APP_VERSION} from './appVersion';
const shared=globalThis as typeof globalThis&{rpUpdater?:{token:string;latest?:Latest;checkedAt:number;checking?:Promise<void>;lastAttempt:number;error?:string};motionUpdating?:boolean;motionExports?:Map<string,{cancelled?:boolean;completed?:boolean}>};
export const state=shared.rpUpdater??={token:crypto.randomBytes(32).toString('hex'),checkedAt:0,lastAttempt:0};
export interface Latest {version:string;sha:string;notes:string[];url:string}
export const SHA=/^[a-f0-9]{40}$/;
export const VERSION=/^\d+\.\d+\.\d+$/;
export const installRoot=process.env.RP_MOTION_INSTALL_ROOT||'';
export const managed=process.env.RP_MOTION_DESKTOP!=='1'&&process.env.RP_MOTION_MANAGED==='1'&&path.isAbsolute(installRoot);
export async function validateManagedRelease(release:{dir:string;version:string;legacy?:boolean}|null){
  if(!release||!VERSION.test(release.version)||!path.isAbsolute(release.dir))throw Error('Versão local inválida.');
  const root=await fs.realpath(/* turbopackIgnore: true */ installRoot),real=await fs.realpath(release.dir),relative=path.relative(root,real);
  if(real!==path.resolve(release.dir)||!relative||relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw Error('Pasta de versão inválida.');
  const pkg=JSON.parse(await fs.readFile(path.join(real,'package.json'),'utf8'));
  if(pkg.name!=='rp-motionstudio'||pkg.version!==release.version)throw Error('Identidade da versão inválida.');
  await fs.access(path.join(real,'server.js'));return release;
}
export function newer(a:string,b:string){if(!VERSION.test(a)||!VERSION.test(b))return false;const aa=a.split('.').map(Number),bb=b.split('.').map(Number);for(let i=0;i<3;i++)if(aa[i]!==bb[i])return aa[i]>bb[i];return false;}
export async function readLocal(file:string){if(!managed)return null;try{return JSON.parse(await fs.readFile(path.join(installRoot,file),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
export async function writeLocal(file:string,data:unknown){if(!managed)throw Error('Inicie pelo gerenciador local.');const target=path.join(installRoot,file);await fs.mkdir(path.dirname(target),{recursive:true});const temporary=`${target}.${crypto.randomUUID()}.tmp`;try{await fs.writeFile(temporary,JSON.stringify(data),{mode:0o600,flag:'wx'});await fs.rename(temporary,target);}finally{await fs.rm(temporary,{force:true});}}
export const running=(phase?:string)=>!!phase&&['queued','downloading','dependencies','building','testing','ready'].includes(phase);
export async function updaterBusy(){if(shared.motionUpdating){const job=await readLocal('updates/job.json');if(job&&!running(job.phase))shared.motionUpdating=false;}return shared.motionUpdating||running((await readLocal('updates/job.json'))?.phase);}
export function activeExport(){return [...(shared.motionExports?.values()??[])].some(s=>!s.cancelled&&!s.completed);}
export function markUpdating(value:boolean){shared.motionUpdating=value;}
export function claimUpdate(){if(shared.motionUpdating)return false;shared.motionUpdating=true;return true;}
async function publicJson(url:string){const response=await fetch(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'RP-MotionStudio-Updater'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(response.status===403||response.status===429?'Limite temporário do GitHub. Tente mais tarde.':'Não foi possível consultar o GitHub.');return response.json();}
export async function checkRemote(force=false){
  if(state.checking)return state.checking;
  if(!force&&Date.now()-state.checkedAt<6*60*60*1000)return;
  if(Date.now()-state.lastAttempt<60000)return;
  state.lastAttempt=Date.now();
  state.checking=(async()=>{try{
    const commits=await publicJson('https://api.github.com/repos/rafaelposada/rp-motionstudio/commits?sha=main&per_page=5');
    const sha=commits?.[0]?.sha;if(!SHA.test(sha))throw Error('Resposta de versão inválida.');
    const pkg=await publicJson(`https://raw.githubusercontent.com/rafaelposada/rp-motionstudio/${sha}/package.json`);
    if(pkg.name!=='rp-motionstudio'||!VERSION.test(pkg.version))throw Error('Identidade da versão inválida.');
    state.latest={version:pkg.version,sha,notes:commits.slice(0,5).map((c:{commit?:{message?:string}})=>String(c.commit?.message||'').split('\n')[0].slice(0,250)),url:`https://github.com/rafaelposada/rp-motionstudio/commit/${sha}`};
    state.checkedAt=Date.now();state.error=undefined;
  }catch(error){state.error=error instanceof Error?error.message:'Sem conexão. A instalação atual foi mantida.';}finally{state.checking=undefined;}})();
  return state.checking;
}
export async function updateStatus(){const [installation,job]=await Promise.all([readLocal('installation.json'),readLocal('updates/job.json')]);return {current:APP_VERSION,managed,latest:state.latest,available:!!state.latest&&newer(state.latest.version,APP_VERSION),checkedAt:state.checkedAt,error:state.error,token:state.token,job:job?{id:job.id,phase:job.phase,message:job.message,version:job.version}:null,previous:installation?.previous?.version??null};}
