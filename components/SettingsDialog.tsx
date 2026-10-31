'use client';
import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useI18n } from '@/lib/useI18n';
import { DEFAULT_PANELS, PANEL_LIMITS, type PanelAxis, type PanelId } from '@/lib/panelLayout';
import { parseNumericExpression } from '@/lib/numericExpression';
import { getPreviewQuality, setPreviewQuality, type PreviewQuality } from '@/lib/previewResolution';
import { panelName } from './PanelDock';
import { storageReport } from '@/lib/projectPackage';
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '@/lib/accentColor';

function AccentPicker({ pt }: { pt: boolean }) {
  const color = useUIStore((s) => s.accentColor);
  const setColor = useUIStore((s) => s.setAccentColor);
  return <div className="settings-row settings-accent-row"><div><strong>{pt ? 'Cor de acento' : 'Accent color'}</strong><p>{pt ? 'Seleções, foco e ações principais. Suas mídias mantêm as cores originais.' : 'Selections, focus and primary actions. Your media keeps its original colors.'}</p></div>
    <div className="settings-accent-controls"><div className="accent-swatches" role="group" aria-label={pt ? 'Cores de acento' : 'Accent colors'}>{ACCENT_PRESETS.map((preset) => <button type="button" key={preset.color} style={{ backgroundColor: preset.color }} aria-label={pt ? preset.pt : preset.en} title={pt ? preset.pt : preset.en} aria-pressed={color === preset.color} onClick={() => setColor(preset.color)}><span aria-hidden="true">{color === preset.color ? '✓' : ''}</span></button>)}</div>
      <div className="accent-custom"><label><span>{pt ? 'Personalizada' : 'Custom'}</span><input type="color" aria-label={pt ? 'Cor de acento personalizada' : 'Custom accent color'} value={color} onInput={(event) => setColor(event.currentTarget.value)} onChange={(event) => setColor(event.target.value)} /></label><code>{color.toUpperCase()}</code><button type="button" className="settings-auto" onClick={() => setColor(DEFAULT_ACCENT)}>{pt ? 'Restaurar azul' : 'Reset to blue'}</button></div>
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
  const label = `${pt ? (axis === 'width' ? 'Largura' : 'Altura') : (axis === 'width' ? 'Width' : 'Height')} — ${panelName(panel, pt)}`;
  const commit = () => {
    focused.current = false;
    if (discard.current) { discard.current = false; return; }
    const parsed = automatic && (!draft.trim() || draft.toLowerCase() === 'auto') ? 0 : parseNumericExpression(draft, 'px');
    if (parsed === null) { setInvalid(true); return; }
    useUIStore.getState().setPanelDimension(panel, axis, parsed);
    setDraft(String(useUIStore.getState().panels[panel][axis] || 'Auto')); setInvalid(false);
  };
  return <div className="settings-dimension"><div className="settings-dimension-input"><input aria-label={label} aria-invalid={invalid} type="text" inputMode="decimal" value={draft} title={`${min}–${max}px. ${pt ? 'Aceita cálculos, como 300+20.' : 'Accepts calculations, such as 300+20.'}`} onFocus={() => { focused.current = true; }} onChange={(event) => { setDraft(event.target.value); setInvalid(false); }} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); discard.current = true; focused.current = false; setDraft(String(value || 'Auto')); setInvalid(false); event.currentTarget.blur(); } }} /><span>px</span></div>{automatic && <button type="button" className="settings-auto" aria-label={`${pt ? 'Automático' : 'Automatic'} — ${label}`} onClick={() => { useUIStore.getState().setPanelDimension(panel, axis, 0); setDraft('Auto'); setInvalid(false); }}>Auto</button>}{invalid && <small role="alert">{pt ? 'Valor inválido' : 'Invalid value'}</small>}</div>;
}

export default function SettingsDialog() {
  const { locale } = useI18n(); const pt = locale === 'pt';
  const theme = useUIStore((s) => s.theme); const grid = useUIStore((s) => s.showStageGrid);
  const leftHidden = useUIStore((s) => s.leftCollapsed); const rightHidden = useUIStore((s) => s.rightCollapsed);
  const preferencesError = useUIStore((s) => s.preferencesError);
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState('interface');
  const [quality, setQuality] = useState<PreviewQuality>('high');
  const [message, setMessage] = useState('');
  const [storage, setStorage] = useState('');
  const [diagnostics, setDiagnostics] = useState<{ version: string; ffmpeg: string } | null>(null);
  const close = () => useUIStore.getState().setSettingsOpen(false);
  useEffect(() => {
    const element = dialog.current; const prior = document.activeElement as HTMLElement | null;
    element?.showModal();
    const sync = () => setQuality(getPreviewQuality()); sync();
    window.addEventListener('motion-preview-quality', sync);
    const controller = new AbortController();
    fetch('/api/diagnostics', { signal: controller.signal }).then((r) => r.json()).then(setDiagnostics).catch(() => {});
    return () => { controller.abort(); window.removeEventListener('motion-preview-quality', sync); element?.close(); prior?.focus(); };
  }, []);
  useEffect(() => {
    if (tab !== 'files') return; let active = true;
    storageReport().then((report) => { if (active) setStorage(`${(report.total / 1048576).toFixed(1)} MB · ${report.count} ${pt ? 'arquivos de mídia locais' : 'local media files'}`); }).catch(() => { if (active) setStorage(pt ? 'Armazenamento indisponível.' : 'Storage unavailable.'); });
    return () => { active = false; };
  }, [tab, pt]);
  const openFolder = async (folder: 'exports' | 'projects') => {
    try { const response = await fetch('/api/diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) }); if (!response.ok) throw new Error(); setMessage(pt ? 'Pasta aberta no Finder.' : 'Folder opened in Finder.'); } catch { setMessage(pt ? 'Não foi possível abrir a pasta.' : 'Could not open the folder.'); }
  };
  const tabs = pt ? [['interface', 'Interface'], ['panels', 'Painéis'], ['preview', 'Prévia'], ['files', 'Arquivos'], ['shortcuts', 'Atalhos']] : [['interface', 'Interface'], ['panels', 'Panels'], ['preview', 'Preview'], ['files', 'Files'], ['shortcuts', 'Shortcuts']];
  return <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="settings-surface"><header className="settings-header"><div><span className="eyebrow">RP MotionStudio</span><h2 id="settings-title">{pt ? 'Configurações' : 'Settings'}</h2></div><button className="settings-close" aria-label={pt ? 'Fechar configurações' : 'Close settings'} onClick={close} autoFocus>×</button></header>
      <nav className="settings-tabs" role="tablist" aria-label={pt ? 'Seções de configurações' : 'Settings sections'} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const index = tabs.findIndex(([id]) => id === tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        setTab(tabs[next][0]); setMessage(''); document.getElementById(`settings-tab-${tabs[next][0]}`)?.focus();
      }}>{tabs.map(([id, label]) => <button role="tab" tabIndex={tab === id ? 0 : -1} id={`settings-tab-${id}`} aria-controls="settings-content" aria-selected={tab === id} key={id} onClick={() => { setTab(id); setMessage(''); }}>{label}</button>)}</nav>
      <div className="settings-body" role="tabpanel" id="settings-content" aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'interface' && <><h3>{pt ? 'Seu espaço de trabalho' : 'Your workspace'}</h3><p className="settings-description">{pt ? 'Preferências desta instalação. Seus projetos não são alterados.' : 'Preferences for this installation. Your projects stay unchanged.'}</p>
          <div className="settings-row"><div><strong>{pt ? 'Aparência' : 'Appearance'}</strong><p>{pt ? 'Escolha o contraste da interface.' : 'Choose the interface appearance.'}</p></div><div className="settings-segment">{(['dark', 'light'] as const).map((value) => <button key={value} aria-pressed={theme === value} onClick={() => useUIStore.getState().setTheme(value)}>{value === 'dark' ? (pt ? 'Escuro' : 'Dark') : (pt ? 'Claro' : 'Light')}</button>)}</div></div>
          <AccentPicker pt={pt} />
          <label className="settings-row"><span><strong>{pt ? 'Idioma' : 'Language'}</strong><span className="settings-description">{pt ? 'Troca imediata, sem reiniciar.' : 'Changes immediately, no restart needed.'}</span></span><select className="field" aria-label={pt ? 'Idioma da interface' : 'Interface language'} value={locale} onChange={(event) => useUIStore.getState().setLocale(event.target.value === 'pt' ? 'pt' : 'en')}><option value="pt">Português</option><option value="en">English</option></select></label>
          <label className="settings-row"><span><strong>{pt ? 'Grade de fundo' : 'Background grid'}</strong><span className="settings-description">{pt ? 'Pontos ao redor da composição. Não aparecem na exportação.' : 'Dots around the canvas. Not included in exports.'}</span></span><input type="checkbox" checked={grid} onChange={(event) => useUIStore.getState().setShowStageGrid(event.target.checked)} /></label>
        </>}
        {tab === 'panels' && <><h3>{pt ? 'Dimensões dos painéis' : 'Panel dimensions'}</h3><p className="settings-description">{pt ? 'Arraste as bordas dos painéis ou digite medidas e cálculos abaixo. Auto acompanha o espaço disponível. Em janelas menores, as medidas se ajustam para preservar a composição.' : 'Drag panel edges or enter dimensions and calculations below. Auto follows available space. Smaller windows adapt to keep the canvas visible.'}</p>
          <div className="settings-size-grid"><div className="settings-size-heading"><span>{pt ? 'Painel' : 'Panel'}</span><span>{pt ? 'Largura' : 'Width'}</span><span>{pt ? 'Altura' : 'Height'}</span><span /></div>
            {(Object.keys(DEFAULT_PANELS) as PanelId[]).map((panel) => <div className="settings-size-row" key={panel}><strong>{panelName(panel, pt)}</strong><DimensionField panel={panel} axis="width" pt={pt} /><DimensionField panel={panel} axis="height" pt={pt} /><button className="settings-reset-one" aria-label={`${pt ? 'Restaurar' : 'Reset'} — ${panelName(panel, pt)}`} onClick={() => { const store = useUIStore.getState(); store.setPanelDimension(panel, 'width', DEFAULT_PANELS[panel].width); store.setPanelDimension(panel, 'height', 0); }}>↺</button></div>)}
          </div>
          <div className="settings-visibility"><label><input type="checkbox" checked={!leftHidden} onChange={() => useUIStore.getState().toggleLeftPanel()} /> {pt ? 'Mostrar biblioteca' : 'Show library'}</label><label><input type="checkbox" checked={!rightHidden} onChange={() => useUIStore.getState().toggleRightPanel()} /> {pt ? 'Mostrar inspetor' : 'Show inspector'}</label></div>
          <p className="settings-description">{pt ? 'Alças: setas ajustam 10px; Shift + seta ajusta 1px. Duplo clique ou Home restaura a dimensão.' : 'Handles: arrows adjust 10px; Shift + arrow adjusts 1px. Double-click or Home resets a dimension.'}</p>
          <button className="btn" onClick={() => { useUIStore.getState().resetPanelLayout(); setMessage(pt ? 'Layout original restaurado. Projetos preservados.' : 'Default layout restored. Projects preserved.'); }}>{pt ? 'Restaurar layout original' : 'Restore default layout'}</button>
        </>}
        {tab === 'preview' && <><h3>{pt ? 'Qualidade e desempenho' : 'Quality and performance'}</h3><p className="settings-description">{pt ? 'A qualidade abaixo afeta somente a visualização. O vídeo usa a resolução escolhida ao exportar.' : 'This quality affects preview only. Video uses the resolution selected when exporting.'}</p><label className="settings-row"><strong>{pt ? 'Qualidade da prévia' : 'Preview quality'}</strong><select className="field" value={quality} onChange={(event) => { try { setPreviewQuality(event.target.value as PreviewQuality); setMessage(pt ? 'Qualidade aplicada.' : 'Quality applied.'); } catch { setMessage(pt ? 'Não foi possível salvar a qualidade.' : 'Could not save the quality.'); } }}><option value="fast">{pt ? 'Rápida · menor uso de GPU' : 'Fast · lower GPU usage'}</option><option value="balanced">{pt ? 'Equilibrada' : 'Balanced'}</option><option value="high">{pt ? 'Alta · maior nitidez' : 'High · sharper preview'}</option></select></label><p className="settings-description">{pt ? 'Pausar a reprodução reduz o trabalho da prévia. Projetos com muitos vídeos e modelos 3D exigem mais memória.' : 'Pausing playback reduces preview work. Many videos and 3D models use more memory.'}</p></>}
        {tab === 'files' && <><h3>{pt ? 'Arquivos neste Mac' : 'Files on this Mac'}</h3><p className="settings-description">{storage || (pt ? 'Verificando armazenamento…' : 'Checking storage…')}</p><div className="settings-folder"><strong>{pt ? 'Vídeos exportados' : 'Exported videos'}</strong><code>Movies / Motion Studio Exports</code><button className="btn" onClick={() => void openFolder('exports')}>{pt ? 'Abrir pasta de exportações' : 'Open exports folder'}</button></div><div className="settings-folder"><strong>{pt ? 'Pacotes de projeto' : 'Project packages'}</strong><code>Documents / Motion Studio Projects</code><button className="btn" onClick={() => void openFolder('projects')}>{pt ? 'Abrir pasta de projetos' : 'Open projects folder'}</button></div><p className="settings-description">{pt ? 'Projetos em edição são salvos nos dados locais do aplicativo. Use Salvar pacote portátil em Projetos para manter uma cópia com suas mídias.' : 'Working projects are saved in local application data. Use Save portable package in Projects to keep a copy including media.'}</p><p className="settings-description">{pt ? 'Exportação local' : 'Local export'}: {diagnostics?.ffmpeg ?? '…'}</p></>}
        {tab === 'shortcuts' && <><h3>{pt ? 'Atalhos do editor' : 'Editor shortcuts'}</h3><dl className="settings-shortcuts">{[[pt ? 'Configurações' : 'Settings', '⌘ / Ctrl + ,'], [pt ? 'Reproduzir / pausar' : 'Play / pause', 'Espaço / K'], [pt ? 'Quadro anterior / seguinte' : 'Previous / next frame', '← / → · J / L'], [pt ? 'Saltar um segundo' : 'Jump one second', 'Shift + ← / →'], [pt ? 'Desfazer' : 'Undo', '⌘ / Ctrl + Z'], [pt ? 'Refazer' : 'Redo', '⌘ / Ctrl + Shift + Z'], [pt ? 'Fechar configurações' : 'Close settings', 'Esc']].map(([name, shortcut]) => <div key={name}><dt>{name}</dt><dd><kbd>{shortcut}</kbd></dd></div>)}</dl><p className="settings-description">{pt ? 'Os atalhos da composição ficam suspensos enquanto você digita ou usa este menu.' : 'Composition shortcuts are suspended while typing or using this menu.'}</p></>}
      </div>
      <footer className="settings-footer"><span role="status">{preferencesError ? (pt ? 'Não foi possível salvar as preferências neste dispositivo.' : 'Could not save preferences on this device.') : message || (pt ? 'Alterações salvas automaticamente neste Mac.' : 'Changes saved automatically on this Mac.')}</span><small>RP MotionStudio · {diagnostics?.version ?? '…'}</small></footer>
    </div>
  </dialog>;
}
