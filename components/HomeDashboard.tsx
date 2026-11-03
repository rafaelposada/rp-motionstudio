// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useProjectStore } from '@/store/useProjectStore';
import { useUIStore } from '@/store/useUIStore';
import { useSceneStore } from '@/store/useSceneStore';
import { readProjectScene, type ProjectMeta } from '@/lib/projects';
import { homeProjectSummary, matchingProjects } from '@/lib/homeProjects';
import { loadProjectPreview } from '@/lib/projectPreviews';
import { enterProject } from '@/lib/homeNavigation';
import { flushScene } from '@/lib/scenePersist';
import { AddIcon, BackIcon, LibraryIcon, ProjectsIcon } from './EditorIcons';
import { tx } from '@/lib/tx';
import { QUICK_STARTS, startFromGoal } from '@/lib/quickStart';
import { startGuidedTour } from './GuidedTour';

const SettingsDialog = dynamic(() => import('./SettingsDialog'), { ssr: false });

function HomeSymbol({ type }: { type: 'home' | 'search' | 'settings' | 'grid' | 'list' | 'device' }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {type === 'home' && <path d="m2.5 8 7.5-6 7.5 6M4 7v10h4v-6h4v6h4V7" />}
    {type === 'search' && <><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></>}
    {type === 'settings' && <><path d="m8 2-.5 2-2 1-2-.4-1.5 3L3.5 9v2l-1.5 1.4 1.5 3 2-.4 2 1 .5 2h4l.5-2 2-1 2 .4 1.5-3-1.5-1.4V9L18 7.6l-1.5-3-2 .4-2-1-.5-2Z" /><circle cx="10" cy="10" r="3" /></>}
    {type === 'grid' && <>{[3, 11].flatMap(x => [3, 11].map(y => <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1" />))}</>}
    {type === 'list' && <path d="M7 5h10M7 10h10M7 15h10M3 5h.1M3 10h.1M3 15h.1" />}
    {type === 'device' && <><rect x="2.5" y="3" width="15" height="10" rx="1.5" /><path d="M10 13v4M6 17h8" /></>}
  </svg>;
}

function ProjectCard({ project, active, summary, pt, busy }: {
  project: ProjectMeta; active: boolean; summary: ReturnType<typeof homeProjectSummary>; pt: boolean; busy: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false, url: string | null = null;
    loadProjectPreview(project.id).then(blob => {
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob); setPreview(url);
    }).catch(() => {});
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [project.id, project.updatedAt]);
  const edited = new Date(project.updatedAt).toLocaleString(tx(pt, 'pt-BR', 'en-US'), { dateStyle: 'medium', timeStyle: 'short' });
  return <button type="button" className={`home-project ${active ? 'is-current' : ''}`} disabled={busy} onClick={() => enterProject(project.id)} aria-label={`${tx(pt, 'Abrir projeto', 'Open project')}: ${project.name}`}>
    <div className="home-project-preview">
      {preview ? <img src={preview} alt="" loading="lazy" /> : <div className="home-preview-empty"><span className="home-preview-mark">{project.name.trim().slice(0, 2).toLocaleUpperCase()}</span><small>{tx(pt, 'Prévia disponível ao voltar do editor', 'Preview available after returning from the editor')}</small></div>}
      <span className="home-format">{summary.aspect}</span>
    </div>
    <div className="home-project-info">
      <div className="home-project-title"><strong title={project.name}>{project.name}</strong>{active && <span className="home-current-dot" title={tx(pt, 'Projeto em edição', 'Current project')} />}</div>
      <span className="home-project-details">{summary.duration !== null ? `${summary.duration}s · ` : ''}{summary.layers} {summary.layers === 1 ? tx(pt, 'camada', 'layer') : tx(pt, 'camadas', 'layers')}</span>
      <span className="home-project-date"><HomeSymbol type="device" />{edited}</span>
    </div>
  </button>;
}

function NewProjectDialog({ pt, onClose }: { pt: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const count = useProjectStore(s => s.projects.length);
  const [name, setName] = useState(`${tx(pt, 'Projeto', 'Project')} ${count + 1}`);
  const [aspect, setAspect] = useState('9:16');
  useEffect(() => { dialog.current?.showModal(); nameInput.current?.focus(); nameInput.current?.select(); }, []);
  return <dialog ref={dialog} className="home-new-dialog" aria-labelledby="home-new-title" onClose={onClose} onClick={e => {
    if (e.target !== dialog.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.current?.close();
  }}>
    <form onSubmit={e => {
      e.preventDefault();
      useProjectStore.getState().create(name.trim() || (tx(pt, 'Novo projeto', 'New project')));
      useSceneStore.getState().setAspect(aspect);
      flushScene();
      const id = useProjectStore.getState().activeId;
      if (id) enterProject(id);
      onClose();
    }}>
      <div className="home-dialog-heading"><div><span className="eyebrow">RP MotionStudio</span><h2 id="home-new-title">{tx(pt, 'Nova composição', 'New composition')}</h2></div><button type="button" className="home-icon-button" aria-label={tx(pt, 'Fechar', 'Close')} onClick={() => dialog.current?.close()}>×</button></div>
      <label>{tx(pt, 'Nome do projeto', 'Project name')}<input ref={nameInput} className="field" value={name} maxLength={160} onChange={e => setName(e.target.value)} /></label>
      <label>{tx(pt, 'Formato da composição', 'Composition format')}<select className="field" value={aspect} onChange={e => setAspect(e.target.value)}><option value="9:16">{tx(pt, 'Vertical · 9:16', 'Portrait · 9:16')}</option><option value="1:1">{tx(pt, 'Quadrado · 1:1', 'Square · 1:1')}</option><option value="16:9">{tx(pt, 'Horizontal · 16:9', 'Landscape · 16:9')}</option><option value="4:5">{tx(pt, 'Retrato · 4:5', 'Portrait · 4:5')}</option></select></label>
      <p>{tx(pt, 'Você pode ajustar o formato e adicionar suas mídias no editor.', 'You can change the format and add media in the editor.')}</p>
      <div className="home-dialog-actions"><button type="button" className="btn" onClick={() => dialog.current?.close()}>{tx(pt, 'Cancelar', 'Cancel')}</button><button className="btn solid" type="submit">{tx(pt, 'Criar projeto', 'Create project')}</button></div>
    </form>
  </dialog>;
}

export default function HomeDashboard() {
  const projects = useProjectStore(s => s.projects), activeId = useProjectStore(s => s.activeId), booted = useProjectStore(s => s.booted);
  const theme = useUIStore(s => s.theme), pt = useUIStore(s => s.locale) === 'pt', settingsOpen = useUIStore(s => s.settingsOpen);
  const [view, setView] = useState<'recent' | 'all'>('recent');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [search, setSearch] = useState(''), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLElement>(null);
  const resetHome = () => { setView('recent'); setSearch(''); main.current?.scrollTo({ top: 0 }); };
  const active = projects.find(project => project.id === activeId);
  const summaries = useMemo(() => new Map(projects.map(project => [project.id, homeProjectSummary(readProjectScene(project.id))])), [projects]);
  const matching = matchingProjects(projects, search, sort), visible = view === 'recent' && !search.trim() ? matching.slice(0, 12) : matching;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); useUIStore.getState().setSettingsOpen(true); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  return <div className="home-shell">
    <header className="home-topbar">
      <button className="home-brand" onClick={resetHome} aria-label={tx(pt, 'RP MotionStudio — Início', 'RP MotionStudio — Home')}><img src={`/rp-motionstudio-${theme}.svg`} alt="" width="38" height="38" /><span>RP <b>MotionStudio</b></span></button>
      <div className="home-top-actions">{active && <button className="home-return" disabled={busy} onClick={() => enterProject(active.id)}><BackIcon size={16} /><span>{tx(pt, 'Voltar ao editor', 'Back to editor')}</span></button>}<button className="home-icon-button" onClick={() => useUIStore.getState().setSettingsOpen(true)} aria-label={tx(pt, 'Configurações', 'Settings')} title={tx(pt, 'Configurações (⌘,)', 'Settings (⌘,)')}><HomeSymbol type="settings" /></button></div>
    </header>
    <aside className="home-sidebar" aria-label={tx(pt, 'Navegação inicial', 'Home navigation')}>
      <div className="home-file-actions"><button className="btn solid" disabled={busy || !booted} onClick={() => setCreating(true)}><AddIcon size={18} />{tx(pt, 'Novo projeto', 'New project')}</button><button className="btn home-open-file" disabled={busy} onClick={() => input.current?.click()}><ProjectsIcon size={18} />{tx(pt, 'Abrir projeto…', 'Open project…')}</button></div>
      <nav><button className={view === 'recent' ? 'active' : ''} aria-current={view === 'recent' ? 'page' : undefined} onClick={resetHome}><HomeSymbol type="home" />{tx(pt, 'Início', 'Home')}</button><button className={view === 'all' ? 'active' : ''} aria-current={view === 'all' ? 'page' : undefined} onClick={() => { setView('all'); setSearch(''); }}><ProjectsIcon />{tx(pt, 'Seus projetos', 'Your projects')}<span className="home-count">{projects.length}</span></button><button disabled={busy || !active} onClick={() => active && enterProject(active.id)}><LibraryIcon />{tx(pt, 'Biblioteca de modelos', 'Template library')}</button></nav>
      <div className="home-local-note"><HomeSymbol type="device" /><div><strong>{tx(pt, 'Neste dispositivo', 'On this device')}</strong><span>{tx(pt, 'Projetos salvos localmente', 'Projects saved locally')}</span></div></div>
    </aside>
    <main ref={main} className="home-main" id="home-main">
      <section className="home-welcome"><span className="eyebrow">{tx(pt, 'SEU ESPAÇO CRIATIVO', 'YOUR CREATIVE WORKSPACE')}</span><h1>{tx(pt, 'Bom te ver por aqui.', 'Welcome to your next idea.')}</h1><p>{tx(pt, 'Uma nova ideia ou de onde você parou. Seu próximo movimento começa aqui.', 'Start something new or pick up where you left off. Your next move starts here.')}</p>
        <div className="home-welcome-actions">
          {active && <button className="home-resume" disabled={busy} onClick={() => enterProject(active.id)}><span className="home-resume-icon"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="m6 3 9 6-9 6Z" fill="currentColor" /></svg></span><span><small>{tx(pt, 'CONTINUAR EDITANDO', 'CONTINUE EDITING')}</small><strong>{active.name}</strong></span><span aria-hidden="true">↗</span></button>}
          <button className="home-resume home-tour" disabled={busy || !booted} onClick={() => { if (active) enterProject(active.id); else startFromGoal(QUICK_STARTS[0], pt); startGuidedTour(); }}><span className="home-resume-icon"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m11.8 6.2-1.7 3.9-3.9 1.7 1.7-3.9z" fill="currentColor" /></svg></span><span><small>{tx(pt, 'PRIMEIRA VEZ AQUI?', 'FIRST TIME HERE?')}</small><strong>{tx(pt, 'Tutorial guiado', 'Guided tutorial')}</strong></span><span aria-hidden="true">→</span></button>
        </div>
      </section>
      {view === 'recent' && <section className="home-quickstart" aria-labelledby="home-quickstart-title">
        <div className="home-section-heading"><div><h2 id="home-quickstart-title">{tx(pt, 'Comece por um objetivo', 'Start from a goal')}</h2><span>{tx(pt, 'Formato, modelo e um título de partida prontos. Troque tudo depois.', 'Format, model and a starting headline, ready. Change anything later.')}</span></div></div>
        <div className="home-quickstart-grid">{QUICK_STARTS.map((goal) => { const [aw, ah] = goal.aspect.split(':').map(Number); return <button key={goal.id} type="button" className="home-quickstart-card" disabled={busy} onClick={() => startFromGoal(goal, pt)}>
          <span className="home-quickstart-frame" aria-hidden="true"><i style={{ aspectRatio: `${aw} / ${ah}` }} /></span>
          <strong>{tx(pt, goal.pt, goal.en)}</strong><small>{tx(pt, goal.hintPt, goal.hintEn)}</small>
        </button>; })}</div>
      </section>}
      <section className="home-recents" aria-labelledby="home-projects-title">
        <div className="home-section-heading"><div><h2 id="home-projects-title">{view === 'all' ? (tx(pt, 'Seus projetos', 'Your projects')) : (tx(pt, 'Recentes', 'Recent projects'))}</h2><span>{projects.length} {projects.length === 1 ? tx(pt, 'projeto salvo neste dispositivo', 'project saved on this device') : tx(pt, 'projetos salvos neste dispositivo', 'projects saved on this device')}</span></div>{view === 'recent' && <button className="home-all-projects" onClick={() => setView('all')}>{tx(pt, 'Exibir todos os projetos', 'View all projects')}<span aria-hidden="true">→</span></button>}</div>
        <div className="home-project-toolbar"><label className="home-search"><HomeSymbol type="search" /><input type="search" aria-label={tx(pt, 'Buscar projetos', 'Search projects')} placeholder={tx(pt, 'Buscar pelo nome do projeto', 'Search by project name')} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }} /></label><div className="home-view-tools"><select aria-label={tx(pt, 'Ordenar projetos', 'Sort projects')} value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="recent">{tx(pt, 'Última edição', 'Last edited')}</option><option value="name">{tx(pt, 'Nome', 'Name')}</option></select><div className="home-view-toggle" role="group" aria-label={tx(pt, 'Visualização dos projetos', 'Project view')}>{(['grid', 'list'] as const).map(mode => <button key={mode} aria-label={mode === 'grid' ? (tx(pt, 'Visualizar em grade', 'Grid view')) : (tx(pt, 'Visualizar em lista', 'List view'))} aria-pressed={layout === mode} onClick={() => setLayout(mode)}><HomeSymbol type={mode} /></button>)}</div></div></div>
        <p className="home-message" role="status">{busy ? (tx(pt, 'Abrindo o pacote de projeto…', 'Opening project package…')) : message}</p>
        {visible.length ? <div className={`home-projects home-projects-${layout}`}>{visible.map(project => <ProjectCard key={project.id} project={project} summary={summaries.get(project.id)!} active={project.id === activeId} pt={pt} busy={busy} />)}</div> : <div className="home-no-projects"><ProjectsIcon size={32} /><h3>{search.trim() ? (tx(pt, 'Nenhum projeto encontrado', 'No matching projects')) : (tx(pt, 'Sua primeira ideia começa aqui', 'Your first idea starts here'))}</h3><p>{search.trim() ? (tx(pt, 'Tente outro nome ou limpe a busca.', 'Try another name or clear your search.')) : (tx(pt, 'Crie uma composição ou abra um pacote de projeto.', 'Create a composition or open a project package.'))}</p><button className="btn" onClick={() => search.trim() ? setSearch('') : setCreating(true)}>{search.trim() ? (tx(pt, 'Limpar busca', 'Clear search')) : (tx(pt, 'Criar projeto', 'Create project'))}</button></div>}
      </section>
      <footer className="home-footer"><span>RP MotionStudio</span><span>{tx(pt, 'Fotos, vídeos, texto. Tudo no seu ritmo.', 'Photos, video, text. All at your own pace.')}</span></footer>
    </main>
    <input ref={input} type="file" hidden accept=".motion.zip,.zip" aria-label={tx(pt, 'Arquivo de projeto Motion Studio', 'Motion Studio project file')} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      setBusy(true); setMessage('');
      try { const { importProjectPackage } = await import('@/lib/projectPackage'); const project = await importProjectPackage(file); enterProject(project.id); }
      catch (error) { setMessage(error instanceof Error ? error.message : (tx(pt, 'Não foi possível abrir o projeto.', 'Could not open the project.'))); }
      finally { setBusy(false); }
    }} />
    {creating && <NewProjectDialog pt={pt} onClose={() => setCreating(false)} />}
    {settingsOpen && <SettingsDialog />}
  </div>;
}
