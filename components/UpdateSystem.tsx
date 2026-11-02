// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import {useEffect,useRef,useState} from 'react';
import {useUpdateStore,refreshUpdates,updateRunning} from '@/store/useUpdateStore';
import {useUIStore} from '@/store/useUIStore';
import {APP_VERSION} from '@/lib/appVersion';
import {flushScene,getSaveState} from '@/lib/scenePersist';
export default function UpdateSystem(){
  const info=useUpdateStore(s=>s.info),armed=useUpdateStore(s=>s.armed),auto=useUpdateStore(s=>s.auto),pt=useUIStore(s=>s.locale)==='pt',dialog=useRef<HTMLDialogElement>(null),[dismissed,setDismissed]=useState('');
  const busy=updateRunning(info),settingsOpen=useUIStore(s=>s.settingsOpen);
  const failed=armed&&!!info?.job&&['error','rolledBack'].includes(info.job.phase);
  const closeFailure=()=>{useUpdateStore.setState({armed:false});dialog.current?.close();};
  useEffect(()=>{if(failed)dialog.current?.showModal();},[failed]);
  useEffect(()=>{useUpdateStore.getState().hydrate();void refreshUpdates().then(()=>{if(useUpdateStore.getState().auto)void refreshUpdates(true);});const timer=setInterval(()=>{if(useUpdateStore.getState().auto)void refreshUpdates(true);},6*60*60*1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(!busy){if(!failed)dialog.current?.close();return;}dialog.current?.showModal();const poll=async()=>{
    await refreshUpdates();const current=useUpdateStore.getState();
    if(current.armed&&current.info?.job?.phase==='done'){flushScene();if(getSaveState().status!=='error')window.location.reload();}
    // A first-generation backup predates /api/updates; diagnostics still
    // allows the initiating window to recognize the successful rollback.
    if(current.armed&&current.error){try{const r=await fetch('/api/diagnostics',{signal:AbortSignal.timeout(3000)}),d=await r.json();if(d.version&&d.version!==`${APP_VERSION}-local`){flushScene();if(getSaveState().status!=='error')window.location.reload();}}catch{}}
  };const timer=setInterval(()=>void poll(),2000);return()=>{clearInterval(timer);dialog.current?.close();};},[busy,failed]);
  useEffect(()=>{document.body.dataset.updateAvailable=info?.available?'true':'false';return()=>{delete document.body.dataset.updateAvailable;};},[info?.available]);
  return <>{info?.available&&auto&&dismissed!==info.latest?.sha&&!settingsOpen&&!busy&&<div className="update-notice" role="status"><button onClick={()=>useUIStore.getState().setSettingsOpen(true,'updates')}>{pt?'Nova versão disponível':'Update available'} · {info.latest?.version}</button><button aria-label={pt?'Dispensar aviso de atualização':'Dismiss update notice'} onClick={()=>setDismissed(info.latest?.sha??'')}>×</button></div>}
    <dialog className="update-progress-dialog" ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)closeFailure();}} aria-labelledby="update-progress-title"><span className="eyebrow">RP MotionStudio</span><h2 id="update-progress-title">{failed?(pt?'Atualização não concluída':'Update did not complete'):(pt?'Atualizando o aplicativo':'Updating application')}</h2>{failed?<><p className="settings-description" role="alert">{pt?'A versão instalada e seus projetos foram mantidos. Você pode continuar trabalhando.':'The installed version and your projects were retained. You can continue working.'}</p><details className="update-error-details"><summary>{pt?'Detalhes técnicos':'Technical details'}</summary><pre>{info?.job?.message}</pre></details><button className="btn primary" onClick={closeFailure}>{pt?'Voltar ao aplicativo':'Back to application'}</button></>:<><p role="status" aria-live="polite">{info?.job?.message}</p><progress aria-label={pt?'Progresso da atualização':'Update progress'}/><p className="settings-description">{pt?'Mantenha o app e o computador abertos. O projeto foi salvo; a janela será recarregada quando a nova versão estiver pronta.':'Keep the application and computer running. Your project is saved; this window reloads when the new version is ready.'}</p></>}</dialog>
  </>;
}
