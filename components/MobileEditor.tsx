'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import TemplatesCard from './TemplatesCard';
import AssetsPanel from './AssetsPanel';
import ScenePanel from './ScenePanel';
import EffectsPanel from './EffectsPanel';
import CanvasPanel from './CanvasPanel';
import AbsoluteMediaPanel from './AbsoluteMediaPanel';
import CompositionLayers from './CompositionLayers';
import TextPanel from './TextPanel';
import ProjectsPanel from './ProjectsPanel';
import HistoryControls from './HistoryControls';
import MobileTransport from './MobileTransport';
import ExportDialog from './ExportDialog';
import { useUIStore } from '@/store/useUIStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { AdjustIcon, BackIcon, CanvasIcon, ChevronDownIcon, ExportIcon, InfoIcon, LibraryIcon, MediaIcon, MoonIcon, ProjectsIcon, SunIcon } from './EditorIcons';
import { MobileInteractionProvider } from './MobileInteractions';
import { showHome } from '@/lib/homeNavigation';

const PreviewStage = dynamic(() => import('./PreviewStage'), { ssr: false });

type Tab = 'templates' | 'media' | 'adjust' | 'canvas';

const NAV: { id: Tab | 'export'; label: string; icon: React.ReactNode }[] = [
  { id: 'templates', label: 'Templates', icon: <LibraryIcon /> },
  { id: 'media', label: 'Media', icon: <MediaIcon /> },
  { id: 'adjust', label: 'Adjust', icon: <AdjustIcon /> },
  { id: 'canvas', label: 'Canvas', icon: <CanvasIcon /> },
  { id: 'export', label: 'Export', icon: <ExportIcon size={20} /> },
];

export default function MobileEditor() {
  const tab = useUIStore((s) => s.mobileTab);
  const panelOpen = useUIStore((s) => s.mobilePanelOpen);
  const projectsOpen = useUIStore((s) => s.mobileProjectsOpen);
  const setTab = useUIStore((s) => s.setMobileTab);
  const setPanelOpen = useUIStore((s) => s.setMobilePanelOpen);
  const setProjectsOpen = useUIStore((s) => s.setMobileProjectsOpen);
  const theme = useUIStore((s) => s.theme);
  const locale = useUIStore((s) => s.locale);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const projects = useProjectStore((s) => s.projects);
  const activeId = useProjectStore((s) => s.activeId);
  const trackCount = useSceneStore((s) => s.tracks.length);
  const [exportOpen, setExportOpen] = useState(false);
  const [desktopNotice, setDesktopNotice] = useState(false);
  const activeProject = projects.find((project) => project.id === activeId);

  const selectTab = (id: Tab | 'export') => {
    if (id === 'export') {
      setExportOpen(true);
      return;
    }
    if (id === tab && panelOpen) {
      setPanelOpen(false);
      return;
    }
    setTab(id);
  };

  return (
    <MobileInteractionProvider>
    <div className={`mobile-editor ${panelOpen ? 'mobile-panel-is-open' : 'mobile-panel-is-closed'}`}>
      <header className="mobile-topbar">
        <button className="mobile-home-logo" onClick={() => void showHome()} aria-label={locale === 'pt' ? 'RP MotionStudio — Início' : 'RP MotionStudio — Home'}><img src={`/rp-motionstudio-${theme}.svg`} alt="" width="30" height="30" /></button>
        <button className="mobile-project-button" onClick={() => setProjectsOpen(true)} aria-label={locale === 'pt' ? 'Abrir projetos' : 'Open projects'}>
          <ProjectsIcon size={18} />
          <span>{activeProject?.name ?? 'Projects'}</span>
          <ChevronDownIcon size={12} />
        </button>
        <div className="mobile-top-actions">
          <HistoryControls />
          <button
            className="mobile-icon-button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
          <button className="mobile-icon-button" onClick={() => setDesktopNotice(true)} aria-label="Desktop tools information">
            <InfoIcon size={18} />
          </button>
        </div>
      </header>

      <main className="stage-col mobile-stage">
        <PreviewStage />
      </main>

      <MobileTransport />

      <section className="mobile-panel" aria-label={`${tab} controls`}>
        <div className="mobile-panel-handle" aria-hidden="true" />
        <div className="mobile-panel-scroll">
          {tab === 'templates' && (
            <TemplatesCard
              customPresetsEnabled={false}
              onSelect={() => setPanelOpen(false)}
            />
          )}
          {tab === 'media' && <><AbsoluteMediaPanel /><AssetsPanel /></>}
          {tab === 'adjust' && (
            <div className="mobile-composed-panel">
              {trackCount > 1 && <div className="mobile-desktop-hint">{trackCount} {locale === 'pt' ? 'camadas no projeto' : 'layers in this project'}</div>}
              <ScenePanel />
              <div className="hairline" />
              <EffectsPanel /><CompositionLayers /><TextPanel />
            </div>
          )}
          {tab === 'canvas' && (
            <div className="mobile-composed-panel">
              <CanvasPanel />
            </div>
          )}
        </div>
      </section>

      <nav className="mobile-bottom-nav" aria-label="Editor sections">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`mobile-nav-item ${item.id === tab && panelOpen ? 'active' : ''} ${item.id === 'export' ? 'mobile-nav-export' : ''}`}
            onClick={() => selectTab(item.id)}
            aria-current={item.id === tab && panelOpen ? 'page' : undefined}
          >
            {item.icon}
            <span>{locale === 'pt' ? ({templates:'Modelos',media:'Mídia',adjust:'Ajustes',canvas:'Tela',export:'Exportar'} as Record<string,string>)[item.id] : item.label}</span>
          </button>
        ))}
      </nav>

      {projectsOpen && (
        <div className="mobile-projects-screen">
          <header className="mobile-subpage-head">
            <button className="mobile-icon-button" onClick={() => setProjectsOpen(false)} aria-label="Back to editor">
              <BackIcon />
            </button>
            <strong>{locale === 'pt' ? 'Projetos' : 'Projects'}</strong>
            <span />
          </header>
          <ProjectsPanel onProjectOpen={() => setProjectsOpen(false)} />
        </div>
      )}

      {desktopNotice && (
        <div className="mobile-notice-backdrop" onClick={() => setDesktopNotice(false)}>
          <div className="mobile-notice" role="dialog" aria-modal="true" aria-labelledby="desktop-tools-title" onClick={(event) => event.stopPropagation()}>
            <strong id="desktop-tools-title">{locale === 'pt' ? 'Área de trabalho' : 'Workspace'}</strong>
            <p>{locale === 'pt' ? 'Para ordenar camadas e editar a linha do tempo com mais espaço, abra o aplicativo em uma janela maior. Seus projetos ficam salvos neste aplicativo.' : 'For more space to reorder layers and edit the timeline, open the app in a larger window. Projects remain saved in this app.'}</p>
            <button className="btn primary full" onClick={() => setDesktopNotice(false)}>{locale === 'pt' ? 'Entendi' : 'Got it'}</button>
          </div>
        </div>
      )}

      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </div>
    </MobileInteractionProvider>
  );
}
