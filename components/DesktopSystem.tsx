// RP MotionStudio desktop additions — Rafael Posada, 2026. Apache-2.0.
'use client';
import {useEffect,useState} from 'react';
import {desktopAPI,desktopBusy,type DesktopRequest} from '@/lib/desktop';
import {useSceneStore} from '@/store/useSceneStore';
import {useUIStore} from '@/store/useUIStore';
import {useProjectStore} from '@/store/useProjectStore';
import {flushScene,getSaveState} from '@/lib/scenePersist';
import {activeProjectId,listProjects} from '@/lib/projects';
import {importProjectPackage,saveProjectPackage} from '@/lib/projectPackage';
import {pendingAssetTransactions} from '@/lib/assetDb';
import {useHistoryStore} from '@/store/useHistoryStore';
import {compositionOrder} from '@/lib/composition';
import {arrangeCompositionLayers} from '@/lib/compositionActions';

export default function DesktopSystem() {
  const [desktop,setDesktop]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    const api=desktopAPI();if(!api)return;
    setDesktop(true);document.body.classList.add('desktop-host');document.body.dataset.desktopPlatform=api.platform;
    let alive=true,working=false;
    const appearance=()=>api.appearance(useUIStore.getState().theme);appearance();
    const stopTheme=useUIStore.subscribe((next,previous)=>{if(next.theme!==previous.theme)appearance();});
    const stop=api.onRequest(async({id,action}:DesktopRequest)=>{
      const pt=useUIStore.getState().locale==='pt';
      let ownsWork=false;
      try {
        // Commit inline text and numeric drafts before deciding what to save.
        if(!['undo','redo','select-all','arrange-front','arrange-back'].includes(action)&&document.activeElement instanceof HTMLElement)document.activeElement.blur();
        const project=activeProjectId();
        if(action==='status'){
          const busy=working||desktopBusy()||pendingAssetTransactions()>0;
          if(!busy&&useUIStore.getState().autosaveEnabled)flushScene();
          api.respond(id,{ok:true,value:{pt,busy,hasProject:!!project&&useUIStore.getState().nav!=='home',name:listProjects().find(p=>p.id===project)?.name??'Projeto',unsaved:getSaveState().status!=='saved'}});return;
        }
        if(working||desktopBusy()||pendingAssetTransactions()>0)throw Error(pt?'Aguarde a operação em andamento.':'Wait for the current operation to finish.');
        working=true;ownsWork=true;
        if(action==='undo'||action==='redo'){
          const active=document.activeElement;
          if(active instanceof HTMLElement&&active.closest('[data-rich-editor=true]'))active.closest('[data-rich-editor=true]')!.dispatchEvent(new CustomEvent('rp-rich-text-history',{detail:action}));
          else if(active instanceof HTMLElement&&active.closest('input,textarea,[contenteditable=true]'))document.execCommand(action);
          else useHistoryStore.getState()[action]();
        }else if(action==='select-all'){
          const active=document.activeElement;
          if(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement)active.select();
          else if(active instanceof HTMLElement&&active.closest('[contenteditable=true]'))document.execCommand('selectAll');
          else if(!useUIStore.getState().settingsOpen&&useUIStore.getState().nav!=='home'){
            const scene=useSceneStore.getState();useUIStore.getState().setLayerSelection(compositionOrder(scene.tracks,scene.textLayers).map(layer=>layer.id));
          }
        }else if(action==='arrange-front'||action==='arrange-back'){
          const ui=useUIStore.getState(),active=document.activeElement;
          const typing=active instanceof HTMLElement&&active.closest('input,textarea,select,[contenteditable=true]');
          if(!typing&&!ui.settingsOpen&&ui.nav!=='home'&&!document.querySelector('dialog[open]'))arrangeCompositionLayers(ui.selectedLayerIds,action==='arrange-front'?'front':'back');
        }else if(action==='settings')useUIStore.getState().setSettingsOpen(true);
        else if(action==='save-local'){
          flushScene();if(getSaveState().status!=='saved')throw Error(pt?'Não foi possível salvar. A janela será mantida aberta.':'Save failed. The window will remain open.');
        }else if(action==='save-draft'||action==='save-draft-notify'){
          if(!project)throw Error(pt?'Abra uma composição primeiro.':'Open a composition first.');
          useSceneStore.getState().setPlaying(false);
          const saved=await saveProjectPackage(project,'draft');
          if(alive&&action.endsWith('notify'))setMessage(`${pt?'Rascunho salvo em':'Draft saved to'}: ${saved.path}`);
        }else if(action==='open-project'){
          const file=await api.openProject();
          if(file){const imported=await importProjectPackage(new File([new Uint8Array(file.bytes)],file.name,{type:'application/zip'}));
            // Open before refreshing: package creation changes the persisted
            // active id, while open() must still see the previous live id.
            useProjectStore.getState().open(imported.id);useProjectStore.getState().refresh();
            useUIStore.getState().setNav('library');if(alive)setMessage(pt?'Projeto importado. O pacote original foi preservado.':'Project imported. The original package was preserved.');}
        }else throw Error('Ação indisponível.');
        api.respond(id,{ok:true});
      }catch(error){api.respond(id,{ok:false,error:error instanceof Error?error.message:String(error)});}
      finally{if(ownsWork)working=false;}
    });
    return()=>{alive=false;stop();stopTheme();document.body.classList.remove('desktop-host');delete document.body.dataset.desktopPlatform;};
  },[]);
  if(!desktop)return null;
  return <><div className="desktop-titlebar">RP MotionStudio</div>{message&&<div className="desktop-notice" role="status"><span>{message}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setMessage('')}>×</button></div>}</>;
}
