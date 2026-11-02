// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import {setDesktopBusy} from '@/lib/desktop';

import { useEffect, useRef, useState } from 'react';
import { useSceneStore, ASPECTS } from '@/store/useSceneStore';
import { getRendererInstance } from '@/lib/rendererInstance';
import { BASE_PATH, IS_STATIC_EXPORT } from '@/lib/paths';
import { countDemoSlotsInUse } from '@/lib/demoUsage';
import { BackIcon, ExportIcon, PauseIcon, PlayIcon } from '@/components/EditorIcons';
import { previewResolution } from '@/lib/previewResolution';
import { prepareTextFonts, releaseOverlayOriginals } from '@/lib/textLayers';
import { useI18n } from '@/lib/useI18n';
import DestinationFolder from './DestinationFolder';
import { tx } from '@/lib/tx';

type Fmt = 'mp4' | 'gif' | 'both';
type Res = '1080p' | '2k' | '4k' | 'exact';
type Phase = 'idle' | 'preparing' | 'capturing' | 'encoding' | 'done' | 'error';

// Presets are defined by the shortest edge (vertical 1080p = 1080×1920).
const RES_SHORT: Record<Exclude<Res, 'exact'>, number> = { '1080p': 1080, '2k': 1440, '4k': 2160 };
const RES_LABEL: Record<Exclude<Res, 'exact'>, string> = { '1080p': '1080p', '2k': '2K', '4k': '4K' };

// Target output size + capture scale for a given preset. Even dimensions
// are required by libx264 with yuv420p.
function targetFor(res: Res, s: { width: number; height: number; customW: number; customH: number; aspect: string }) {
  if (res === 'exact' && s.aspect !== 'custom') res = '1080p'; // stale selection after aspect change
  let k: number;
  let tw: number, th: number;
  if (res === 'exact') {
    k = Math.max(s.customW, s.customH) / Math.max(s.width, s.height);
    tw = s.customW; th = s.customH;
  } else {
    k = RES_SHORT[res] / Math.min(s.width, s.height);
    tw = Math.round(s.width * k); th = Math.round(s.height * k);
    const aspect = ASPECTS[s.aspect];
    if (aspect) {
      const [aw, ah] = aspect;
      tw = aw <= ah ? RES_SHORT[res] : Math.round(RES_SHORT[res] * aw / ah);
      th = ah <= aw ? RES_SHORT[res] : Math.round(RES_SHORT[res] * ah / aw);
    }
  }
  return { k, width: tw - (tw % 2), height: th - (th % 2) };
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

async function post(body: any) {
  const res = await fetch(`${BASE_PATH}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const pt = useI18n().locale === 'pt';
  const store = useSceneStore;
  const aspect = useSceneStore((s) => s.aspect);
  const width = useSceneStore((s) => s.width);
  const height = useSceneStore((s) => s.height);
  const customW = useSceneStore((s) => s.customW);
  const customH = useSceneStore((s) => s.customH);
  const frame = useSceneStore((s) => s.frame);
  const fps = useSceneStore((s) => s.fps);
  const duration = useSceneStore((s) => s.duration);
  const playing = useSceneStore((s) => s.playing);
  const setPlaying = useSceneStore((s) => s.setPlaying);
  const demoSlots = useSceneStore(countDemoSlotsInUse);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<Fmt>('mp4');
  const [res, setRes] = useState<Res>('1080p');
  const [phase, setPhase] = useState<Phase>('idle');
  const [captured, setCaptured] = useState(0);
  const [total, setTotal] = useState(0);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [err, setErr] = useState('');
  const [confirmDemo, setConfirmDemo] = useState(false);
  const cancelled = useRef(false);
  const exportSession = useRef<string | null>(null);
  const [encodingLog, setEncodingLog] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const busy = phase === 'preparing' || phase === 'capturing' || phase === 'encoding';
  useEffect(()=>{setDesktopBusy('export',busy);return()=>setDesktopBusy('export',false);},[busy]);
  useEffect(() => {
    if (phase !== 'encoding') return;
    const timer = setInterval(() => { if (exportSession.current) void post({ action: 'status', sessionId: exportSession.current }).then((data) => setEncodingLog(data.log)).catch(() => {}); }, 1500);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  // The mobile export page mirrors the existing renderer instead of creating
  // a second Pixi/Three instance. Desktop hides this canvas completely.
  useEffect(() => {
    // same bound as MOBILE_QUERY in app/page.tsx — see the note there
    if (!window.matchMedia('(max-width: 919px)').matches) return;
    let raf = 0;
    const draw = () => {
      const target = previewCanvasRef.current;
      const source = getRendererInstance()?.extractCanvas();
      if (target && source && source.width > 0 && source.height > 0) {
        const scale = Math.min(1, 1200 / Math.max(source.width, source.height));
        const nextWidth = Math.max(1, Math.round(source.width * scale));
        const nextHeight = Math.max(1, Math.round(source.height * scale));
        if (target.width !== nextWidth || target.height !== nextHeight) {
          target.width = nextWidth;
          target.height = nextHeight;
        }
        target.getContext('2d')?.drawImage(source, 0, 0, nextWidth, nextHeight);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const run = async () => {
    cancelled.current = false;
    setElapsed(0);
    setConfirmDemo(false);
    const s = store.getState();
    const renderer = getRendererInstance();
    if (!renderer) { setErr('Renderer not ready'); setPhase('error'); return; }

    const totalFrames = Math.max(1, Math.round(s.duration * s.fps));
    const target = targetFor(res, s);
    const wasPlaying = s.playing;
    let imagesPrepared=false;
    const restoreImages=()=>{if(imagesPrepared){imagesPrepared=false;renderer.endImageExport?.();releaseOverlayOriginals();}};
    s.setPlaying(false);
    setTotal(totalFrames);
    setPhase('capturing');
    setErr('');

    try {
      setPhase('preparing');
      imagesPrepared=true;
      await prepareTextFonts(s.textLayers,true);
      await renderer.beginImageExport?.();
      await renderer.beginVideoExport?.();
      setPhase('capturing');
      const { sessionId } = await post({ action: 'begin' });
      exportSession.current = sessionId;

      renderer.setCaptureScale(target.k); // hi-res backing store; layout untouched
      try {
        for (let f = 0; f < totalFrames; f++) {
          if (cancelled.current) {
            await post({ action: 'cancel', sessionId });
            throw new Error('Exportação cancelada. Os quadros temporários foram removidos.');
          }
          await renderer.seekVideos?.(f);                 // frame-accurate video cards (no-op without video)
          const dataUrl = renderer.captureFrame(f);       // time = frame counter, never wall-clock
          await post({ action: 'frame', sessionId, index: f, dataUrl });
          setCaptured(f + 1);
          // yield to keep UI responsive
          if (f % 5 === 0) await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        renderer.endVideoExport?.();                      // restore original video sources
        restoreImages();
        renderer.setCaptureScale(previewResolution());
        renderer.resumeVideos?.();                        // back to live playback in the preview
      }

      setPhase('encoding');

      // audio bytes (blob url → base64) if present
      let audio: string | undefined;
      if (s.audioUrl) {
        const buf = await (await fetch(s.audioUrl)).arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        audio = btoa(binary);
      }

      const { files, directory } = await post({
        action: 'encode',
        sessionId,
        fps: s.fps,
        format,
        width: target.width,
        height: target.height,
        audio,
        audioSettings: s.audioSettings,
      });

      setOutputs(files as string[]);
      setOutputDirectory(String(directory));
      setPhase('done');
      s.setFrame(s.frame);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setPhase('error');
    } finally {
      restoreImages();
      if (wasPlaying) s.setPlaying(true);
    }
  };

  return (
    <div className="modal-backdrop export-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <button className="icon-btn export-mobile-back" onClick={onClose} aria-label="Back to editor"><BackIcon /></button>
          <span>{tx(pt, 'Exportar', 'Export')}</span>
          <button className="icon-btn" disabled={busy} onClick={onClose}>✕</button>
        </div>

        <div className="export-mobile-preview" aria-label="Export preview">
          <canvas ref={previewCanvasRef} />
        </div>

        <div className="export-mobile-transport">
          <button
            className="export-mobile-play"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? 'Pause preview' : 'Play preview'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <span><b>{formatTime(frame / Math.max(1, fps))}</b> / {formatTime(duration)}</span>
        </div>

        <div className="modal-body export-modal-body">
          {IS_STATIC_EXPORT ? (
          <div className="export-static-note">
            <p>
              Export renders every frame and encodes MP4/GIF with native ffmpeg —
              that pipeline isn&apos;t available on this hosted demo.
            </p>
            <p>To export, clone the repo and run it locally:</p>
            <pre><code>{`git clone https://github.com/appariciojunior/motion-studio-open.git
cd motion-studio-open
npm install && brew install ffmpeg
npm run dev`}</code></pre>
            <a className="btn primary full" href="https://github.com/appariciojunior/motion-studio-open" target="_blank" rel="noreferrer">
              View on GitHub
            </a>
          </div>
          ) : (
          <>
          <div className="ctl-row">
            <label className="ctl-label">
              <span className="export-label-desktop">{tx(pt, 'Formato', 'Format')}</span>
              <span className="export-label-mobile">Output</span>
            </label>
            <div className="ctl-input">
              <div className="pills pills-fit">
                {(['mp4', 'gif', 'both'] as Fmt[]).map((f) => (
                  <button key={f} className={`pill ${format === f ? 'active' : ''}`} onClick={() => setFormat(f)}>{f.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="ctl-row">
            <label className="ctl-label">{tx(pt, 'Resolução', 'Resolution')}</label>
            <div className="ctl-input">
              <div className="pills pills-fit">
                {(Object.keys(RES_SHORT) as Exclude<Res, 'exact'>[]).map((r) => (
                  <button key={r} className={`pill ${res === r ? 'active' : ''}`} onClick={() => setRes(r)}>{RES_LABEL[r]}</button>
                ))}
                {aspect === 'custom' && (
                  <button className={`pill ${res === 'exact' ? 'active' : ''}`} onClick={() => setRes('exact')} title={`Exact canvas size ${customW}×${customH}`}>
                    {customW}×{customH}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="ctl-hint">
            {(() => {
              const t = targetFor(res, { width, height, customW, customH, aspect });
              return `Output ${t.width}×${t.height} px`;
            })()}
          </div>

          <DestinationFolder kind="exports" disabled={busy} />

          {phase === 'idle' && !confirmDemo && (
            <button className="btn primary full export-primary-action" onClick={() => demoSlots > 0 ? setConfirmDemo(true) : run()}>
              <ExportIcon size={16} />
              <span className="export-action-desktop">{tx(pt, 'Iniciar exportação', 'Start export')}</span>
              <span className="export-action-mobile">Export</span>
            </button>
          )}

          {phase === 'idle' && confirmDemo && (
            <div className="export-demo-warning" role="alert">
              <strong>{demoSlots} demo {demoSlots === 1 ? 'slot is' : 'slots are'} still in use</strong>
              <p>{tx(pt, 'Os cartões de demonstração aparecerão no arquivo exportado. Você pode substituí-los em Mídia.', 'Demo images will appear in the exported file unless you replace them in Media.')}</p>
              <div className="export-demo-actions">
                <button className="btn" onClick={() => setConfirmDemo(false)}>{tx(pt, 'Cancelar', 'Cancel')}</button>
                <button className="btn primary" onClick={run}>{tx(pt, 'Exportar mesmo assim', 'Export anyway')}</button>
              </div>
            </div>
          )}

          {phase === 'preparing' && <div className="progress"><span>{tx(pt, 'Preparando imagens originais e vídeos…', 'Preparing original images and videos…')}</span></div>}

          {phase === 'capturing' && (
            <div className="progress">
              <div className="progress-bar"><div style={{ width: `${(captured / total) * 100}%` }} /></div>
              <span>Capturing frames {captured}/{total}</span>
              <span>{Math.round(elapsed)}s · ~{captured > 0 ? Math.round(elapsed / captured * Math.max(0, total - captured)) : '…'}s restantes na captura</span>
              <button className="btn" onClick={() => { cancelled.current = true; }}>Cancelar captura</button>
            </div>
          )}

          {phase === 'encoding' && <div className="progress"><span>Codificando vídeo com FFmpeg…</span><button className="btn" onClick={() => { cancelled.current = true; if (exportSession.current) void post({ action: 'cancel', sessionId: exportSession.current }); }}>Cancelar exportação</button><details><summary>Diagnóstico técnico</summary><pre className="export-log">{encodingLog || 'Aguardando informações…'}</pre></details></div>}

          {phase === 'done' && (
            <div className="export-done">
              <p>{tx(pt, 'Concluído. Salvo automaticamente em:', 'Done. Saved automatically to:')}</p>
              <p><code>{outputDirectory}</code></p>
              <button className="btn" onClick={() => fetch('/api/diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: 'exports' }) })}>Abrir pasta de exportações</button>
              <ul>
                {outputs.map((file) => (
                  <li key={file}><code>{file}</code></li>
                ))}
              </ul>
            </div>
          )}

          {phase === 'error' && (
            <div className="export-error">
              {tx(pt, 'A exportação falhou:', 'Export failed:')} {err}
              <button className="btn" onClick={() => { setPhase('idle'); setCaptured(0); }}>Tentar novamente</button>
              {/ffmpeg|ENOENT/i.test(err) && (
                <div className="export-hint">
                  ffmpeg isn’t installed. Install it, then retry:<br />
                  <code>brew install ffmpeg</code>
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
