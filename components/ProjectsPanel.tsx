// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import ProjectTools from './ProjectTools';
import { useI18n } from '@/lib/useI18n';
import { confirmLayer } from '@/lib/confirmLayer';

function editedAt(ms: number, pt: boolean): string {
  const minutes = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (minutes < 1) return pt ? 'Agora mesmo' : 'Just now';
  if (minutes < 60) return pt ? `Há ${minutes} min` : `${minutes} min ago`;
  if (minutes < 1440) return pt ? `Há ${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ago`;
  return new Date(ms).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short' });
}
export default function ProjectsPanel({ onProjectOpen }: { onProjectOpen?: () => void } = {}) {
  const { locale } = useI18n(), pt = locale === 'pt';
  const projects = useProjectStore(s => s.projects), activeId = useProjectStore(s => s.activeId);
  const [search, setSearch] = useState(''), [naming, setNaming] = useState(false), [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null), [editName, setEditName] = useState('');
  const discardRename = useRef(false);
  useEffect(() => { useProjectStore.getState().refresh(); }, []);
  const commitNew = () => {
    useProjectStore.getState().create(newName.trim() || `${pt ? 'Projeto' : 'Project'} ${projects.length + 1}`);
    setNaming(false); setNewName(''); onProjectOpen?.();
  };
  const commitRename = (id: string) => {
    if (!discardRename.current && editName.trim()) useProjectStore.getState().rename(id, editName.trim());
    discardRename.current = false; setEditingId(null);
  };
  const shown = [...projects].filter(p => p.name.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale))).sort((a, b) => b.updatedAt - a.updatedAt);
  return <section className="card templates projects-panel">
    <header className="projects-header"><div><h2>{pt ? 'Projetos' : 'Projects'}</h2><p>{projects.length} {pt ? 'salvos neste aplicativo' : 'saved in this app'}</p></div>
      <button className="btn primary project-new" title={pt ? 'Novo projeto' : 'New project'} onClick={() => setNaming(v => !v)}>+ {pt ? 'Novo' : 'New'}</button>
    </header>
    <div className="projects-search"><input className="field" type="search" aria-label={pt ? 'Buscar projetos' : 'Search projects'} placeholder={pt ? 'Buscar projetos…' : 'Search projects…'} value={search} onChange={e => setSearch(e.target.value)}/></div>
    {naming && <form className="projects-new-form" onSubmit={e => { e.preventDefault(); commitNew(); }}><input className="field" autoFocus aria-label={pt ? 'Nome do projeto' : 'Project name'} placeholder={`${pt ? 'Projeto' : 'Project'} ${projects.length + 1}`} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setNaming(false); }}/><div><button type="button" className="btn" onClick={() => setNaming(false)}>{pt ? 'Cancelar' : 'Cancel'}</button><button className="btn primary" type="submit">{pt ? 'Criar' : 'Create'}</button></div></form>}
    <div className="projects-scroll">
      <div className="projects-list" aria-label={pt ? 'Projetos recentes' : 'Recent projects'}>
        {shown.map(p => <article className={`project-card ${p.id === activeId ? 'active' : ''}`} key={p.id}>
          {editingId === p.id ? <input className="field prj-rename" autoFocus aria-label={pt ? 'Renomear projeto' : 'Rename project'} value={editName} onChange={e => setEditName(e.target.value)} onBlur={() => commitRename(p.id)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { discardRename.current = true; e.currentTarget.blur(); } }}/> :
          <button className="project-card-open" onClick={() => { useProjectStore.getState().open(p.id); onProjectOpen?.(); }} aria-current={p.id === activeId ? 'page' : undefined}>
            <span className="project-glyph" aria-hidden="true">▥</span><span className="project-card-copy"><strong>{p.name}</strong><span title={new Date(p.updatedAt).toLocaleString(locale)}>{p.id === activeId && <b>{pt ? 'Aberto' : 'Open'} · </b>}{editedAt(p.updatedAt, pt)}</span></span>
          </button>}
          <div className="project-card-actions">
            <button title={pt ? 'Renomear projeto' : 'Rename project'} aria-label={`${pt ? 'Renomear' : 'Rename'}: ${p.name}`} onClick={() => { setEditingId(p.id); setEditName(p.name); }}>✎</button>
            <button title={pt ? 'Duplicar projeto' : 'Duplicate project'} aria-label={`${pt ? 'Duplicar' : 'Duplicate'}: ${p.name}`} onClick={() => useProjectStore.getState().duplicate(p.id)}>⧉</button>
            <button className="danger" title={pt ? 'Excluir projeto' : 'Delete project'} aria-label={`${pt ? 'Excluir' : 'Delete'}: ${p.name}`} onClick={async () => { if (await confirmLayer(pt ? `Excluir o projeto “${p.name}”? Esta ação não pode ser desfeita.` : `Delete project “${p.name}”? This cannot be undone.`, pt)) useProjectStore.getState().remove(p.id); }}>×</button>
          </div>
        </article>)}
        {!shown.length && <p className="projects-empty">{pt ? 'Nenhum projeto encontrado.' : 'No projects found.'}</p>}
      </div>
      <section className="projects-files"><h3>{pt ? 'Arquivos de projeto' : 'Project files'}</h3><ProjectTools /></section>
    </div>
  </section>;
}
