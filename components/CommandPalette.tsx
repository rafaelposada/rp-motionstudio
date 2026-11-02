// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { addCompositionText } from '@/lib/textActions';
import { addShape } from './ShapePanel';
import { showHome } from '@/lib/homeNavigation';
import { useProjectStore } from '@/store/useProjectStore';
import { tx } from '@/lib/tx';

interface Command { id: string; label: string; hint?: string; run: () => void }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ⌘K / Ctrl+K: find any action by name and run it with Enter.
export default function CommandPalette() {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [index, setIndex] = useState(0);
  const pt = useUIStore((s) => s.locale) === 'pt';
  const input = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { const d = dialog.current; if (!d) return; if (open && !d.open) { d.showModal(); setQuery(''); setIndex(0); requestAnimationFrame(() => input.current?.focus()); } if (!open && d.open) d.close(); }, [open]);
  const commands = useMemo<Command[]>(() => {
    const ui = () => useUIStore.getState(), scene = () => useSceneStore.getState();
    const toggle = (key: 'showRulers' | 'smartGuides' | 'snapEnabled' | 'showCanvasTools' | 'showArrangeTools') => ui().setAlignmentOption(key, !ui()[key]);
    return [
      { id: 'text', label: tx(pt, 'Adicionar texto', 'Add text'), hint: 'T', run: () => { addCompositionText(); } },
      { id: 'rect', label: tx(pt, 'Adicionar retângulo', 'Add rectangle'), run: () => addShape('rect', pt) },
      { id: 'ellipse', label: tx(pt, 'Adicionar elipse', 'Add ellipse'), run: () => addShape('ellipse', pt) },
      { id: 'line', label: tx(pt, 'Adicionar linha', 'Add line'), run: () => addShape('line', pt) },
      { id: 'marker', label: tx(pt, 'Adicionar marcador no tempo atual', 'Add marker at playhead'), hint: 'M', run: () => { const s = scene(); s.setMarkers([...s.markers, { t: Math.round(s.frame / s.fps * 100) / 100 }]); } },
      { id: 'play', label: tx(pt, 'Reproduzir / pausar', 'Play / pause'), hint: tx(pt, 'Espaço', 'Space'), run: () => scene().setPlaying(!scene().playing) },
      { id: 'undo', label: tx(pt, 'Desfazer', 'Undo'), hint: '⌘Z', run: () => useHistoryStore.getState().undo() },
      { id: 'redo', label: tx(pt, 'Refazer', 'Redo'), hint: '⇧⌘Z', run: () => useHistoryStore.getState().redo() },
      { id: 'rulers', label: tx(pt, 'Mostrar / ocultar réguas', 'Toggle rulers'), run: () => toggle('showRulers') },
      { id: 'guides', label: tx(pt, 'Ligar / desligar guias inteligentes', 'Toggle smart guides'), run: () => toggle('smartGuides') },
      { id: 'snap', label: tx(pt, 'Ligar / desligar encaixe', 'Toggle snapping'), run: () => toggle('snapEnabled') },
      { id: 'bbox', label: tx(pt, 'Mostrar / ocultar caixa delimitadora', 'Toggle bounding box'), run: () => ui().setShowSelectionBox(!ui().showSelectionBox) },
      { id: 'canvasbar', label: tx(pt, 'Mostrar / ocultar barra de réguas e guias', 'Toggle rulers and guides bar'), run: () => toggle('showCanvasTools') },
      { id: 'arrangebar', label: tx(pt, 'Mostrar / ocultar barra de alinhar', 'Toggle align bar'), run: () => toggle('showArrangeTools') },
      { id: 'clearguides', label: tx(pt, 'Remover todas as guias', 'Remove all guides'), run: () => scene().setGuides({ x: [], y: [] }) },
      { id: 'timeline-fit', label: tx(pt, 'Ajustar a linha do tempo inteira', 'Fit the whole timeline'), run: () => ui().setTimelineZoom(1) },
      { id: 'layers', label: tx(pt, 'Mostrar / ocultar camadas na linha do tempo', 'Toggle timeline layers'), run: () => ui().setTimelineExpanded(!ui().timelineExpanded) },
      { id: 'export', label: tx(pt, 'Exportar vídeo', 'Export video'), run: () => (document.querySelector('.export-btn') as HTMLButtonElement | null)?.click() },
      { id: 'settings', label: tx(pt, 'Abrir configurações', 'Open settings'), hint: '⌘,', run: () => ui().setSettingsOpen(true) },
      { id: 'brand', label: tx(pt, 'Kit de marca', 'Brand kit'), run: () => ui().setSettingsOpen(true, 'brand') },
      { id: 'theme', label: tx(pt, 'Alternar tema claro / escuro', 'Toggle light / dark theme'), run: () => ui().toggleTheme() },
      { id: 'lang-pt', label: 'Idioma: Português', run: () => ui().setLocale('pt') },
      { id: 'lang-es', label: 'Idioma: Español', run: () => ui().setLocale('es') },
      { id: 'lang-en', label: 'Language: English', run: () => ui().setLocale('en') },
      { id: 'new', label: tx(pt, 'Novo projeto', 'New project'), run: () => { useProjectStore.getState().create(tx(pt, 'Projeto', 'Project') + ' ' + (useProjectStore.getState().projects.length + 1)); } },
      { id: 'home', label: tx(pt, 'Ir para o início', 'Go home'), run: () => void showHome() },
    ];
  }, [pt]);
  const results = commands.filter((c) => fold(c.label).includes(fold(query.trim())));
  const run = (c?: Command) => { if (!c) return; setOpen(false); requestAnimationFrame(() => c.run()); };
  return <dialog ref={dialog} className="command-palette" aria-label={tx(pt, 'Paleta de comandos', 'Command palette')} onCancel={(e) => { e.preventDefault(); setOpen(false); }} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
    <input ref={input} className="command-input" value={query} placeholder={tx(pt, 'Buscar ação…', 'Search actions…')} aria-label={tx(pt, 'Buscar ação', 'Search actions')}
      onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
      onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); } else if (e.key === 'Enter') { e.preventDefault(); run(results[index]); } }} />
    <ul className="command-list" role="listbox">{results.map((c, i) => <li key={c.id} role="option" aria-selected={i === index}><button type="button" className={i === index ? 'active' : ''} onMouseEnter={() => setIndex(i)} onClick={() => run(c)}><span>{c.label}</span>{c.hint && <kbd>{c.hint}</kbd>}</button></li>)}
      {!results.length && <li className="command-empty">{tx(pt, 'Nenhuma ação encontrada.', 'No actions found.')}</li>}</ul>
  </dialog>;
}
