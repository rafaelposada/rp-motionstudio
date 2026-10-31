'use client';

import { useEffect, useState } from 'react';
import { useSceneStore, ASPECTS } from '@/store/useSceneStore';
import { ControlRow } from './Controls';
import { useI18n } from '@/lib/useI18n';
import InfoHint, { InfoLabel } from './InfoHint';
import { uiHelp } from '@/lib/controlHelp';
import { idbPut } from '@/lib/assetDb';

const FPS_OPTIONS = [15, 25, 30, 60] as const;
const BG_SOURCES = ['color', 'image', 'card'] as const;

// Pixel input that commits on blur/Enter so half-typed values don't
// resize the canvas mid-keystroke.
export function DimInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n > 0) onCommit(n);
    else setText(String(value));
  };
  return (
    <input
      className="field dim-field"
      type="number"
      min={16}
      max={8192}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

function Collapsible({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="collapsible">
      <div className={`collapsible-head ${open ? 'open' : ''}`}>
        <button className="collapsible-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="c-label">{title}</span>
          <span className="chev">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2L7 5l-3.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        </button>
        <span className="collapsible-info"><InfoHint text={help} name={title} /></span>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

// 3D mode has its own background controls. Composition media and audio are
// managed in the shared layers panel.
export default function CanvasPanel({ is3DMode = false }: { is3DMode?: boolean } = {}) {
  const { locale, t } = useI18n();
  const aspect = useSceneStore((s) => s.aspect);
  const setAspect = useSceneStore((s) => s.setAspect);
  const customW = useSceneStore((s) => s.customW);
  const customH = useSceneStore((s) => s.customH);
  const setCustomDims = useSceneStore((s) => s.setCustomDims);
  const fps = useSceneStore((s) => s.fps);
  const setFps = useSceneStore((s) => s.setFps);
  const safeArea = useSceneStore((s) => s.safeArea);
  const toggleSafeArea = useSceneStore((s) => s.toggleSafeArea);
  const background = useSceneStore((s) => s.background);
  const setBackground = useSceneStore((s) => s.setBackground);
  const setLogo = useSceneStore((s) => s.setLogo);
  const [mediaStatus, setMediaStatus] = useState('');
  const persistAux = async (file: File, kind: 'logo' | 'background' | 'audio') => {
    setMediaStatus(locale === 'pt' ? 'Salvando arquivo…' : 'Saving file…');
    try {
      const blobId = `aux_${crypto.randomUUID()}`;
      await idbPut(blobId, file);
      const url = URL.createObjectURL(file);
      if (kind === 'logo') setLogo({ url, blobId });
      else if (kind === 'background') setBackground({ imageUrl: url, blobId });
      else useSceneStore.setState({ audioUrl: url, audioBlobId: blobId });
      setMediaStatus(locale === 'pt' ? 'Arquivo salvo no projeto.' : 'File saved in project.');
    } catch { setMediaStatus(locale === 'pt' ? 'Não foi possível salvar. Verifique o espaço disponível.' : 'Unable to save. Check available storage.'); }
  };
  const [previewQuality, setPreviewQuality] = useState('high');
  useEffect(() => { const sync = () => setPreviewQuality(localStorage.getItem('motion-preview-quality') ?? 'high'); sync(); window.addEventListener('motion-preview-quality', sync); return () => window.removeEventListener('motion-preview-quality', sync); }, []);

  return (
    <>
      <div className="section-head"><span className="eyebrow">{t('canvas')}</span></div>
      <div className="section-body">
        {mediaStatus && <p className="ctl-hint" role="status">{mediaStatus}</p>}
        <label className="text-edit-label">{locale === 'pt' ? 'Qualidade da prévia' : 'Preview quality'}
          <select className="field" value={previewQuality} onChange={(e) => {
            setPreviewQuality(e.target.value);
            localStorage.setItem('motion-preview-quality', e.target.value);
            window.dispatchEvent(new Event('motion-preview-quality'));
          }}>
            <option value="fast">{locale === 'pt' ? 'Rápida' : 'Fast'}</option>
            <option value="balanced">{locale === 'pt' ? 'Equilibrada' : 'Balanced'}</option>
            <option value="high">{locale === 'pt' ? 'Alta qualidade' : 'High quality'}</option>
          </select>
        </label>
        <p className="ctl-hint">{locale === 'pt' ? 'A exportação mantém a resolução escolhida, independentemente da qualidade da prévia.' : 'Export uses its chosen resolution regardless of preview quality.'}</p>
        <div className="ctl-row">
          <InfoLabel help={uiHelp('aspect', locale)} name={t('aspect')}>{t('aspect')}</InfoLabel>
          <div className="pills aspect-pills">
            {Object.keys(ASPECTS).map((a) => (
              <button key={a} className={`pill ${aspect === a ? 'active' : ''}`} onClick={() => setAspect(a)}>{a}</button>
            ))}
            <button className={`pill ${aspect === 'custom' ? 'active' : ''}`} onClick={() => setCustomDims(customW, customH)}>W×H</button>
          </div>
        </div>

        {aspect === 'custom' && (
          <>
            <div className="ctl-row">
              <InfoLabel help={uiHelp('size', locale)} name={t('sizePx')}>{t('sizePx')}</InfoLabel>
              <div className="dim-inputs">
                <DimInput value={customW} onCommit={(v) => setCustomDims(v, customH)} />
                <span className="dim-x">×</span>
                <DimInput value={customH} onCommit={(v) => setCustomDims(customW, v)} />
              </div>
            </div>
            <div className="ctl-hint">{t('previewExact')}</div>
          </>
        )}

        <div className="ctl-row">
          <InfoLabel help={uiHelp('fps', locale)} name="FPS">FPS</InfoLabel>
          <div className="pills pills-fit">
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                className={`pill ${fps === f ? 'active' : ''}`}
                aria-pressed={fps === f}
                onClick={() => setFps(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {!is3DMode && (
          <div className="ctl-row">
            <InfoLabel help={uiHelp('safeArea', locale)} name={t('safeArea')}>{t('safeArea')}</InfoLabel>
            <div className="segmented">
              <button className={`seg ${!safeArea ? 'active' : ''}`} onClick={() => safeArea && toggleSafeArea()}>{t('off')}</button>
              <button className={`seg ${safeArea ? 'active' : ''}`} onClick={() => !safeArea && toggleSafeArea()}>{t('on')}</button>
            </div>
          </div>
        )}
      </div>

      {!is3DMode && (
      <>
      <div className="hairline" />
      <div className="section-body" style={{ paddingTop: 4 }}>
        <Collapsible title={t('background')} help={uiHelp('background', locale)}>
          <div className="ctl-row">
            <InfoLabel help={uiHelp('backgroundSource', locale)} name={t('source')}>{t('source')}</InfoLabel>
            <div className="pills">
              {BG_SOURCES.map((source) => (
                <button key={source} className={`pill ${background.source === source ? 'active' : ''}`} onClick={() => setBackground({ source })}>{t(source === 'card' ? 'fromCard' : source)}</button>
              ))}
            </div>
          </div>

          {background.source === 'color' && (
            <>
              <ControlRow def={{ key: 'bgc', label: t('colour'), type: 'color', default: '' }} value={background.color} onChange={(v) => setBackground({ color: v })} />
              <div className="ctl-row">
                <InfoLabel help={uiHelp('gradient', locale)} name={t('gradient')}>{t('gradient')}</InfoLabel>
                <div className="segmented">
                  <button className={`seg ${!background.gradient ? 'active' : ''}`} onClick={() => setBackground({ gradient: false })}>{t('off')}</button>
                  <button className={`seg ${background.gradient ? 'active' : ''}`} onClick={() => setBackground({ gradient: true })}>{t('on')}</button>
                </div>
              </div>
              {background.gradient && (
                <ControlRow def={{ key: 'bgc2', label: 'Colour 2', type: 'color', default: '' }} value={background.color2} onChange={(v) => setBackground({ color2: v })} />
              )}
            </>
          )}

          {background.source === 'image' && (
            <>
              <div className="ctl-row">
                <InfoLabel help={uiHelp('backgroundImage', locale)} name={t('image')}>{t('image')}</InfoLabel>
                <label className="upload">
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void persistAux(f, 'background'); }} />
                  <span>{background.imageUrl ? t('replace') : t('upload')}</span>
                </label>
              </div>
              <ControlRow def={{ key: 'bgblur', label: t('blur'), type: 'slider', min: 0, max: 100, step: 1, default: 28 }} value={background.blur} onChange={(v) => setBackground({ blur: Number(v) })} />
            </>
          )}

          {background.source === 'card' && (
            <>
              <div className="ctl-hint">{t('cardBackgroundHint')}</div>
              <ControlRow def={{ key: 'bgblur', label: t('blur'), type: 'slider', min: 0, max: 100, step: 1, default: 28 }} value={background.blur} onChange={(v) => setBackground({ blur: Number(v) })} />
            </>
          )}
        </Collapsible>

      </div>
      </>
      )}
    </>
  );
}
