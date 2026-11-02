// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import ExportDialog from './ExportDialog';
import TrackLane from './TrackLane';
import SaveStatus from './SaveStatus';
import TextTrackLane from './TextTrackLane';
import AudioTrackLane from './AudioTrackLane';
import { ExportIcon, PauseIcon, PlayIcon } from './EditorIcons';
import { useI18n } from '@/lib/useI18n';
import { useUIStore } from '@/store/useUIStore';
import { compositionOrder } from '@/lib/composition';
import LayerDropTarget from './LayerDropTarget';
import {numericKeyValue} from '@/lib/numericKeyboard';
import { tx } from '@/lib/tx';

function fmt(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}

// Figma ruler: a label every 2s, three short dashes between labels.
function buildRuler(duration: number) {
  const labels: { t: number; pct: number }[] = [];
  const dashes: number[] = [];
  for (let t = 0; t <= duration; t += 2) {
    labels.push({ t, pct: (t / duration) * 100 });
    if (t + 2 <= duration) {
      const w = (2 / duration) * 100;
      for (let k = 1; k <= 3; k++) dashes.push(((t / duration) * 100) + (w * k) / 4);
    }
  }
  return { labels, dashes };
}

// `extra` fills the slot the export button occupies in 2D/3D — web mode puts
// its source controls there rather than spending a sidebar column on them.
export default function Timeline({
  showExport = true,
  extra,
}: {
  showExport?: boolean;
  extra?: React.ReactNode;
}) {
  const { locale, t } = useI18n();
  const compositeMode = useSceneStore((s) => s.compositeMode);
  const setCompositeMode = useSceneStore((s) => s.setCompositeMode);
  const frame = useSceneStore((s) => s.frame);
  const fps = useSceneStore((s) => s.fps);
  const duration = useSceneStore((s) => s.duration);
  const playing = useSceneStore((s) => s.playing);
  const setPlaying = useSceneStore((s) => s.setPlaying);
  const setFrame = useSceneStore((s) => s.setFrame);
  const setDuration = useSceneStore((s) => s.setDuration);
  const tracks = useSceneStore((s) => s.tracks);
  const textLayers = useSceneStore((s) => s.textLayers), audioUrl = useSceneStore((s) => s.audioUrl);
  const addTrack = useSceneStore((s) => s.addTrack);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const lanesOpen = useUIStore((state) => state.timelineExpanded);
  const setLanesOpen = useUIStore((state) => state.setTimelineExpanded);

  const shellRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  // Publish the scrubber's geometry as CSS vars on the shell, so the lane bars
  // below sit in the SAME coordinate space as the ruler above. The transport row
  // is a flex layout whose left offset depends on the time readout and the
  // buttons in `extra`, so measuring beats hardcoding: the playhead and the bars
  // stay aligned whatever lands in that row.
  useEffect(() => {
    const shell = shellRef.current;
    const scrubber = scrubberRef.current;
    if (!shell || !scrubber) return;
    // Only the SCRUBBER is observed, never the shell: these vars drive the lane
    // gutter width, so observing the shell we write to would feed its own layout
    // change back in as a resize — the classic ResizeObserver loop. Writes are
    // also skipped when the value is unchanged, so a nudge can't oscillate.
    const sync = () => {
      const a = shell.getBoundingClientRect();
      const b = scrubber.getBoundingClientRect();
      const left = `${Math.round(b.left - a.left)}px`;
      const width = `${Math.round(b.width)}px`;
      if (shell.style.getPropertyValue('--tl-axis-left') !== left) {
        shell.style.setProperty('--tl-axis-left', left);
      }
      if (shell.style.getPropertyValue('--tl-axis-w') !== width) {
        shell.style.setProperty('--tl-axis-w', width);
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(scrubber);
    return () => ro.disconnect();
  }, [lanesOpen]);

  // Spacebar toggles play/pause anywhere except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (e.code === 'Space' && t?.closest('button')) return;
      if (t?.closest('dialog[open]') || t?.getAttribute('role') === 'separator') return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const s = useSceneStore.getState();
      if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
        e.preventDefault(); s.setPlaying(!s.playing);
      } else if (['ArrowLeft', 'ArrowRight', 'j', 'l'].includes(e.key.toLowerCase()) || ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); s.setPlaying(false);
        const direction = e.key === 'ArrowLeft' || e.key.toLowerCase() === 'j' ? -1 : 1;
        s.setFrame(Math.max(0, Math.min(Math.round(s.duration * s.fps) - 1, s.frame + direction * (e.shiftKey ? s.fps : 1))));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const curTime = frame / fps;
  const progress = (frame / (totalFrames - 1 || 1)) * 100;
  const { labels, dashes } = buildRuler(duration);

  return (
    <div className={`timeline-shell ${lanesOpen ? 'lanes-open' : ''}`} ref={shellRef}>
    <div className="timeline">
      <button className="play-btn" onClick={() => setPlaying(!playing)} title={playing ? t('pause') : t('play')} aria-label={playing ? t('pause') : t('play')}>
        {playing ? (
          <PauseIcon size={14} />
        ) : (
          <PlayIcon size={14} />
        )}
      </button>

      <span className="time-readout"><b>{fmt(curTime)}</b> / {fmt(duration)}s</span>
      <SaveStatus />

      <div className="scrubber" ref={scrubberRef}>
        <div className="tl-trackbar" />
        <div className="ruler">
          {dashes.map((pct, i) => (
            <span key={`d${i}`} className="ruler-dash" style={{ left: `${pct}%`, width: 8 }} />
          ))}
          {labels.map(({ t, pct }) => (
            <span key={`l${t}`} className="ruler-label" style={{ left: `${pct}%` }}>{t}s</span>
          ))}
        </div>
        <div className="playhead" style={{ left: `${progress}%` }}>
          <span className="playhead-chip">{curTime.toFixed(1)}s</span>
        </div>
        <input
          type="range" min={0} max={totalFrames - 1} step={1} value={frame}
          onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
        />
      </div>

      <span className="tl-divider" />

      <label className="dur-field">
        <input type="number" min={1} max={60} step={.01} value={duration} onChange={(e) => setDuration(Math.max(1,Math.min(60,Number(e.target.value))))} onKeyDown={e=>{const next=numericKeyValue(e,duration,{min:1,max:60});if(next!==null){e.preventDefault();e.stopPropagation();setDuration(next);}}}/>
        <span>s</span>
      </label>

      {/* Motion layers: the stack of tracks sharing this one timeline. */}
      <button
        className={`tl-lanes-btn ${lanesOpen ? 'active' : ''}`}
        onClick={() => setLanesOpen(!lanesOpen)}
        aria-expanded={lanesOpen}
        title={t('motionLayers')}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.8l6 3-6 3-6-3 6-3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M2 8.2l6 3 6-3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
        {t('layers')}
        <span className="tl-lanes-count">{tracks.length + textLayers.length + (audioUrl ? 1 : 0)}</span>
      </button>

      {extra}

      {showExport && (
        <button className="export-btn" onClick={() => setShowExportDialog(true)}>
          <ExportIcon size={14} />
          {t('export')}
        </button>
      )}

      {showExport && showExportDialog && <ExportDialog onClose={() => setShowExportDialog(false)} />}
    </div>

    {lanesOpen && (
      <div className="tl-lanes">
        {/* Topmost lane = topmost layer, so the list reads like the stack looks:
            the store's array is bottom-to-top, the UI shows it reversed. */}
        {compositionOrder(tracks, textLayers).reverse().map((item, index) => {
          const layer = textLayers.find(l => l.id === item.id), track = tracks.find(t => t.id === item.id);
          const modeControl = index === 0 ? <label className="tl-composition-control" data-mode={compositeMode} onPointerDown={e=>e.stopPropagation()} title={tx(locale === 'pt', 'Único: exibe só o modelo ativo. Compor: sobrepõe todos os modelos visíveis. Textos e imagens absolutas continuam independentes.', 'Single: show only the active model. Stack: overlay all visible models. Text and absolute images remain independent.')}>
            <select aria-label={tx(locale === 'pt', 'Composição dos modelos', 'Model composition')} value={compositeMode} onChange={e=>setCompositeMode(e.target.value as 'single' | 'stack')}>
              <option value="single">{tx(locale === 'pt', 'Único', 'Single')}</option>
              <option value="stack">{tx(locale === 'pt', 'Compor', 'Stack')}</option>
            </select>
          </label> : undefined;
          return <LayerDropTarget key={item.id} id={item.id} name={layer?.text ?? track?.name ?? ''}>{layer ? <TextTrackLane layer={layer} duration={duration} leadingControl={modeControl} /> : track ? <TrackLane
            track={track}
            totalFrames={totalFrames}
            leadingControl={modeControl}
          /> : null}</LayerDropTarget>;
        })}

        {audioUrl && <AudioTrackLane duration={duration} />}

        {/* one playhead across every lane, in the shared axis space */}
        <div className="tl-lanes-playhead" style={{ left: `calc(var(--tl-axis-left) + var(--tl-axis-w) * ${progress / 100})` }} />

        <div className="tl-lanes-foot">
          <button className="tl-add-track" onClick={() => addTrack()}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            {t('addLayer')}
          </button>
          <span className="tl-lanes-hint">
            {t('timelineHint')}
          </span>
        </div>
      </div>
    )}
    </div>
  );
}
