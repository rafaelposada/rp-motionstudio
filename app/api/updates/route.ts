import {NextRequest,NextResponse} from 'next/server';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {isLocalFileRequest} from '@/lib/localDestinations';
import {APP_VERSION} from '@/lib/appVersion';
import {state,managed,installRoot,SHA,newer,checkRemote,updateStatus,readLocal,writeLocal,updaterBusy,activeExport,markUpdating,claimUpdate,validateManagedRelease} from '@/lib/updateServer';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
  if(!isLocalFileRequest(req))return NextResponse.json({error:'Disponível somente neste computador.'},{status:403});
  if(req.nextUrl.searchParams.get('check')==='1')await checkRemote(req.nextUrl.searchParams.get('force')==='1');
  return NextResponse.json(await updateStatus(),{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest){
  let startedId:string|null=null,claimed=false;
  if(!isLocalFileRequest(req)||!req.headers.get('origin')||!req.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({error:'Origem inválida.'},{status:403});
  try{
    const text=await req.text();if(text.length>2048)return NextResponse.json({error:'Pedido inválido.'},{status:400});
    const body=JSON.parse(text);if(body.token!==state.token||body.confirm!==true)return NextResponse.json({error:'Confirme a atualização neste aplicativo.'},{status:403});
    if(!managed)return NextResponse.json({error:'Para instalar pelo aplicativo, inicie esta instalação com npm run app.'},{status:409});
    if(!['install','rollback'].includes(body.action))return NextResponse.json({error:'Ação inválida.'},{status:400});
    if(await updaterBusy()||activeExport())return NextResponse.json({error:'Aguarde a exportação ou atualização em andamento.'},{status:409});
    if(!claimUpdate())return NextResponse.json({error:'Já existe uma atualização em andamento.'},{status:409});claimed=true;
    const installation=await readLocal('installation.json');
    await validateManagedRelease(installation?.active);
    if(path.resolve(installation.active.dir)!==path.resolve(/* turbopackIgnore: true */ process.cwd()))throw Error('Esta janela está associada a uma instalação anterior. Reabra o aplicativo.');
    try{process.kill(Number(process.env.RP_MOTION_MANAGER_PID),0);}catch{throw Error('O gerenciador não está ativo. Reabra o aplicativo.');}
    const id=crypto.randomUUID();
    startedId=id;
    if(body.action==='rollback'){
      const release=await validateManagedRelease(installation.previous);if(body.version!==release.version)throw Error('A versão anterior mudou. Confira novamente.');
      markUpdating(true);await writeLocal('updates/job.json',{id,phase:'ready',version:release.version,rollback:true,message:'Restaurando a versão anterior…'});await writeLocal('updates/pending.json',{id,release});
    }else if(body.action==='install'){
      const latest=state.latest;
      if(!latest||body.sha!==latest.sha||!SHA.test(body.sha)||body.version!==latest.version||!newer(latest.version,APP_VERSION))throw Error('A versão disponível mudou. Verifique novamente antes de confirmar.');
      if(Date.now()-state.checkedAt>6*60*60*1000)throw Error('A consulta expirou. Verifique novamente.');
      const worker=path.join(process.cwd(),'scripts','update-worker.cjs');await fs.access(worker);
      markUpdating(true);await writeLocal('updates/job.json',{id,sha:latest.sha,version:latest.version,phase:'queued',message:'Preparando atualização…',createdAt:Date.now()});
      const child=spawn(process.execPath,[worker,installRoot,id],{cwd:process.cwd(),detached:true,stdio:'ignore',windowsHide:true});
      await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
    }else return NextResponse.json({error:'Ação inválida.'},{status:400});
    return NextResponse.json(await updateStatus());
  }catch(error){if(claimed)markUpdating(false);if(startedId){const job=await readLocal('updates/job.json');if(job?.id===startedId)await writeLocal('updates/job.json',{...job,phase:'error',message:'Não foi possível iniciar a atualização. A versão instalada foi mantida.'});}return NextResponse.json({error:error instanceof Error?error.message:'Não foi possível preparar a atualização.'},{status:400});}
}
