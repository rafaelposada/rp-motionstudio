// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useEffect, useRef, useState } from 'react';
import { SceneRenderer } from '@/lib/renderer';
import type { IRenderer } from '@/lib/rendererTypes';
import { setRendererInstance } from '@/lib/rendererInstance';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { getTemplate } from '@/templates';
import { previewResolution, setPreviewPlaying } from '@/lib/previewResolution';
import { hasBackdropBlur, prepareTextFonts } from '@/lib/textLayers';
import { MEDIA_READY_EVENT } from '@/lib/shapeFill';
import { useAudioPreview } from '@/lib/useAudioPreview';
import CanvasTextSelection from './CanvasTextSelection';
import ModelVisibilityNotice from './ModelVisibilityNotice';
import PreviewNavigation from './PreviewNavigation';
import { tx } from '@/lib/tx';

export default function PreviewStage() {
  useAudioPreview();
  const [initializationError,setInitializationError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const pt=useUIStore(state=>state.locale)==='pt';
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<IRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const anchorTimeRef = useRef<number>(0);   // wall-clock at playback start
  const anchorFrameRef = useRef<number>(0);  // frame at playback start
  const lastRenderedFrameRef = useRef<number | null>(null);
  const dirtyRef = useRef<boolean>(true);    // a paused preview redraws only when this is set
  const lastPlayingRef = useRef<boolean>(true);
  const theme = useUIStore((state) => state.theme);
  const settingsOpen = useUIStore((state) => state.settingsOpen);
  // A paused canvas also needs repainting after UI-only changes. These don't
  // touch scene data, and must not restart the renderer or playback clock.
  // Selection matters too: a selected layer hidden by its entrance shows at rest.
  const selectedLayers = useUIStore((state) => state.selectedLayerIds);
  useEffect(() => { dirtyRef.current = true; }, [theme, settingsOpen, selectedLayers]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const redraw = () => { dirtyRef.current = true; };
    const observer = new ResizeObserver(redraw);
    observer.observe(stage);
    window.addEventListener('focus', redraw);
    window.addEventListener('motion-canvas-edit', redraw);
    window.addEventListener(MEDIA_READY_EVENT, redraw);
    document.addEventListener('visibilitychange', redraw);
    return () => {
      observer.disconnect();
      window.removeEventListener('focus', redraw);
      window.removeEventListener('motion-canvas-edit', redraw);
      window.removeEventListener(MEDIA_READY_EVENT, redraw);
      document.removeEventListener('visibilitychange', redraw);
    };
  }, []);
  // React Strict Mode deliberately starts, cleans up and starts effects again
  // in development. The renderer import is asynchronous, so an obsolete start
  // must not claim (and later force-loss) the canvas owned by the newer one.
  const initGenerationRef = useRef(0);

  const width = useSceneStore((s) => s.width);
  const height = useSceneStore((s) => s.height);
  const textLayers = useSceneStore((s) => s.textLayers);
  useEffect(() => {
    let current = true;
    prepareTextFonts(textLayers).then(() => { if (current) dirtyRef.current = true; }).catch(() => { /* Export reports a missing font before capture. */ });
    return () => { current = false; };
  }, [textLayers]);
  const sceneGeneration = useSceneStore((s) => s.tracks.map((track) => `${track.id}:${track.templateId}`).join('|'));
  // Engine flag drives a full canvas remount — a canvas can never be reused
  // across GL libraries (context attributes and loss behaviour differ).
  //
  // Layer stacking is a 2D compositing feature: only the Pixi renderer draws a
  // container per track. So a stack of two or more layers stays on Pixi even if
  // the selected track's template is webgl — that template falls back to its own
  // 2D `transform`, which every template provides. Otherwise selecting a webgl
  // layer would swap in the single-motion 3D renderer and the other layers would
  // vanish.
  const engine = useSceneStore((s) =>
    s.textLayers.some(layer=>layer.visible&&hasBackdropBlur(layer)) || s.tracks.some((track) => track.visible && (s.compositeMode === 'stack' || track.id === s.activeTrackId) && getTemplate(track.templateId).meta.engine === 'webgl')
      ? 'webgl'
      : 'pixi',
  );

  useEffect(() => {
    const initGeneration = ++initGenerationRef.current;
    setInitializationError(false);
    // A new template/renderer starts from the authoritative playhead, including
    // a trimmed layer's in-point. Never reuse the previous template's clock.
    anchorTimeRef.current=0;
    anchorFrameRef.current=useSceneStore.getState().frame;
    lastRenderedFrameRef.current=null;
    let mounted = true;
    let renderer: IRenderer | null = null;
    const canvas = document.createElement('canvas');
    canvas.className = 'stage-canvas';
    canvas.style.setProperty('--canvas-aspect', String(width / height));
    // The canvas belongs to this exact renderer generation. Keeping it in a
    // local variable prevents an obsolete async Pixi init/cleanup from ever
    // claiming the canvas created for Three (or vice versa).
    // Keep the React-owned selection overlay mounted when renderers change.
    stageRef.current?.appendChild(canvas);

    // Render only when there's something new to show: while playing (frame
    // advancing), or once after any state/texture change while paused. An idle
    // paused preview draws nothing — no wasted GPU/CPU at 60fps on a still image.
    const loop = () => {
      const st = useSceneStore.getState();

      // freeze/resume card video decoding together with the timeline
      if (st.playing !== lastPlayingRef.current) {
        lastPlayingRef.current = st.playing;
        setPreviewPlaying(st.playing);
        if (st.playing) rendererRef.current?.resumeVideos?.();
        else rendererRef.current?.pauseVideos?.();
        dirtyRef.current = true;
      }

      if (st.playing) {
        const now = performance.now();
        if (anchorTimeRef.current === 0) {
          anchorTimeRef.current = now;
          anchorFrameRef.current = st.frame;
        }
        const elapsed = (now - anchorTimeRef.current) / 1000;
        const total = Math.max(1, Math.round(st.duration * st.fps));
        const frame = Math.floor(anchorFrameRef.current + elapsed * st.fps) % total;
        // Compare against the frame we actually rendered, rather than the
        // store value. Store updates are batched and can lag behind the clock;
        // using st.frame here can reset videos more than once per loop and
        // makes them appear to jump backwards/forwards.
        // requestAnimationFrame normally runs at 60–120 Hz while the scene is
        // commonly 30 fps. Draw only when the timeline reaches a new frame (or
        // when an edit/texture marks the current frame dirty) instead of doing
        // the same GPU work two to four times.
        if (frame !== lastRenderedFrameRef.current || dirtyRef.current) {
          if (lastRenderedFrameRef.current !== null && frame < lastRenderedFrameRef.current) {
            rendererRef.current?.restartVideos?.(); // clip wrapped — 'hold' videos restart with it
          }
          dirtyRef.current = false;
          lastRenderedFrameRef.current = frame;
          if (frame !== st.frame) st.setFrame(frame);
          rendererRef.current?.renderFrame(frame);
          window.dispatchEvent(new Event('motion-preview-rendered'));
        }
      } else {
        anchorTimeRef.current = 0;
        lastRenderedFrameRef.current = null;
        if (dirtyRef.current) {
          dirtyRef.current = false;
          rendererRef.current?.renderFrame(st.frame);
          window.dispatchEvent(new Event('motion-preview-rendered'));
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    // any store change (control tweak, scrub, asset/effect/bg edit) means the
    // paused preview must redraw once
    const unsub = useSceneStore.subscribe(() => { dirtyRef.current = true; });

    (async () => {
      if (engine === 'webgl') {
        // three stays out of the bundle for 2D-only sessions
        const { SceneRenderer3D } = await import('@/lib/renderer3d');
        renderer = new SceneRenderer3D();
      } else {
        renderer = new SceneRenderer();
      }
      if (!mounted || initGeneration !== initGenerationRef.current) return;
      // async texture loads (images/videos) also need a redraw when they arrive
      renderer.onDirty = () => { dirtyRef.current = true; };
      await renderer.init(canvas);
      if (!mounted || initGeneration !== initGenerationRef.current) { renderer.destroy(); return; }
      rendererRef.current = renderer;
      setRendererInstance(renderer);
      // Development-only hook for scripts/verify-render-parity.cjs.
      if (process.env.NODE_ENV !== 'production' && window.location.search.includes('rp-test')) (window as unknown as { __rpTest?: unknown }).__rpTest = { renderer, scene: useSceneStore, ui: useUIStore };
      dirtyRef.current = true;
      lastPlayingRef.current = useSceneStore.getState().playing;
      rafRef.current = requestAnimationFrame(loop);
    })().catch(error=>{
      if(!mounted||initGeneration!==initGenerationRef.current)return;
      console.error('Preview initialization failed',error);
      useSceneStore.getState().setPlaying(false);
      setInitializationError(true);
    });

    return () => {
      mounted = false;
      unsub();
      cancelAnimationFrame(rafRef.current);
      setRendererInstance(null);
      rendererRef.current = null;
      renderer?.destroy();
      if (canvas.parentNode) canvas.remove();
    };
  }, [engine, sceneGeneration, attempt]);

  // live resize on aspect/fps-driven dimension changes
  useEffect(() => {
    stageRef.current?.querySelector<HTMLCanvasElement>('.stage-canvas')
      ?.style.setProperty('--canvas-aspect', String(width / height));
    rendererRef.current?.resize(width, height, previewResolution());
    dirtyRef.current = true; // canvas resized — redraw even if paused
  }, [width, height]);

  useEffect(() => {
    const resize = () => { rendererRef.current?.resize(width, height, previewResolution()); dirtyRef.current = true; };
    window.addEventListener('motion-preview-quality', resize);
    return () => window.removeEventListener('motion-preview-quality', resize);
  }, [width, height]);

  return (
    <div ref={stageRef} className="stage-wrap"><CanvasTextSelection /><ModelVisibilityNotice /><PreviewNavigation stage={stageRef}/>{initializationError&&<div className="preview-init-error" role="alert"><span>{tx(pt, 'Não foi possível iniciar a prévia. A edição permanece nesta janela; salve um rascunho antes de sair.', 'The preview could not start. Your editing data remains in this window; save a draft before leaving.')}</span><button type="button" className="btn" onClick={()=>setAttempt(value=>value+1)}>{tx(pt, 'Tentar novamente', 'Try again')}</button></div>}</div>
  );
}
