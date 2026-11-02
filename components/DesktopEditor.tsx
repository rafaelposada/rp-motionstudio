// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import AssetsPanel from '@/components/AssetsPanel';
import CanvasPanel from '@/components/CanvasPanel';
import EffectsPanel from '@/components/EffectsPanel';
import HistoryControls from '@/components/HistoryControls';
import IconRail from '@/components/IconRail';
import ProjectsPanel from '@/components/ProjectsPanel';
import ScenePanel from '@/components/ScenePanel';
import TemplatesCard from '@/components/TemplatesCard';
import Timeline from '@/components/Timeline';
import TextPanel from '@/components/TextPanel';
import { CollapsedStrip } from '@/components/TplCollapse';
import { useUIStore } from '@/store/useUIStore';
import { useI18n } from '@/lib/useI18n';
import PanelDock from './PanelDock';
import CompositionLayers from './CompositionLayers';
import AbsoluteMediaPanel from './AbsoluteMediaPanel';
import InspectorIcon from './InspectorIcon';
import { useSceneStore } from '@/store/useSceneStore';
import { fitPanelLayout } from '@/lib/panelLayout';
import {desktopAPI} from '@/lib/desktop';
import { tx } from '@/lib/tx';
import ShapePanel from './ShapePanel';

const PreviewStage = dynamic(() => import('@/components/PreviewStage'), { ssr: false });
const SettingsDialog = dynamic(() => import('@/components/SettingsDialog'), { ssr: false });

export default function DesktopEditor() {
  const { t, locale } = useI18n();
  const pt = locale === 'pt';
  const [previewExpanded, setPreviewExpanded] = useState(false);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if(e.key==='Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) setPreviewExpanded(false); };
    window.addEventListener('keydown',close); return ()=>window.removeEventListener('keydown',close);
  }, []);
  const nav = useUIStore((s) => s.nav);
  const leftCollapsed = useUIStore((s) => s.leftCollapsed);
  const rightCollapsed = useUIStore((s) => s.rightCollapsed);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const tplCollapsed = useUIStore((s) => s.tplCollapsed);
  const panels = useUIStore((s) => s.panels);
  const panelWidthPriority = useUIStore((s) => s.panelWidthPriority);
  const expanded = useUIStore((s) => s.timelineExpanded);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const showGrid = useUIStore((s) => s.showStageGrid);
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });
  useEffect(() => {
    const sync = () => setViewport({ width: window.innerWidth, height: window.innerHeight-(desktopAPI()?38:0) });
    sync(); window.addEventListener('resize', sync);
    const keys = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === ',') { event.preventDefault(); useUIStore.getState().setSettingsOpen(true); } };
    window.addEventListener('keydown', keys);
    return () => { window.removeEventListener('resize', sync); window.removeEventListener('keydown', keys); };
  }, []);
  const layout = fitPanelLayout(panels, viewport.width, viewport.height, leftCollapsed, rightCollapsed, tplCollapsed, expanded, panelWidthPriority);
  const layoutStyle = { '--rail-w': `${layout.rail}px`, '--templates-col': `${layout.library}px`, '--right-col': `${layout.inspector}px`, gridTemplateRows: `minmax(0, 1fr) ${layout.timelineHeight}px` } as CSSProperties;
  const isProjects = nav === 'projects';
  const [inspectorTab, setInspectorTab] = useState<'motion' | 'canvas' | 'media' | 'text' | 'layers'>('motion');
  useEffect(() => { const open = (e: Event) => { const tab = (e as CustomEvent).detail; if (['motion', 'canvas', 'media', 'text', 'layers'].includes(tab)) setInspectorTab(tab); }; window.addEventListener('rp-inspector-tab', open); return () => window.removeEventListener('rp-inspector-tab', open); }, []);
  const selectedTextId = useUIStore((s) => s.selectedTextId);
  const selectedMotionId = useUIStore((s) => s.selectedMotionId);
  useEffect(() => { if (selectedMotionId && useUIStore.getState().selectionOrigin !== 'layers') setInspectorTab(tab => tab === 'layers' ? tab : 'motion'); }, [selectedMotionId]);
  useEffect(() => { if (selectedTextId && useUIStore.getState().selectionOrigin !== 'layers') setInspectorTab(tab => tab === 'layers' ? tab : (() => { const l = useSceneStore.getState().textLayers.find(l => l.id === selectedTextId); return l?.media || l?.shape ? 'media' : 'text'; })()); }, [selectedTextId]);

  return (
    <div className={`app resizable-app ${previewExpanded ? 'preview-expanded-app' : ''} ${showGrid ? '' : 'stage-grid-off'} ${tplCollapsed ? 'app-tpl-collapsed' : ''} ${leftCollapsed ? 'left-collapsed' : ''} ${rightCollapsed ? 'right-collapsed' : ''}`} style={layoutStyle}>
      <PanelDock panel="rail"><IconRail /></PanelDock>

      <PanelDock panel="library" collapsed={leftCollapsed} strip={tplCollapsed}>{tplCollapsed ? <CollapsedStrip /> : isProjects ? <ProjectsPanel onProjectOpen={() => useUIStore.getState().setNav('library')} /> : <TemplatesCard />}</PanelDock>

      <main className={`stage-col ${previewExpanded ? 'preview-expanded' : ''}`}>
        <PreviewStage />
        <button
          className="stage-fs"
          title={previewExpanded ? (tx(pt, 'Restaurar painéis · Esc', 'Restore panels · Esc')) : (tx(pt, 'Ampliar preview', 'Expand preview'))}
          aria-label={previewExpanded ? (tx(pt, 'Restaurar painéis', 'Restore panels')) : (tx(pt, 'Ampliar preview', 'Expand preview'))}
          aria-pressed={previewExpanded}
          onClick={() => setPreviewExpanded(value=>!value)}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <HistoryControls />
        <button className="panel-toggle panel-toggle-left" onClick={toggleLeftPanel} aria-expanded={!leftCollapsed} aria-label={leftCollapsed ? t('expandLeft') : t('collapseLeft')} title={leftCollapsed ? t('expandLeft') : t('collapseLeft')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="panel-toggle panel-toggle-right" onClick={toggleRightPanel} aria-expanded={!rightCollapsed} aria-label={rightCollapsed ? t('expandRight') : t('collapseRight')} title={rightCollapsed ? t('expandRight') : t('collapseRight')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </main>

      <PanelDock panel="inspector" collapsed={rightCollapsed}><div className="inspector-stack"><section className="card right card-scroll">
        <div className="inspector-tabs" role="tablist" aria-label={t('inspector')} onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const tabs = ['motion', 'canvas', 'media', 'text', 'layers'] as const;
          const index = tabs.indexOf(inspectorTab);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          setInspectorTab(tabs[next]); document.getElementById(`inspector-tab-${tabs[next]}`)?.focus();
        }}>
          {(['motion', 'canvas', 'media', 'text', 'layers'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`inspector-tab-${tab}`}
              tabIndex={inspectorTab === tab ? 0 : -1}
              aria-controls="inspector-content"
              aria-selected={inspectorTab === tab}
              aria-label={t(tab)}
              title={t(tab)}
              className={`inspector-tab ${inspectorTab === tab ? 'active' : ''}`}
              onClick={() => setInspectorTab(tab)}
            >
              <InspectorIcon tab={tab}/>
            </button>
          ))}
        </div>
        <div className="inspector-content" id="inspector-content" role="tabpanel" aria-labelledby={`inspector-tab-${inspectorTab}`}>
          {inspectorTab === 'motion' && <><ScenePanel /><div className="hairline" /><EffectsPanel /></>}
          {inspectorTab === 'canvas' && <CanvasPanel />}
          {inspectorTab === 'media' && <><AbsoluteMediaPanel /><div className="hairline" /><ShapePanel /><div className="hairline" /><AssetsPanel /></>}
          {inspectorTab === 'text' && <TextPanel />}
          {inspectorTab === 'layers' && <CompositionLayers />}
        </div>
      </section></div></PanelDock>

      <PanelDock panel="timeline"><footer className="card bottom">
        <Timeline />
      </footer></PanelDock>
      {settingsOpen && <SettingsDialog />}
    </div>
  );
}
