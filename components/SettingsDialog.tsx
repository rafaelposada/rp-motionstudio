// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useI18n } from '@/lib/useI18n';
import { DEFAULT_PANELS, PANEL_LIMITS, isAdjustable, type PanelAxis, type PanelId } from '@/lib/panelLayout';
import { parseNumericExpression } from '@/lib/numericExpression';
import {numericKeyValue} from '@/lib/numericKeyboard';
import { panelName } from './PanelDock';
import { storageReport } from '@/lib/projectPackage';
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '@/lib/accentColor';
import DestinationFolder from './DestinationFolder';
import { flushScene, getSaveState } from '@/lib/scenePersist';
import SupportPanel from './SupportPanel';
import PhantomSupplyPanel from './PhantomSupplyPanel';
import UpdateSettings from './UpdateSettings';
import { tx } from '@/lib/tx';
import PreviewQualityControl from './PreviewQuality';
import { BrandKitSettings } from './BrandKitPanel';

function AutosaveSettings({ pt }: { pt: boolean }) {
  const enabled = useUIStore(s => s.autosaveEnabled), delay = useUIStore(s => s.autosaveDelay);
  const [state, setState] = useState(getSaveState);
  useEffect(() => { const update = () => setState(getSaveState()); window.addEventListener('motion-save-status', update); return () => window.removeEventListener('motion-save-status', update); }, []);
  return <><h3>{tx(pt, 'Salvamento automático', 'Autosave')}</h3>
    <p className="settings-description">{tx(pt, 'A composição é salva nos dados locais deste aplicativo. Fotos, imagens absolutas e áudio importados ficam no armazenamento local. Ao reabrir o app, o projeto é restaurado.', 'The composition is saved in local application data. Imported photos, absolute images and audio remain in local storage. Reopening the app restores the project.')}</p>
    <label className="settings-row"><span><strong>{tx(pt, 'Salvar alterações automaticamente', 'Automatically save changes')}</strong><span className="settings-description">{tx(pt, 'Ativado por padrão. A reprodução não gera gravações a cada quadro.', 'Enabled by default. Playback does not write on every frame.')}</span></span><input type="checkbox" checked={enabled} onChange={e => useUIStore.getState().setAutosave(e.target.checked)}/></label>
    <label className="settings-row"><strong>{tx(pt, 'Intervalo máximo entre gravações', 'Maximum interval between saves')}</strong><select className="field" disabled={!enabled} value={delay} onChange={e => useUIStore.getState().setAutosave(enabled, Number(e.target.value))}>{[500,1000,2000,5000].map(ms => <option key={ms} value={ms}>{ms/1000} s</option>)}</select></label>
    <div className="autosave-summary" role="status"><strong>{state.status === 'error' ? (tx(pt, 'Erro ao salvar — verifique o armazenamento.', 'Save failed — check storage.')) : state.status === 'pending' ? (tx(pt, 'Há alterações não salvas.', 'There are unsaved changes.')) : state.status === 'saving' ? (tx(pt, 'Salvando alterações…', 'Saving changes…')) : (tx(pt, 'Composição salva neste aplicativo.', 'Composition saved in this app.'))}</strong>{state.savedAt && <span>{tx(pt, 'Última gravação: ', 'Last saved: ')}{new Date(state.savedAt).toLocaleTimeString()}</span>}</div>
    <button className="btn primary" onClick={() => { flushScene(); setState(getSaveState()); }}>{tx(pt, 'Salvar agora · ⌘/Ctrl+S', 'Save now · ⌘/Ctrl+S')}</button>
    <p className="settings-description">{tx(pt, 'Trocar de projeto também salva a composição atual. Com o salvamento automático desligado, use Salvar agora antes de fechar.', 'Switching projects also saves the current composition. When autosave is off, use Save now before closing.')}</p>
    <div className="settings-callout"><strong>{tx(pt, 'Cópia portátil no computador', 'Portable copy on your computer')}</strong><p>{tx(pt, 'O salvamento local depende dos dados deste aplicativo. Para guardar uma cópia independente ou transferir para outro Mac, use Projetos → Salvar rascunho ou Salvar como template. O pacote .motion.zip inclui a composição e as mídias.', 'Local saving depends on application data. To keep an independent copy or transfer to another Mac, use Projects → Save draft or Save as template. The .motion.zip package includes the composition and media.')}</p></div>
  </>;
}

function AccentPicker({ pt }: { pt: boolean }) {
  const color = useUIStore((s) => s.accentColor);
  const setColor = useUIStore((s) => s.setAccentColor);
  return <div className="settings-row settings-accent-row"><div><strong>{tx(pt, 'Cor de acento', 'Accent color')}</strong><p>{tx(pt, 'Seleções, foco e ações principais. Suas mídias mantêm as cores originais.', 'Selections, focus and primary actions. Your media keeps its original colors.')}</p></div>
    <div className="settings-accent-controls"><div className="accent-swatches" role="group" aria-label={tx(pt, 'Cores de acento', 'Accent colors')}>{ACCENT_PRESETS.map((preset) => <button type="button" key={preset.color} style={{ backgroundColor: preset.color }} aria-label={tx(pt, preset.pt, preset.en)} title={tx(pt, preset.pt, preset.en)} aria-pressed={color === preset.color} onClick={() => setColor(preset.color)}><span aria-hidden="true">{color === preset.color ? '✓' : ''}</span></button>)}</div>
      <div className="accent-custom"><label><span>{tx(pt, 'Personalizada', 'Custom')}</span><input type="color" aria-label={tx(pt, 'Cor de acento personalizada', 'Custom accent color')} value={color} onInput={(event) => setColor(event.currentTarget.value)} onChange={(event) => setColor(event.target.value)} /></label><code>{color.toUpperCase()}</code><button type="button" className="settings-auto" onClick={() => setColor(DEFAULT_ACCENT)}>{tx(pt, 'Restaurar azul', 'Reset to blue')}</button></div>
    </div>
  </div>;
}

function DimensionField({ panel, axis, pt }: { panel: PanelId; axis: PanelAxis; pt: boolean }) {
  const value = useUIStore((s) => s.panels[panel][axis]);
  const [draft, setDraft] = useState(String(value || 'Auto'));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  const discard = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value || 'Auto')); }, [value]);
  const automatic = axis === 'height' || panel === 'timeline';
  const [min, max] = PANEL_LIMITS[panel][axis];
  const label = `${axis === 'width' ? tx(pt, 'Largura', 'Width') : tx(pt, 'Altura', 'Height')} — ${panelName(panel, pt)}`;
  const commit = () => {
    focused.current = false;
    if (discard.current) { discard.current = false; return; }
    const parsed = automatic && (!draft.trim() || draft.toLowerCase() === 'auto') ? 0 : parseNumericExpression(draft, 'px');
    if (parsed === null) { setInvalid(true); return; }
    useUIStore.getState().setPanelDimension(panel, axis, parsed);
    setDraft(String(useUIStore.getState().panels[panel][axis] || 'Auto')); setInvalid(false);
  };
  return <div className="settings-dimension"><div className="settings-dimension-input"><input aria-label={label} aria-invalid={invalid} type="text" inputMode="decimal" value={draft} title={`${min}–${max}px. ${tx(pt, 'Aceita cálculos, como 300+20.', 'Accepts calculations, such as 300+20.')}`} onFocus={() => { focused.current = true; }} onChange={(event) => { setDraft(event.target.value); setInvalid(false); }} onBlur={commit} onKeyDown={(event) => {const next=numericKeyValue(event,parseNumericExpression(draft,'px')??value,{min,max,integer:true});if(next!==null){event.preventDefault();event.stopPropagation();useUIStore.getState().setPanelDimension(panel,axis,next);setDraft(String(next));setInvalid(false);return;} if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); discard.current = true; focused.current = false; setDraft(String(value || 'Auto')); setInvalid(false); event.currentTarget.blur(); } }} /><span>px</span></div>{automatic && <button type="button" className="settings-auto" aria-label={`${tx(pt, 'Automático', 'Automatic')} — ${label}`} onClick={() => { useUIStore.getState().setPanelDimension(panel, axis, 0); setDraft('Auto'); setInvalid(false); }}>Auto</button>}{invalid && <small role="alert">{tx(pt, 'Valor inválido', 'Invalid value')}</small>}</div>;
}

// Sidebar sections laid out like System Settings on the Mac: the brand kit on
// top, then groups of related preferences.
interface Section { id: string; pt: string; en: string; group: number; icon: string; featured?: boolean }
const SECTIONS: Section[] = [
  { id: 'brand', pt: 'Kit de marca', en: 'Brand kit', group: 0, featured: true, icon: 'M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.9-1 1.4-2.1-.6-1.4.3-2.9 1.8-2.9h1.8a3.5 3.5 0 0 0 3.5-3.5c0-4.7-3.8-8.5-8.5-8.5zM7.6 11h.01M10 7.4h.01M14.4 7.6h.01' },
  { id: 'interface', pt: 'Interface', en: 'Interface', group: 1, icon: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 3.5v17M12 8h5.6M12 12h8.4M12 16h5.6' },
  { id: 'panels', pt: 'Painéis', en: 'Panels', group: 1, icon: 'M4 5h16v14H4zM9.5 5v14M9.5 11.5H20' },
  { id: 'preview', pt: 'Prévia', en: 'Preview', group: 1, icon: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z' },
  { id: 'saving', pt: 'Salvamento', en: 'Saving', group: 2, icon: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6' },
  { id: 'files', pt: 'Arquivos', en: 'Files', group: 2, icon: 'M3.5 6.5h6l2 2h9v10h-17z' },
  { id: 'updates', pt: 'Atualizações', en: 'Updates', group: 2, icon: 'M19.2 8.5A8 8 0 1 0 20 14M19.5 4v4.5H15' },
  { id: 'shortcuts', pt: 'Atalhos', en: 'Shortcuts', group: 3, icon: 'M3 7h18v10H3zM6.5 10.5h1M10 10.5h1M13.5 10.5h1M17 10.5h.5M7 14h10' },
  { id: 'support', pt: 'Apoio e contato', en: 'Support & contact', group: 4, icon: 'M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.5a3.8 3.8 0 0 1 7 2.3C19 14.6 12 19 12 19z' },
  { id: 'phantom', pt: 'Phantom Supply', en: 'Phantom Supply', group: 4, icon: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8' },
];

export default function SettingsDialog() {
  const { locale } = useI18n(); const pt = locale === 'pt';
  const appearance = useUIStore((s) => s.appearance); const grid = useUIStore((s) => s.showStageGrid);
  const leftHidden = useUIStore((s) => s.leftCollapsed); const rightHidden = useUIStore((s) => s.rightCollapsed);
  const preferencesError = useUIStore((s) => s.preferencesError);
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState(useUIStore.getState().settingsSection);
  useEffect(() => { dialog.current?.querySelector('.settings-body')?.scrollTo({top:0}); }, [tab]);
  const [message, setMessage] = useState('');
  const [storage, setStorage] = useState('');
  const [diagnostics, setDiagnostics] = useState<{ version: string; ffmpeg: string } | null>(null);
  const close = () => useUIStore.getState().setSettingsOpen(false);
  useEffect(() => {
    const element = dialog.current; const prior = document.activeElement as HTMLElement | null;
    element?.showModal();
    const controller = new AbortController();
    fetch('/api/diagnostics', { signal: controller.signal }).then((r) => r.json()).then(setDiagnostics).catch(() => {});
    return () => { controller.abort(); element?.close(); prior?.focus(); };
  }, []);
  useEffect(() => {
    if (tab !== 'files') return; let active = true;
    storageReport().then((report) => { if (active) setStorage(`${(report.total / 1048576).toFixed(1)} MB · ${report.count} ${tx(pt, 'arquivos de mídia locais', 'local media files')}`); }).catch(() => { if (active) setStorage(tx(pt, 'Armazenamento indisponível.', 'Storage unavailable.')); });
    return () => { active = false; };
  }, [tab, pt]);
  const tabs = SECTIONS.map((section) => [section.id, tx(pt, section.pt, section.en)]);
  const current = SECTIONS.find((section) => section.id === tab) ?? SECTIONS[0];
  const choose = (id: string) => { setTab(id); setMessage(''); };
  return <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="settings-surface">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-title"><span className="eyebrow">RP MotionStudio</span><h2 id="settings-title">{tx(pt, 'Configurações', 'Settings')}</h2></div>
        <nav className="settings-tabs" role="tablist" aria-orientation="vertical" aria-label={tx(pt, 'Seções de configurações', 'Settings sections')} onKeyDown={(event) => {
          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); const index = tabs.findIndex(([id]) => id === tab), forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (forward ? 1 : -1) + tabs.length) % tabs.length;
          choose(tabs[next][0]); document.getElementById(`settings-tab-${tabs[next][0]}`)?.focus();
        }}>{SECTIONS.map((section, i) => <Fragment key={section.id}>{i > 0 && section.group !== SECTIONS[i - 1].group && <hr className="settings-tabs-divider" aria-hidden="true" />}<button role="tab" type="button" id={`settings-tab-${section.id}`} tabIndex={tab === section.id ? 0 : -1} aria-controls="settings-content" aria-selected={tab === section.id}
          className={`settings-tab ${section.featured ? 'featured' : ''}`} onClick={() => choose(section.id)}>
          <span className="settings-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d={section.icon} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <span className="settings-tab-text"><span>{tx(pt, section.pt, section.en)}</span></span>
        </button></Fragment>)}</nav>
      </aside>
      <div className="settings-main">
      <header className="settings-header"><h2 className="settings-section-title">{tx(pt, current.pt, current.en)}</h2><button className="settings-close" aria-label={tx(pt, 'Fechar configurações', 'Close settings')} onClick={close} autoFocus>×</button></header>
      <div className="settings-body" role="tabpanel" id="settings-content" aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'interface' && <><h3>{tx(pt, 'Seu espaço de trabalho', 'Your workspace')}</h3><p className="settings-description">{tx(pt, 'Preferências desta instalação. Seus projetos não são alterados.', 'Preferences for this installation. Your projects stay unchanged.')}</p>
          <div className="settings-row"><div><strong>{tx(pt, 'Aparência', 'Appearance')}</strong><p>{tx(pt, 'Sistema acompanha a aparência do macOS.', 'System follows the macOS appearance.')}</p></div><div className="settings-segment">{(['system', 'dark', 'light'] as const).map((value) => <button key={value} aria-pressed={appearance === value} onClick={() => useUIStore.getState().setAppearance(value)}>{value === 'system' ? (tx(pt, 'Sistema', 'System')) : value === 'dark' ? (tx(pt, 'Escuro', 'Dark')) : (tx(pt, 'Claro', 'Light'))}</button>)}</div></div>
          <AccentPicker pt={pt} />
          <label className="settings-row"><span><strong>{tx(pt, 'Idioma', 'Language')}</strong><span className="settings-description">{tx(pt, 'Troca imediata, sem reiniciar.', 'Changes immediately, no restart needed.')}</span></span><select className="field" aria-label={tx(pt, 'Idioma da interface', 'Interface language')} value={locale} onChange={(event) => useUIStore.getState().setLocale(event.target.value === 'pt' ? 'pt' : event.target.value === 'es' ? 'es' : 'en')}><option value="pt">Português</option><option value="es">Español</option><option value="en">English</option></select></label>
          <label className="settings-row"><span><strong>{tx(pt, 'Grade de fundo', 'Background grid')}</strong><span className="settings-description">{tx(pt, 'Pontos ao redor da composição. Não aparecem na exportação.', 'Dots around the canvas. Not included in exports.')}</span></span><input type="checkbox" checked={grid} onChange={(event) => useUIStore.getState().setShowStageGrid(event.target.checked)} /></label>
        </>}
        {tab === 'panels' && <><h3>{tx(pt, 'Dimensões dos painéis', 'Panel dimensions')}</h3><p className="settings-description">{tx(pt, 'Arraste as bordas dos painéis ou digite medidas e cálculos abaixo. Os painéis laterais ocupam a altura toda; a linha do tempo cresce até mostrar todas as camadas. Em janelas menores, as medidas se ajustam para preservar a composição.', 'Drag panel edges or enter dimensions and calculations below. Side panels use the full height; the timeline grows until every layer shows. Smaller windows adapt to keep the canvas visible.')}</p>
          <div className="settings-size-grid"><div className="settings-size-heading"><span>{tx(pt, 'Painel', 'Panel')}</span><span>{tx(pt, 'Largura', 'Width')}</span><span>{tx(pt, 'Altura', 'Height')}</span><span /></div>
            {(Object.keys(DEFAULT_PANELS) as PanelId[]).filter((panel) => isAdjustable(panel, 'width') || isAdjustable(panel, 'height')).map((panel) => <div className="settings-size-row" key={panel}><strong>{panelName(panel, pt)}</strong>{(['width', 'height'] as const).map((axis) => isAdjustable(panel, axis) ? <DimensionField key={axis} panel={panel} axis={axis} pt={pt} /> : <span key={axis} className="settings-size-fill">{tx(pt, 'Altura total', 'Full height')}</span>)}<button className="settings-reset-one" aria-label={`${tx(pt, 'Restaurar', 'Reset')} — ${panelName(panel, pt)}`} onClick={() => { const store = useUIStore.getState(); store.setPanelDimension(panel, 'width', DEFAULT_PANELS[panel].width); store.setPanelDimension(panel, 'height', 0); }}>↺</button></div>)}
          </div>
          <div className="settings-visibility"><label><input type="checkbox" checked={!leftHidden} onChange={() => useUIStore.getState().toggleLeftPanel()} /> {tx(pt, 'Mostrar biblioteca', 'Show library')}</label><label><input type="checkbox" checked={!rightHidden} onChange={() => useUIStore.getState().toggleRightPanel()} /> {tx(pt, 'Mostrar inspetor', 'Show inspector')}</label></div>
          <p className="settings-description">{tx(pt, 'Alças: setas ajustam 10px; Shift + seta ajusta 1px. Duplo clique ou Home restaura a dimensão.', 'Handles: arrows adjust 10px; Shift + arrow adjusts 1px. Double-click or Home resets a dimension.')}</p>
          <button className="btn" onClick={() => { useUIStore.getState().resetPanelLayout(); setMessage(tx(pt, 'Layout original restaurado. Projetos preservados.', 'Default layout restored. Projects preserved.')); }}>{tx(pt, 'Restaurar layout original', 'Restore default layout')}</button>
        </>}
        {tab === 'preview' && <><h3>{tx(pt, 'Qualidade e desempenho', 'Quality and performance')}</h3><p className="settings-description">{tx(pt, 'A qualidade abaixo afeta somente a visualização. O vídeo usa a resolução escolhida ao exportar.', 'This quality affects preview only. Video uses the resolution selected when exporting.')}</p><PreviewQualityControl pt={pt}/><p className="settings-description">{tx(pt, 'Pausar a reprodução reduz o trabalho da prévia. Projetos com muitos vídeos e modelos 3D exigem mais memória.', 'Pausing playback reduces preview work. Many videos and 3D models use more memory.')}</p></>}
        {tab === 'saving' && <AutosaveSettings pt={pt}/>}
        {tab === 'updates' && <UpdateSettings pt={pt}/>}
        {tab === 'files' && <><h3>{tx(pt, 'Arquivos neste Mac', 'Files on this Mac')}</h3><p className="settings-description">{storage || (tx(pt, 'Verificando armazenamento…', 'Checking storage…'))}</p><DestinationFolder kind="exports"/><DestinationFolder kind="drafts"/><DestinationFolder kind="templates"/><p className="settings-description">{tx(pt, 'Rascunhos e templates portáteis incluem as mídias. Os projetos em edição usam os dados locais do aplicativo; veja a aba Salvamento.', 'Portable drafts and templates include media. Working projects use local application data; see Saving.')}</p><p className="settings-description">{tx(pt, 'Exportação local', 'Local export')}: {diagnostics?.ffmpeg ?? '…'}</p></>}
        {tab === 'shortcuts' && <><h3>{tx(pt, 'Atalhos do editor', 'Editor shortcuts')}</h3><dl className="settings-shortcuts">{[[tx(pt, 'Configurações', 'Settings'), '⌘ / Ctrl + ,'], [tx(pt, 'Reproduzir / pausar', 'Play / pause'), tx(pt, 'Espaço / K', 'Space / K')], [tx(pt, 'Quadro anterior / seguinte', 'Previous / next frame'), '← / → · J / L'], [tx(pt, 'Saltar um segundo', 'Jump one second'), 'Shift + ← / →'], [tx(pt, 'Desfazer', 'Undo'), '⌘ / Ctrl + Z'], [tx(pt, 'Refazer', 'Redo'), '⌘ / Ctrl + Shift + Z'], [tx(pt, 'Salvar composição local', 'Save working composition'), '⌘ / Ctrl + S'],
 [tx(pt, 'Ampliar / reduzir somente a prévia', 'Zoom preview only'), '⌘ / Ctrl + / −'],
 [tx(pt, 'Ajustar prévia ao painel', 'Fit preview to panel'), '⌘ / Ctrl + 0'],
 [tx(pt, 'Deslocar a visualização', 'Pan preview'), tx(pt, 'Dois dedos · botão do meio', 'Two fingers · middle mouse')],
 [tx(pt, 'Ativar / sair da lupa', 'Toggle magnifier'), 'Z · Esc'],
 [tx(pt, 'Lupa: ampliar / reduzir', 'Magnifier: zoom in / out'), tx(pt, 'Clique / Alt + clique', 'Click / Alt + click')],
 [tx(pt, 'Adicionar texto na composição', 'Add text on canvas'), tx(pt, 'T → clique na composição · Esc cancela a ferramenta', 'T → click the canvas · Esc cancels the tool')],
 [tx(pt, 'Editar texto na composição', 'Edit text on canvas'), tx(pt, 'Duplo clique · Esc ou ⌘/Ctrl+Enter confirma', 'Double-click · Esc or ⌘/Ctrl+Enter commits')],
 [tx(pt, 'Refazer no Windows (alternativa)', 'Redo on Windows (alternative)'), 'Ctrl + Y'],
 [tx(pt, 'Zoom na posição do cursor', 'Zoom at cursor'), tx(pt, 'Alt + roda · pinça', 'Alt + wheel · pinch')],
 [tx(pt, 'Duplicar seleção', 'Duplicate selection'), '⌘ / Ctrl + D'],
 [tx(pt, 'Duplicar ao arrastar', 'Duplicate while dragging'), 'Alt / Option + arraste'],
 [tx(pt, 'Selecionar várias camadas', 'Select multiple layers'), 'Shift + clique'],
 [tx(pt, 'Selecionar todas as camadas (foco na composição)', 'Select all layers (composition focused)'), '⌘ / Ctrl + A'],
 [tx(pt, 'Excluir seleção e confirmar', 'Delete selection and confirm'), 'Backspace / Delete → Return'],
 [tx(pt, 'Ordenar camada pela alça', 'Reorder layer at grip'), 'Alt / Option + ↑ / ↓'],
 [tx(pt, 'Levar seleção ao topo', 'Bring selection to front'), '⌘ / Ctrl + Shift + ]'],
 [tx(pt, 'Enviar seleção ao fundo', 'Send selection to back'), '⌘ / Ctrl + Shift + ['],
 [tx(pt, 'Ajustar campo numérico em foco', 'Adjust focused numeric field'), '↑ / ↓'],
 [tx(pt, 'Ajuste fino do valor · passo ÷ 10', 'Fine value adjustment · step ÷ 10'), 'Shift + ↑ / ↓'],
 [tx(pt, 'Ajuste ultrafino · passo ÷ 100', 'Extra-fine adjustment · step ÷ 100'), '⌘ / Ctrl + Shift + ↑ / ↓'],
 [tx(pt, 'Rotação em passos de 15°', 'Rotate in 15° steps'), 'Shift + rotação'],
 [tx(pt, 'Redimensionar pelo centro', 'Resize from center'), 'Alt / Option + alça'],
 [tx(pt, 'Manter proporção ao redimensionar', 'Keep resize aspect ratio'), 'Shift + alça'],
 [tx(pt, 'Arredondar um canto da imagem', 'Round one image corner'), 'Alt / Option + círculo'],
 [tx(pt, 'Suspender encaixe durante arraste', 'Disable snapping while dragging'), 'Alt / Option'],
 [tx(pt, 'Cancelar transformação / fechar menu', 'Cancel transform / close dialog'), 'Esc']].map(([name, shortcut]) => <div key={name}><dt>{name}</dt><dd><kbd>{shortcut}</kbd></dd></div>)}</dl><p className="settings-description">{tx(pt, 'Os atalhos da composição ficam suspensos enquanto você digita ou usa este menu.', 'Composition shortcuts are suspended while typing or using this menu.')}</p></>}
        {tab === 'support' && <SupportPanel pt={pt}/>}
        {tab === 'phantom' && <PhantomSupplyPanel pt={pt}/>}
        {tab === 'brand' && <BrandKitSettings pt={pt}/>}
      </div>
      <footer className="settings-footer"><span role="status">{preferencesError ? (tx(pt, 'Não foi possível salvar as preferências neste dispositivo.', 'Could not save preferences on this device.')) : message || (tx(pt, 'Alterações salvas automaticamente neste Mac.', 'Changes saved automatically on this Mac.'))}</span><small>RP MotionStudio · {diagnostics?.version ?? '…'}</small></footer>
      </div>
    </div>
  </dialog>;
}
