// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useUIStore } from '@/store/useUIStore';
import { useI18n } from '@/lib/useI18n';

export type WorkspacePanel = 'library' | 'inspector' | 'timeline';
export function PanelGlyph({panel}:{panel:WorkspacePanel}) {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>{panel==='timeline'?<path d="M2 12h16" stroke="currentColor" strokeWidth="1.4"/>:<path d={panel==='library'?'M7 3v14':'M13 3v14'} stroke="currentColor" strokeWidth="1.4"/>}<path d={panel==='timeline'?'M5 14.5h10':panel==='library'?'M4.5 6v8':'M15.5 6v8'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
export function workspacePanelName(panel:WorkspacePanel,pt:boolean) {
  return (pt?{library:'Biblioteca / Projetos',inspector:'Propriedades',timeline:'Linha do tempo'}:{library:'Library / Projects',inspector:'Properties',timeline:'Timeline'})[panel];
}
export default function PanelVisibility({panel,compact=false}:{panel:WorkspacePanel;compact?:boolean}) {
  const pt=useI18n().locale==='pt';
  const hidden=useUIStore(s=>panel==='library'?s.leftCollapsed:panel==='inspector'?s.rightCollapsed:s.timelineHidden);
  const name=workspacePanelName(panel,pt);
  const label=`${pt?(hidden?'Mostrar':'Ocultar'):(hidden?'Show':'Hide')} ${name}`;
  const toggle=()=>{
    const state=useUIStore.getState();
    if(panel==='library')state.toggleLeftPanel();
    else if(panel==='inspector')state.toggleRightPanel();
    else state.toggleTimelinePanel();
    // The rail remains reachable when the focused panel is hidden.
    if(!hidden)document.getElementById(`panel-visibility-${panel}`)?.focus();
  };
  return <button type="button" id={compact?`panel-visibility-${panel}`:undefined} className={compact?'rail-panel-toggle':'dock-hide'} title={label} aria-label={label} aria-pressed={compact?!hidden:undefined} aria-expanded={!hidden} aria-controls={`workspace-panel-${panel}`} onClick={toggle}>
    {compact?<PanelGlyph panel={panel}/>:<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={panel==='timeline'?'M4 6l4 4 4-4':panel==='library'?'M10 4l-4 4 4 4':'M6 4l4 4-4 4'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </button>;
}
