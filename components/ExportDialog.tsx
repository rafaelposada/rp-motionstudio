// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import {setDesktopBusy} from '@/lib/desktop';

import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { getRendererInstance } from '@/lib/rendererInstance';
import { IS_STATIC_EXPORT } from '@/lib/paths';
import { countDemoSlotsInUse } from '@/lib/demoUsage';
import { BackIcon, ExportIcon, PauseIcon, PlayIcon } from '@/components/EditorIcons';
import { useI18n } from '@/lib/useI18n';
import DestinationFolder from './DestinationFolder';
import { tx, txf } from '@/lib/tx';
import { getTemplate } from '@/templates';
import { RES_LABEL, RES_SHORT, post, runExport, targetFor, type Fmt, type Phase, type Res } from '@/lib/exportRunner';

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
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
  const [extraAspects, setExtraAspects] = useState<string[]>([]);
  const currentAspect = store((st) => st.aspect), engine3d = store((st) => getTemplate(st.activeTemplateId).meta.engine === 'webgl');
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
    setErr('');
    try {
      const result = await runExport({ format, res, extraAspects, isCancelled: () => cancelled.current, onProgress: (p) => {
        setPhase(p.phase); if (p.total !== undefined) setTotal(p.total); if (p.captured !== undefined) setCaptured(p.captured);
        if (p.sessionId) exportSession.current = p.sessionId;
      } });
      setOutputs(result.files);
      setOutputDirectory(result.directory);
      setPhase('done');
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setPhase('error');
    }
  };

  return (
    <div className="modal-backdrop export-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <button className="icon-btn export-mobile-back" onClick={onClose} aria-label={tx(pt, 'Voltar ao editor', 'Back to editor')}><BackIcon /></button>
          <span>{tx(pt, 'Exportar', 'Export')}</span>
          <button className="icon-btn" disabled={busy} onClick={onClose}>✕</button>
        </div>

        <div className="export-mobile-preview" aria-label={tx(pt, 'Prévia da exportação', 'Export preview')}>
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
              <span className="export-label-mobile">{tx(pt, 'Saída', 'Output')}</span>
            </label>
            <div className="ctl-input">
              <div className="pills pills-fit">
                {(['mp4', 'gif', 'both', 'mov'] as Fmt[]).map((f) => (
                  <button key={f} className={`pill ${format === f ? 'active' : ''}`} disabled={f === 'mov' && engine3d} title={f === 'mov' ? tx(pt, 'MOV com fundo transparente (codec PNG), para usar em outros editores', 'MOV with a transparent background (PNG codec), for other editors') : undefined} onClick={() => setFormat(f)}>{f === 'both' ? f.toUpperCase() : f === 'mov' ? 'MOV α' : f.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>

          {format === 'mov' && <p className="ctl-hint">{tx(pt, 'O MOV sai sem fundo, com transparência, pronto para After Effects, Premiere, Final Cut e DaVinci. Arquivos grandes.', 'The MOV has no background, with transparency, ready for After Effects, Premiere, Final Cut and DaVinci. Large files.')}</p>}
          {engine3d && <p className="ctl-hint">{tx(pt, 'MOV transparente está disponível nos modelos 2D.', 'Transparent MOV is available for 2D models.')}</p>}
          <div className="ctl-row">
            <label className="ctl-label">{tx(pt, 'Também exportar em', 'Also export as')}</label>
            <div className="ctl-input">
              <div className="pills pills-fit export-aspects">
                {['9:16', '4:5', '1:1', '16:9'].filter((aspect) => aspect !== currentAspect).map((aspect) => <button key={aspect} type="button" className={`pill ${extraAspects.includes(aspect) ? 'active' : ''}`} aria-pressed={extraAspects.includes(aspect)} onClick={() => setExtraAspects((list) => list.includes(aspect) ? list.filter((a) => a !== aspect) : [...list, aspect])}>{aspect}</button>)}
              </div>
            </div>
          </div>
          {extraAspects.length > 0 && <p className="ctl-hint">{tx(pt, 'Cada formato extra é exportado em seguida, com textos e camadas reposicionados na mesma proporção. Revise o enquadramento; a composição volta ao formato original no fim.', 'Each extra format is exported afterwards, with text and layers repositioned proportionally. Review the framing; the composition returns to its original format at the end.')}</p>}

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
              return `${tx(pt, 'Saída', 'Output')} ${t.width}×${t.height} px`;
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
              <strong>{txf(pt, demoSlots === 1 ? '{n} espaço de demonstração ainda em uso' : '{n} espaços de demonstração ainda em uso', demoSlots === 1 ? '{n} demo slot is still in use' : '{n} demo slots are still in use', { n: demoSlots })}</strong>
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
