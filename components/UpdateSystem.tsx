// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import {useEffect,useRef,useState} from 'react';
import {useUpdateStore,refreshUpdates,updateRunning} from '@/store/useUpdateStore';
import {useUIStore} from '@/store/useUIStore';
import {APP_VERSION} from '@/lib/appVersion';
import {flushScene,getSaveState} from '@/lib/scenePersist';
import {canInstallInApp,installDesktopUpdate,useDesktopUpdate} from '@/lib/desktopUpdate';
import { tx, txf } from '@/lib/tx';
export default function UpdateSystem(){
  const info=useUpdateStore(s=>s.info),armed=useUpdateStore(s=>s.armed),auto=useUpdateStore(s=>s.auto),pt=useUIStore(s=>s.locale)==='pt',dialog=useRef<HTMLDialogElement>(null),[dismissed,setDismissed]=useState('');
  const busy=updateRunning(info),settingsOpen=useUIStore(s=>s.settingsOpen),desktopUpdate=useDesktopUpdate(),[inApp,setInApp]=useState(false);
  useEffect(()=>setInApp(canInstallInApp()),[]);
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
  return <>{info?.available&&auto&&dismissed!==info.latest?.sha&&!settingsOpen&&!busy&&<div className="update-popup" role="dialog" aria-labelledby="update-popup-title">
      <span className="update-popup-dot" aria-hidden="true"/>
      <div className="update-popup-body"><strong id="update-popup-title">{txf(pt, 'Nova versão {v} disponível', 'Version {v} is available', { v: info.latest?.version ?? '' })}</strong>
        {desktopUpdate.phase==='downloading'||desktopUpdate.phase==='installing'?<><span>{desktopUpdate.phase==='installing'?(tx(pt, 'Conferindo o pacote…', 'Verifying the package…')):(tx(pt, 'Baixando atualização…', 'Downloading update…'))}{desktopUpdate.total?` ${Math.round(desktopUpdate.received/desktopUpdate.total*100)}%`:''}</span><progress max={desktopUpdate.total||undefined} value={desktopUpdate.total?desktopUpdate.received:undefined}/></>
        :<span>{desktopUpdate.phase==='error'?desktopUpdate.error:(tx(pt, 'Melhorias e correções prontas para instalar. Seus projetos são mantidos.', 'Improvements and fixes ready to install. Your projects are kept.'))}</span>}
        <div className="update-popup-actions"><button className="btn" onClick={()=>setDismissed(info.latest?.sha??'')}>{tx(pt, 'Depois', 'Later')}</button>
          {inApp?<button className="btn primary" disabled={['downloading','installing','applying'].includes(desktopUpdate.phase)} onClick={()=>void installDesktopUpdate(pt)}>{desktopUpdate.phase==='ready'?(tx(pt, 'Reiniciar e instalar', 'Restart and install')):(tx(pt, 'Atualizar agora', 'Update now'))}</button>
          :<button className="btn primary" onClick={()=>useUIStore.getState().setSettingsOpen(true,'updates')}>{tx(pt, 'Ver atualização', 'View update')}</button>}</div>
      </div>
    </div>}
    <dialog className="update-progress-dialog" ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)closeFailure();}} aria-labelledby="update-progress-title"><span className="eyebrow">RP MotionStudio</span><h2 id="update-progress-title">{failed?(tx(pt, 'Atualização não concluída', 'Update did not complete')):(tx(pt, 'Atualizando o aplicativo', 'Updating application'))}</h2>{failed?<><p className="settings-description" role="alert">{tx(pt, 'A versão instalada e seus projetos foram mantidos. Você pode continuar trabalhando.', 'The installed version and your projects were retained. You can continue working.')}</p><details className="update-error-details"><summary>{tx(pt, 'Detalhes técnicos', 'Technical details')}</summary><pre>{info?.job?.message}</pre></details><button className="btn primary" onClick={closeFailure}>{tx(pt, 'Voltar ao aplicativo', 'Back to application')}</button></>:<><p role="status" aria-live="polite">{info?.job?.message}</p><progress aria-label={tx(pt, 'Progresso da atualização', 'Update progress')}/><p className="settings-description">{tx(pt, 'Mantenha o app e o computador abertos. O projeto foi salvo; a janela será recarregada quando a nova versão estiver pronta.', 'Keep the application and computer running. Your project is saved; this window reloads when the new version is ready.')}</p></>}</dialog>
  </>;
}
