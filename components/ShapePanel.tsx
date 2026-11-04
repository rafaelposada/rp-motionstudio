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
import ShapeMediaFill from './ShapeMediaFill';
import { useState } from 'react';
import { INNER, POINTS, SIDES, regularAspect, reshapePointed } from '@/lib/shapeGeometry';

const KINDS: { kind: ShapeSpec['kind']; pt: string; en: string; icon: string }[] = [
  { kind: 'rect', pt: 'Retângulo', en: 'Rectangle', icon: 'M5.5 6h13a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9A1.5 1.5 0 0 1 5.5 6z' },
  { kind: 'ellipse', pt: 'Elipse', en: 'Ellipse', icon: 'M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z' },
  { kind: 'polygon', pt: 'Polígono', en: 'Polygon', icon: 'M12 4l6.93 4v8L12 20l-6.93-4V8z' },
  { kind: 'star', pt: 'Estrela', en: 'Star', icon: 'M12 4.2l2.12 5.69 6.06.25-4.76 3.77 1.63 5.85L12 16.4l-5.05 3.36 1.63-5.85-4.76-3.77 6.06-.25z' },
  { kind: 'line', pt: 'Linha', en: 'Line', icon: 'M5 19 19 5' },
];

type FillMode = 'none' | 'color' | 'media';
const FILL_MODES: { mode: FillMode; pt: string; en: string }[] = [{ mode: 'none', pt: 'Nenhum', en: 'None' }, { mode: 'color', pt: 'Cor', en: 'Color' }, { mode: 'media', pt: 'Foto ou vídeo', en: 'Photo or video' }];

const ShapeIcon = ({ d, size = 20 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export function addShape(kind: ShapeSpec['kind'], pt: boolean) {
  const s = useSceneStore.getState();
  s.addTextLayer();
  const layer = useSceneStore.getState().textLayers.at(-1)!, size = Math.round(Math.min(s.width, s.height) * .35);
  const filled = { fill: '#ffffff', fillOpacity: 1 };
  const shape: ShapeSpec = kind === 'line' ? { kind, width: size, height: 4, stroke: '#ffffff', strokeWidth: 4 }
    : kind === 'polygon' ? { kind, width: size, height: Math.round(size * regularAspect({ kind, sides: SIDES.polygon })), sides: SIDES.polygon, ...filled }
    : kind === 'star' ? { kind, width: size, height: Math.round(size * regularAspect({ kind, points: POINTS.star, innerRadius: INNER.star })), points: POINTS.star, innerRadius: INNER.star, ...filled }
    : { kind, width: size, height: kind === 'ellipse' ? size : Math.round(size * .62), ...filled, cornerRadii: kind === 'rect' ? [16, 16, 16, 16] : undefined };
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
  // Fill is one of: none, a colour, or a photo/video. Choosing media keeps the
  // colour until a file arrives, so an empty choice never blanks the shape.
  const [pickingMedia, setPickingMedia] = useState<string | null>(null);
  const fillMode: FillMode = shapeLayer?.shape?.media || pickingMedia === shapeLayer?.id ? 'media' : shapeLayer?.shape?.fill ? 'color' : 'none';
  const chooseFill = (mode: FillMode) => {
    if (!shapeLayer?.shape) return;
    setPickingMedia(mode === 'media' ? shapeLayer.id : null);
    if (mode === 'none') patchShape({ fill: undefined, media: undefined });
    else if (mode === 'color') patchShape({ fill: shapeLayer.shape.fill ?? '#ffffff', media: undefined });
  };
  return <section className="shape-panel">
    <h3>{tx(pt, 'Formas', 'Shapes')}</h3>
    <div className="shape-add" role="group" aria-label={tx(pt, 'Adicionar forma', 'Add shape')}>{KINDS.map((k) => <button key={k.kind} type="button" className="shape-tile" title={tx(pt, `Adicionar ${k.pt.toLowerCase()}`, `Add ${k.en.toLowerCase()}`)} aria-label={tx(pt, `Adicionar ${k.pt.toLowerCase()}`, `Add ${k.en.toLowerCase()}`)} onClick={() => addShape(k.kind, pt)}>
      <ShapeIcon d={k.icon} size={22} /></button>)}</div>
    {shapeLayer?.shape && live && <>
      <div className="shape-selected"><ShapeIcon d={KINDS.find((k) => k.kind === shapeLayer.shape!.kind)?.icon ?? KINDS[0].icon} size={16} /><strong>{shapeLayer.text}</strong></div>
      {shapeLayer.shape.kind === 'polygon' && <ControlRow def={{ key: 'shapeSides', label: tx(pt, 'Lados', 'Sides'), type: 'slider', min: SIDES.min, max: SIDES.max, step: 1, default: SIDES.polygon }} value={shapeLayer.shape.sides ?? SIDES.polygon} onChange={(v) => patch({ shape: reshapePointed(shapeLayer.shape!, { sides: Number(v) }) })} />}
      {shapeLayer.shape.kind === 'star' && <>
        <ControlRow def={{ key: 'shapePoints', label: tx(pt, 'Pontas', 'Points'), type: 'slider', min: POINTS.min, max: POINTS.max, step: 1, default: POINTS.star }} value={shapeLayer.shape.points ?? POINTS.star} onChange={(v) => patch({ shape: reshapePointed(shapeLayer.shape!, { points: Number(v) }) })} />
        <ControlRow def={{ key: 'shapeInner', label: tx(pt, 'Raio interno', 'Inner radius'), type: 'slider', min: INNER.min * 100, max: INNER.max * 100, step: 1, unit: '%', default: INNER.star * 100 }} value={Math.round((shapeLayer.shape.innerRadius ?? INNER.star) * 100)} onChange={(v) => patch({ shape: reshapePointed(shapeLayer.shape!, { innerRadius: Number(v) / 100 }) })} />
      </>}
      <ControlRow def={{ key: 'shapeWidth', label: tx(pt, 'Largura', 'Width'), type: 'slider', min: 1, max: 4000, step: 1, unit: 'px', default: 200 }} value={shapeLayer.shape.width} onChange={(v) => patchShape({ width: Number(v) })} />
      {shapeLayer.shape.kind !== 'line' && <ControlRow def={{ key: 'shapeHeight', label: tx(pt, 'Altura', 'Height'), type: 'slider', min: 1, max: 4000, step: 1, unit: 'px', default: 200 }} value={shapeLayer.shape.height} onChange={(v) => patchShape({ height: Number(v) })} />}
      {shapeLayer.shape.kind === 'rect' && <>
        <ControlRow def={{ key: 'shapeCorners', label: tx(pt, 'Arredondar todos os cantos', 'Round all corners'), type: 'slider', min: 0, max: Math.floor(Math.min(Math.abs(shapeLayer.shape.width), Math.abs(shapeLayer.shape.height)) / 2), step: 1, unit: 'px', default: 0 }} value={shapeRadii(shapeLayer.shape)[0]} onChange={(v) => { const r = Number(v); patchShape({ cornerRadii: [r, r, r, r], radius: undefined }); }} />
        <p className="ctl-hint">{tx(pt, 'Na tela, arraste os pontos dentro dos cantos para arredondar. Alt ajusta um canto só.', 'On the canvas, drag the dots inside the corners to round them. Alt changes one corner only.')}</p>
      </>}
      {(shapeLayer.shape.kind === 'polygon' || shapeLayer.shape.kind === 'star') && <ControlRow def={{ key: 'shapeRound', label: tx(pt, 'Arredondar cantos', 'Round corners'), type: 'slider', min: 0, max: Math.max(1, Math.floor(Math.min(Math.abs(shapeLayer.shape.width), Math.abs(shapeLayer.shape.height)) / 2)), step: 1, unit: 'px', default: 0 }} value={shapeLayer.shape.radius ?? 0} onChange={(v) => patchShape({ radius: Number(v) })} />}
      {shapeLayer.shape.kind !== 'line' && <>
        <span className="ctl-label shape-fill-label">{tx(pt, 'Preenchimento', 'Fill')}</span>
        <div className="media-fit-pills shape-fill-mode" role="group" aria-label={tx(pt, 'Tipo de preenchimento', 'Fill type')}>
          {FILL_MODES.map((m) => <button key={m.mode} type="button" className={fillMode === m.mode ? 'active' : ''} aria-pressed={fillMode === m.mode} onClick={() => chooseFill(m.mode)}>{tx(pt, m.pt, m.en)}</button>)}
        </div>
        {fillMode === 'color' && shapeLayer.shape.fill && <ColorField pt={pt} label={tx(pt, 'Cor do preenchimento', 'Fill color')} color={shapeLayer.shape.fill} opacity={shapeLayer.shape.fillOpacity ?? 1} onChange={(fill, fillOpacity) => patchShape({ fill, fillOpacity })} />}
        {fillMode === 'media' && <>
          <ShapeMediaFill layer={shapeLayer} pt={pt} />
          {shapeLayer.shape.media && <ControlRow def={{ key: 'shapeMediaOpacity', label: tx(pt, 'Opacidade da mídia', 'Media opacity'), type: 'slider', min: 0, max: 100, step: 1, unit: '%', default: 100 }} value={Math.round((shapeLayer.shape.fillOpacity ?? 1) * 100)} onChange={(v) => patchShape({ fillOpacity: Number(v) / 100 })} />}
        </>}
      </>}
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
