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
import { magnetOffset, snapTargets } from '@/lib/timelineSnap';

function fmt(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}

// Figma ruler: a label every 2s, three short dashes between labels.
// Zoomed in, labels get closer: 2s, 1s, 0.5s… down to a tenth of a second.
function buildRuler(duration: number, zoom = 1) {
  const labels: { t: number; pct: number }[] = [];
  const dashes: number[] = [];
  const step = [2, 1, .5, .25, .1].find((value) => value * zoom <= 2.2) ?? .1;
  for (let i = 0, t = 0; t <= duration + 1e-9; i++, t = Math.round(i * step * 1000) / 1000) {
    labels.push({ t, pct: (t / duration) * 100 });
    if (t + step <= duration + 1e-9) {
      const w = (step / duration) * 100;
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
  const zoomView = useUIStore((state) => state.timelineZoom);
  useSceneStore((state) => state.markers);
  const setLanesOpen = useUIStore((state) => state.setTimelineExpanded);

  const shellRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

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
      if (e.key.toLowerCase() === 'm') { e.preventDefault(); if (!s.markers.some((m) => Math.abs(m.t - s.frame / s.fps) < 1 / s.fps)) s.setMarkers([...s.markers, { t: Math.round(s.frame / s.fps * 100) / 100 }]); return; }
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
  const addMarker = () => { const st = useSceneStore.getState(); if (st.markers.some((m) => Math.abs(m.t - st.frame / st.fps) < 1 / st.fps)) return; st.setMarkers([...st.markers, { t: Math.round(st.frame / st.fps * 100) / 100 }]); };
  // Alt/⌘ + wheel zooms around the pointer; Shift + wheel (or a sideways swipe) pans when zoomed.
  const onTimelineWheel = (e: React.WheelEvent) => {
    const scrubber = scrubberRef.current; if (!scrubber) return;
    const view = useUIStore.getState().timelineZoom, r = scrubber.getBoundingClientRect();
    if (e.altKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const anchor = view.start + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) / view.zoom;
      useUIStore.getState().setTimelineZoom(view.zoom * (e.deltaY < 0 ? 1.25 : .8), anchor);
    } else if (view.zoom > 1 && (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) {
      useUIStore.getState().panTimeline((e.shiftKey ? e.deltaY : e.deltaX) / r.width / view.zoom);
    }
  };
  const startMarkerDrag = (index: number, e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    const st = useSceneStore.getState();
    if (e.altKey) { st.setMarkers(st.markers.filter((_, i) => i !== index)); return; }
    const scrubber = scrubberRef.current!, view = useUIStore.getState().timelineZoom, startX = e.clientX, original = st.markers[index].t;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const r = scrubber.getBoundingClientRect(), delta = (ev.clientX - startX) / r.width / view.zoom * st.duration;
      if (Math.abs(ev.clientX - startX) > 2) moved = true;
      const t = Math.round(Math.max(0, Math.min(st.duration, original + delta)) * st.fps) / st.fps;
      useSceneStore.getState().setMarkers(useSceneStore.getState().markers.map((m, i) => i === index ? { ...m, t } : m));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (!moved) { st.setPlaying(false); st.setFrame(Math.round(original * st.fps)); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const curTime = frame / fps;
  const progress = (frame / (totalFrames - 1 || 1)) * 100;
  const { labels, dashes } = buildRuler(duration, zoomView.zoom);
  const viewPct = (fraction: number) => (fraction - zoomView.start) * zoomView.zoom;
  const markers = useSceneStore.getState().markers;

  return (
    <div className={`timeline-shell ${lanesOpen ? 'lanes-open' : ''}`} ref={shellRef} style={{ ['--tl-zoom' as string]: zoomView.zoom, ['--tl-view' as string]: zoomView.start }} onWheel={onTimelineWheel}>
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
        <div className="tl-zoom tl-scrub-zoom">
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
          onPointerDown={(e) => { scrubbing.current = !e.altKey; }} onPointerUp={() => { scrubbing.current = false; }}
          onChange={(e) => {
            setPlaying(false);
            let next = Number(e.target.value);
            // While dragging, the playhead clicks onto nearby markers.
            const zoomWidth = scrubberRef.current?.querySelector('.tl-scrub-zoom')?.getBoundingClientRect().width ?? 0;
            if (scrubbing.current && zoomWidth > 0) next = Math.max(0, Math.min(totalFrames - 1, next + Math.round(magnetOffset([next / fps], duration / zoomWidth, snapTargets(false)) * fps)));
            setFrame(next);
          }}
        />
        {markers.map((marker, index) => <button key={`${marker.t}-${index}`} type="button" className="tl-marker" style={{ left: `${marker.t / duration * 100}%` }}
          title={`${marker.label ? `${marker.label} · ` : ''}${marker.t.toFixed(2)}s · ${tx(locale === 'pt', 'Clique leva a agulha até aqui; arraste para mover; Alt + clique remove', 'Click moves the playhead here; drag to move; Alt-click removes')}`}
          aria-label={`${tx(locale === 'pt', 'Marcador em', 'Marker at')} ${marker.t.toFixed(2)}s`}
          onPointerDown={(e) => startMarkerDrag(index, e)} />)}
        </div>
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
      <div className="tl-zoom-controls" role="group" aria-label={tx(locale === 'pt', 'Zoom da linha do tempo', 'Timeline zoom')}>
        <button type="button" disabled={zoomView.zoom <= 1} title={tx(locale === 'pt', 'Afastar a linha do tempo · Alt + roda', 'Zoom timeline out · Alt + wheel')} aria-label={tx(locale === 'pt', 'Afastar a linha do tempo', 'Zoom timeline out')} onClick={() => useUIStore.getState().setTimelineZoom(zoomView.zoom / 2, progress / 100)}>−</button>
        <button type="button" className="tl-zoom-value" title={tx(locale === 'pt', 'Ajustar a linha do tempo inteira', 'Fit the whole timeline')} onClick={() => useUIStore.getState().setTimelineZoom(1)}>{zoomView.zoom === 1 ? tx(locale === 'pt', 'Tudo', 'Fit') : `${zoomView.zoom}×`}</button>
        <button type="button" disabled={zoomView.zoom >= 32} title={tx(locale === 'pt', 'Aproximar a linha do tempo · Alt + roda', 'Zoom timeline in · Alt + wheel')} aria-label={tx(locale === 'pt', 'Aproximar a linha do tempo', 'Zoom timeline in')} onClick={() => useUIStore.getState().setTimelineZoom(zoomView.zoom * 2, progress / 100)}>+</button>
        <button type="button" title={tx(locale === 'pt', 'Adicionar marcador · M. Marque um momento (uma batida da música, uma troca de cena) e as barras das camadas e a agulha encaixam nele ao arrastar.', 'Add marker · M. Mark a moment (a beat in the music, a scene change); layer bars and the playhead snap to it while dragging.')} aria-label={tx(locale === 'pt', 'Adicionar marcador', 'Add marker')} onClick={addMarker}><svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true"><path d="M1.5 1h8v6l-4 4-4-4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg></button>
      </div>

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
        {/* The stack grows with its lanes, so the playhead and markers span
            every layer even when the list scrolls. */}
        <div className="tl-lanes-stack">
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
        {viewPct(progress / 100) >= 0 && viewPct(progress / 100) <= 1 && <div className="tl-lanes-playhead" style={{ left: `calc(var(--tl-axis-left) + var(--tl-axis-w) * ${viewPct(progress / 100)})` }} />}
        {markers.map((marker, index) => { const v = viewPct(marker.t / duration); return v >= 0 && v <= 1 ? <div key={`m${index}`} className="tl-lanes-marker" style={{ left: `calc(var(--tl-axis-left) + var(--tl-axis-w) * ${v})` }} /> : null; })}
        </div>

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
