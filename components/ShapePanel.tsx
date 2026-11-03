// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { shapeRadii, type ShapeSpec, type TextLayer } from '@/lib/textLayers';
import { animatedLayer, hasKeys, keyedPatch } from '@/lib/keyframes';
import { ControlRow } from './Controls';
import ColorField from './ColorField';
import { BlendRow } from './BlendSelect';
import { KeyedRow } from './KeyframeControls';
import LayerAnimationControls from './LayerAnimationControls';
import MaskControl from './MaskControl';
import { tx } from '@/lib/tx';
import Tilt3DControls from './Tilt3DControls';

const KINDS: { kind: ShapeSpec['kind']; pt: string; en: string; icon: string }[] = [
  { kind: 'rect', pt: 'Retângulo', en: 'Rectangle', icon: 'M4 6h16v12H4z' },
  { kind: 'ellipse', pt: 'Elipse', en: 'Ellipse', icon: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z' },
  { kind: 'line', pt: 'Linha', en: 'Line', icon: 'M5 19 19 5' },
];

export function addShape(kind: ShapeSpec['kind'], pt: boolean) {
  const s = useSceneStore.getState();
  s.addTextLayer();
  const layer = useSceneStore.getState().textLayers.at(-1)!, size = Math.round(Math.min(s.width, s.height) * .35);
  const shape: ShapeSpec = kind === 'line' ? { kind, width: size, height: 4, stroke: '#ffffff', strokeWidth: 4 } : { kind, width: size, height: kind === 'ellipse' ? size : Math.round(size * .62), fill: '#ffffff', fillOpacity: 1, cornerRadii: kind === 'rect' ? [16, 16, 16, 16] : undefined };
  const label = KINDS.find((k) => k.kind === kind)!;
  s.patchTextLayer(layer.id, { text: tx(pt, label.pt, label.en), shape, x: s.width / 2, y: s.height / 2, rotation: 0, opacity: 1 });
  useUIStore.getState().selectText(layer.id);
  useUIStore.getState().setTimelineExpanded(true);
}

export default function ShapePanel() {
  const layers = useSceneStore((s) => s.textLayers), selected = useUIStore((s) => s.selectedTextId), pt = useUIStore((s) => s.locale) === 'pt';
  const shapeLayer = layers.find((l) => l.id === selected && l.shape);
  const keyFrame = useSceneStore((s) => shapeLayer && hasKeys(shapeLayer) ? s.frame : 0), fps = useSceneStore((s) => s.fps);
  const seconds = (shapeLayer && hasKeys(shapeLayer) ? keyFrame : useSceneStore.getState().frame) / fps;
  const patch = (change: Partial<TextLayer>) => shapeLayer && useSceneStore.getState().patchTextLayer(shapeLayer.id, change);
  const patchShape = (change: Partial<ShapeSpec>) => shapeLayer?.shape && patch({ shape: { ...shapeLayer.shape, ...change } });
  const live = shapeLayer ? animatedLayer(shapeLayer, seconds) : undefined;
  return <section className="shape-panel">
    <h3>{tx(pt, 'Formas', 'Shapes')}</h3>
    <div className="shape-add">{KINDS.map((k) => <button key={k.kind} type="button" className="btn" onClick={() => addShape(k.kind, pt)}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d={k.icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>{tx(pt, k.pt, k.en)}</button>)}</div>
    {shapeLayer?.shape && live && <>
      <strong className="shape-selected">{shapeLayer.text}</strong>
      <ControlRow def={{ key: 'shapeWidth', label: tx(pt, 'Largura', 'Width'), type: 'slider', min: 1, max: 4000, step: 1, unit: 'px', default: 200 }} value={shapeLayer.shape.width} onChange={(v) => patchShape({ width: Number(v) })} />
      {shapeLayer.shape.kind !== 'line' && <ControlRow def={{ key: 'shapeHeight', label: tx(pt, 'Altura', 'Height'), type: 'slider', min: 1, max: 4000, step: 1, unit: 'px', default: 200 }} value={shapeLayer.shape.height} onChange={(v) => patchShape({ height: Number(v) })} />}
      {shapeLayer.shape.kind === 'rect' && <>
        <ControlRow def={{ key: 'shapeCorners', label: tx(pt, 'Arredondar todos os cantos', 'Round all corners'), type: 'slider', min: 0, max: Math.floor(Math.min(Math.abs(shapeLayer.shape.width), Math.abs(shapeLayer.shape.height)) / 2), step: 1, unit: 'px', default: 0 }} value={shapeRadii(shapeLayer.shape)[0]} onChange={(v) => { const r = Number(v); patchShape({ cornerRadii: [r, r, r, r], radius: undefined }); }} />
        <p className="ctl-hint">{tx(pt, 'Na tela, arraste os pontos dentro dos cantos para arredondar. Alt ajusta um canto só.', 'On the canvas, drag the dots inside the corners to round them. Alt changes one corner only.')}</p>
      </>}
      {shapeLayer.shape.kind !== 'line' && <label className="text-edit-label"><span><input type="checkbox" checked={!!shapeLayer.shape.fill} onChange={(e) => patchShape({ fill: e.target.checked ? '#ffffff' : undefined })} /> {tx(pt, 'Preenchimento', 'Fill')}</span></label>}
      {shapeLayer.shape.fill && shapeLayer.shape.kind !== 'line' && <ColorField pt={pt} label={tx(pt, 'Cor do preenchimento', 'Fill color')} color={shapeLayer.shape.fill} opacity={shapeLayer.shape.fillOpacity ?? 1} onChange={(fill, fillOpacity) => patchShape({ fill, fillOpacity })} />}
      <label className="text-edit-label"><span><input type="checkbox" checked={!!shapeLayer.shape.stroke} onChange={(e) => patchShape({ stroke: e.target.checked ? '#ffffff' : undefined, strokeWidth: shapeLayer.shape!.strokeWidth || 2 })} /> {tx(pt, 'Contorno', 'Stroke')}</span></label>
      {shapeLayer.shape.stroke && <>
        <ColorField pt={pt} label={tx(pt, 'Cor do contorno', 'Stroke color')} color={shapeLayer.shape.stroke} opacity={shapeLayer.shape.strokeOpacity ?? 1} onChange={(stroke, strokeOpacity) => patchShape({ stroke, strokeOpacity })} />
        <ControlRow def={{ key: 'shapeStroke', label: tx(pt, 'Espessura do contorno', 'Stroke width'), type: 'slider', min: 0, max: 200, step: .5, unit: 'px', default: 2 }} value={shapeLayer.shape.strokeWidth ?? 2} onChange={(v) => patchShape({ strokeWidth: Number(v) })} />
      </>}
      {(['x', 'y', 'rotation'] as const).map((key) => <KeyedRow key={key} layer={shapeLayer} prop={key} pt={pt}><ControlRow def={{ key, label: key === 'rotation' ? tx(pt, 'Rotação', 'Rotation') : `${tx(pt, 'Posição', 'Position')} ${key.toUpperCase()}`, type: 'slider', min: -4000, max: 4000, step: 1, default: 0 }} value={live[key]} onChange={(v) => patch(keyedPatch(shapeLayer, { [key]: Number(v) }, seconds))} /></KeyedRow>)}
      <Tilt3DControls layer={shapeLayer} pt={pt} />
      <KeyedRow layer={shapeLayer} prop="opacity" pt={pt}><ControlRow def={{ key: 'opacity', label: tx(pt, 'Opacidade', 'Opacity'), type: 'slider', min: 0, max: 100, step: 1, unit: '%', default: 100 }} value={live.opacity * 100} onChange={(v) => patch(keyedPatch(shapeLayer, { opacity: Number(v) / 100 }, seconds))} /></KeyedRow>
      {shapeLayer.shape.kind !== 'line' && <ControlRow def={{ key: 'shapeBackdropBlur', label: tx(pt, 'BG Blur · desfoque do fundo', 'BG Blur'), type: 'slider', min: 0, max: 40, step: .5, unit: 'px', default: 0 }} value={shapeLayer.backdropBlur ?? 0} onChange={(v) => patch({ backdropBlur: Number(v) })} />}
      <BlendRow value={shapeLayer.blend} onChange={(blend) => patch({ blend })} />
      <MaskControl layer={shapeLayer} pt={pt} />
      <LayerAnimationControls layer={shapeLayer} pt={pt} />
    </>}
  </section>;
}
