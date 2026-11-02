// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useSceneStore } from '@/store/useSceneStore';
import type { TextLayer } from '@/lib/textLayers';
import { animatedLayer, hasKeys, keyedPatch } from '@/lib/keyframes';
import { ControlRow } from './Controls';
import { KeyedRow } from './KeyframeControls';
import { tx } from '@/lib/tx';

// 3D rotation with perspective for a text, image or shape layer.
export default function Tilt3DControls({ layer, pt }: { layer: TextLayer; pt: boolean }) {
  const keyFrame = useSceneStore((s) => hasKeys(layer) ? s.frame : 0), fps = useSceneStore((s) => s.fps);
  const seconds = (hasKeys(layer) ? keyFrame : useSceneStore.getState().frame) / fps, live = animatedLayer(layer, seconds);
  const patch = (change: Partial<TextLayer>) => useSceneStore.getState().patchTextLayer(layer.id, keyedPatch(layer, change, seconds));
  const tilted = Math.abs(live.tiltX ?? 0) > .01 || Math.abs(live.tiltY ?? 0) > .01;
  return <div className="tilt-controls">
    <KeyedRow layer={layer} prop="tiltX" pt={pt}><ControlRow def={{ key: 'tiltX', label: tx(pt, 'Rotação 3D X', '3D rotation X'), type: 'slider', min: -85, max: 85, step: .5, unit: '°', default: 0 }} value={live.tiltX ?? 0} onChange={(v) => patch({ tiltX: Number(v) })} /></KeyedRow>
    <KeyedRow layer={layer} prop="tiltY" pt={pt}><ControlRow def={{ key: 'tiltY', label: tx(pt, 'Rotação 3D Y', '3D rotation Y'), type: 'slider', min: -85, max: 85, step: .5, unit: '°', default: 0 }} value={live.tiltY ?? 0} onChange={(v) => patch({ tiltY: Number(v) })} /></KeyedRow>
    {tilted && <ControlRow def={{ key: 'fov', label: tx(pt, 'Perspectiva', 'Perspective'), type: 'slider', min: 15, max: 110, step: 1, unit: '°', default: 40 }} value={layer.fov ?? 40} onChange={(v) => useSceneStore.getState().patchTextLayer(layer.id, { fov: Number(v) })} />}
  </div>;
}
