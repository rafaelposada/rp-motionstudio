// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useUIStore } from '@/store/useUIStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useI18n } from '@/lib/useI18n';
import { AddIcon, LibraryIcon, ProjectsIcon } from './EditorIcons';
import { showHome } from '@/lib/homeNavigation';

const NAV = [
  { id: 'projects', labelKey: 'projects' as const, icon: (
    <ProjectsIcon />
  ) },
  { id: 'library', labelKey: 'library' as const, icon: (
    <LibraryIcon />
  ) },
];

export default function IconRail() {
  const { locale, t } = useI18n();
  const active = useUIStore((s) => s.nav);
  const theme = useUIStore((s) => s.theme);
  const setActive = useUIStore((s) => s.setNav);
  const openSettings = useUIStore((s) => s.setSettingsOpen);
  const createProject = useProjectStore((s) => s.create);
  const projectCount = useProjectStore((s) => s.projects.length);
  const openLibrary=(nav:string)=>{
    const ui=useUIStore.getState();
    if(ui.leftCollapsed)ui.toggleLeftPanel();
    if(ui.tplCollapsed)ui.toggleTplCollapsed();
    setActive(nav);
  };

  // An ACTION, not a nav section — so it never takes the active state. The +
  // icon at the top of the rail now creates what it looks like it creates.
  const newProject = () => {
    createProject(`${locale === 'pt' ? 'Projeto' : 'Project'} ${projectCount + 1}`);
    openLibrary('library');
  };

  return (
    <aside className="card rail">
      <div className="rail-top">
        <button className="rail-logo" onClick={() => void showHome()} aria-label={locale === 'pt' ? 'RP MotionStudio — Início' : 'RP MotionStudio — Home'} title={locale === 'pt' ? 'Ir para o início' : 'Go home'}>
          <img src={`/rp-motionstudio-${theme}.svg`} alt="RP MotionStudio" width="40" height="40" />
        </button>
        <button className="rail-item rail-action" onClick={newProject} title={t('createProject')} aria-label={t('createProject')}>
          <span className="rail-ico">
            <AddIcon />
          </span>
          <span className="rail-label">{t('new')}</span>
        </button>
        {NAV.map((n) => (
          <button key={n.id} className={`rail-item ${active === n.id ? 'active' : ''}`} onClick={() => openLibrary(n.id)}>
            <span className="rail-ico">{n.icon}</span>
            <span className="rail-label">{t(n.labelKey)}</span>
          </button>
        ))}
      </div>
      <div className="rail-bottom">
        <button
          className="rail-item rail-settings"
          onClick={() => openSettings(true)}
          aria-label={locale === 'pt' ? 'Configurações' : 'Settings'}
          title={locale === 'pt' ? 'Configurações (⌘,)' : 'Settings (⌘,)'}
        >
          <span className="rail-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9.4 3-.5 2.2-1.5.9-2.2-.7L3 9.2l1.7 1.5v1.7L3 14l2.2 3.8 2.2-.7 1.5.9.5 2.2h4.4l.5-2.2 1.5-.9 2.2.7 2.2-3.8-1.7-1.5v-1.7l1.7-1.5L18 5.5l-2.2.7-1.5-.9-.5-2.3H9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="11.6" cy="11.6" r="3" stroke="currentColor" strokeWidth="1.5"/></svg></span>
          <span className="rail-label">{locale === 'pt' ? 'Ajustes' : 'Settings'}</span>
        </button>
      </div>
    </aside>
  );
}
