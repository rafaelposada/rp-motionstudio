// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Local bounds and on-canvas frame of an overlay layer (text, image or shape),
// shared by the selection box and the 3D tilt warp.
import { textFontRevision, textMotion, captionFontSize, type TextLayer } from './textLayers';
import { layoutText, boxLeft, anchorAlign } from './textLayout';
import { textBackdropBox } from './textPadding';
import { animatedLayer } from './keyframes';
import { bounded, rotatePoint, type TransformFrame } from './transformGeometry';

let measureContext: CanvasRenderingContext2D | null = null;
interface LocalBounds { width: number; height: number; left: number; top?:number }
const measuredBounds = new WeakMap<TextLayer, { revision: number; canvasWidth: number; box: LocalBounds }>();
export function layerBounds(layer: TextLayer, canvasWidth: number): LocalBounds {
  if (layer.media) return { width: layer.media.width, height: layer.media.height, left: -layer.media.width / 2 };
  if (layer.shape) { const w = Math.max(1, Math.abs(layer.shape.width)), h = Math.max(layer.shape.kind === 'line' ? Math.max(8, layer.shape.strokeWidth ?? 2) : 1, Math.abs(layer.shape.height)); return { width: w, height: h, left: -w / 2 }; }
  const revision = textFontRevision(), cached = measuredBounds.get(layer);
  if (cached?.revision === revision && cached.canvasWidth === canvasWidth) return cached.box;
  const ctx = measureContext ??= document.createElement('canvas').getContext('2d')!;
  const size = layer.backdrop ? captionFontSize(layer.size, layoutText(ctx, layer).width, canvasWidth) : layer.size;
  const layout = layoutText(ctx, layer, size), w = Math.max(20, layout.width), inkHeight = layout.lines.length * size * layer.lineHeight;
  const padded=textBackdropBox(w,inkHeight,anchorAlign(layer),layer.backdropPadding);
  const box = layer.backdrop?{width:padded.width,height:padded.height,left:padded.x,top:padded.y}:{width:w,height:inkHeight,left:boxLeft(layer,w),top:-inkHeight/2};
  measuredBounds.set(layer, { revision, canvasWidth, box }); return box;
}
export function layerFrame(keyedLayer: TextLayer, width: number, seconds: number): TransformFrame {
  const layer = animatedLayer(keyedLayer, seconds);
  const b = layerBounds(layer, width), motion=textMotion(layer,seconds), sx = bounded(layer.scaleX ?? 1, .05, 20)*motion.scale, sy = bounded(layer.scaleY ?? 1, .05, 20)*motion.scale;
  const c = rotatePoint({ x: (b.left + b.width / 2) * sx, y: ((b.top??-b.height/2)+b.height/2)*sy }, layer.rotation+motion.rotation);
  return { cx: layer.x + motion.x + c.x, cy: layer.y + motion.y + c.y, width: b.width * sx, height: b.height * sy, rotation: layer.rotation+motion.rotation };
}
