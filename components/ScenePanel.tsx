// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { catalogTemplateList, getTemplate, defaultsFor } from '@/templates';
import { ControlRow, controlVisible } from './Controls';
import EasingPanel from './EasingPanel';
import TrackInspector from './TrackInspector';
import { useI18n } from '@/lib/useI18n';
import InfoHint from './InfoHint';
import { uiHelp } from '@/lib/controlHelp';
import MotionPathEditor from './MotionPathEditor';
import { layerDisplayName } from '@/lib/compositionActions';
import { tx } from '@/lib/tx';

// Renders the SCENE + TIMING sections (no card wrapper — the page composes cards).
export default function ScenePanel() {
  const { locale, t, label } = useI18n();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [copied, setCopied] = useState<Record<string, unknown> | null>(null);
  const activeTemplateId = useSceneStore((s) => s.activeTemplateId);
  const values = useSceneStore((s) => s.values);
  const setValue = useSceneStore((s) => s.setValue);
  const setActiveTemplate = useSceneStore((s) => s.setActiveTemplate);
  const duration = useSceneStore((s) => s.duration);
  const setDuration = useSceneStore((s) => s.setDuration);
  const trackCount = useSceneStore((s) => s.tracks.length);
  const activeTrackName = useSceneStore(
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.name ?? '',
  );

  const template = getTemplate(activeTemplateId);
  const visibleControls = template.controls.filter((def) => controlVisible(def, values) && `${label(def.label)} ${def.label}`.toLowerCase().includes(query.toLowerCase()));
  const primaryControls = visibleControls.filter((def) => !def.advanced);
  const advancedControls = visibleControls.filter((def) => def.advanced);
  const sections = ['Layout', 'Motion', 'Depth', 'Finish'] as const;
  const hasSections = primaryControls.some((def) => def.section);

  return (
    <>
      <div className="section-head">
        <span className="section-head-title">
          <span className="eyebrow">{t('scene')}</span>
          <InfoHint text={uiHelp('template', locale)} name={t('scene')} />
        </span>
        <select
          className="badge"
          value={activeTemplateId}
          onChange={(e) => setActiveTemplate(e.target.value)}
          style={{ paddingRight: 22 }}
        >
          {template.meta.catalogHidden && (
            <option value={template.meta.id}>{template.meta.name} ({t('hidden')})</option>
          )}
          {catalogTemplateList.map((t) => <option key={t.meta.id} value={t.meta.id}>{t.meta.name}</option>)}
        </select>
      </div>
      <div className="section-body">
        {template.meta.staticByDefault && <p className="ctl-hint">{tx(locale==='pt', 'Canvas 01 é uma base estática. Em Movimento, escolha Flutuar para animar a grade.', 'Canvas 01 is a static base. Choose Float under Motion to animate the grid.')}</p>}
        <label className="image-lighting-option"><input type="checkbox" checked={values._autoTransparency===true} onChange={e=>setValue('_autoTransparency',e.target.checked)}/><span>{tx(locale==='pt', 'Transparência de profundidade', 'Depth transparency')}<small>{tx(locale==='pt', 'Desligado remove a transparência usada para simular distância. Entradas/saídas, transparência do arquivo e opacidade manual continuam ativas.', 'Off removes transparency used to suggest distance. Entrance/exit fades, source alpha and manual opacity remain active.')}</small></span></label>
        {template.meta.engine === 'webgl' && <label className="image-lighting-option"><input type="checkbox" checked={values._imageLighting === true} onChange={(e)=>setValue('_imageLighting',e.target.checked)}/><span>{tx(locale==='pt', 'Iluminação e brilho nas imagens', 'Image lighting and highlights')}<small>{tx(locale==='pt', 'Desligado preserva as cores da mídia. A perspectiva e o movimento continuam ativos.', 'Off preserves media colors. Perspective and motion remain active.')}</small></span></label>}
        <input className="field" aria-label={tx(locale === 'pt', 'Buscar controles', 'Search controls')} placeholder={tx(locale === 'pt', 'Buscar controles…', 'Search controls…')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="inspector-actions"><button className="link-btn" onClick={() => setCopied(structuredClone(values))}>{tx(locale === 'pt', 'Copiar ajustes', 'Copy settings')}</button><button className="link-btn" disabled={!copied} onClick={() => { if (copied) for (const def of template.controls) { const value = copied[def.key]; if (value === undefined) continue; if (def.type === 'slider' && typeof value === 'number') setValue(def.key, Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, value))); else if (def.type === 'xypad' && value && typeof value === 'object' && 'x' in value && 'y' in value) setValue(def.key, value); else if (typeof value === typeof def.default && (!def.options || def.options.includes(String(value)))) setValue(def.key, value); } }}>{tx(locale === 'pt', 'Colar', 'Paste')}</button></div>
        {/* With more than one layer, make it explicit that these controls edit
            the SELECTED layer's motion, not the whole scene's. */}
        {trackCount > 1 && (
          <div className="ctl-hint">{t('editingMotion', { name: layerDisplayName(activeTrackName, locale === 'pt') })}</div>
        )}
        {sections.map((section) => {
          const controls = primaryControls.filter((def) => (def.section ?? 'Layout') === section);
          if (!controls.length) return null;
          return <div className="ctl-section" key={section}>
            <div className="ctl-section-title inspector-section-head"><button className="link-btn" aria-expanded={!closed.includes(section)} onClick={() => setClosed((list) => list.includes(section) ? list.filter((item) => item !== section) : [...list, section])}>{label(section)} {closed.includes(section) ? '+' : '−'}</button><button className="link-btn" onClick={() => { const defaults = defaultsFor(activeTemplateId); for (const def of controls) setValue(def.key, defaults[def.key]); }}>{tx(locale === 'pt', 'Redefinir', 'Reset')}</button></div>
            {!closed.includes(section) && controls.map((def) => <div className="inspector-control" key={def.key}><ControlRow def={def} value={values[def.key]} onChange={(val) => setValue(def.key, val)} /></div>)}
          </div>;
        })}
        {advancedControls.length > 0 && (
          <div className="ctl-advanced">
            <button
              type="button"
              className="ctl-advanced-toggle"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              {t('advanced')} <span>{advancedOpen ? '−' : '+'}</span>
            </button>
            {advancedOpen && advancedControls.map((def) => (
              <ControlRow key={def.key} def={def} value={values[def.key]} onChange={(val) => setValue(def.key, val)} />
            ))}
          </div>
        )}
      </div>

      <div className="hairline" />

      {/* layer compositing: opacity, blend, retiming, asset split. Only
          meaningful once a second layer exists. */}
      {trackCount > 0 && (
        <>
          <TrackInspector />
          <div className="hairline" />
        </>
      )}

      <div className="section-head"><span className="eyebrow">{t('timing')}</span></div>
      <div className="section-body">
        <ControlRow
          def={{ key: '_duration', label: t('duration'), type: 'slider', min: 1, max: Math.max(60, duration), step: 1, default: 8 }}
          value={duration}
          onChange={(v) => setDuration(Math.max(1, Number(v)))}
        />
      </div>

      <div className="hairline" />

      <EasingPanel />
      <MotionPathEditor key={activeTemplateId} />
    </>
  );
}
