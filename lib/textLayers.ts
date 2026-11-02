// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { idbGet, idbPut } from './assetDb';
import { drawTextShadow, type TextShadowSettings } from './textShadow';
import { loadPreviewImage, peekPreviewImage, type RenderImage } from './textureLoad';
import { normalizedRadii, bounded, type CornerRadii } from './transformGeometry';
import {textBackdropBox,type TextPadding} from './textPadding';
import {textFontVariants,type TextRun} from './richText';
import {layoutText,boxLeft,lineOffset,canvasAlign,anchorAlign} from './textLayout';
import type { BlendMode } from './blendModes';
import { fontshareFamily, fontshareFileUrl } from './fontshare';

export type TextAlign = 'left'|'center'|'right'|'justify';
export type TextWrap = 'auto'|'balance'|'pretty';
export type LayerAnimation = 'none'|'fade'|'rise'|'drop'|'slideLeft'|'slideRight'|'zoomIn'|'zoomOut'|'pop'|'rotate'|'typewriter';

export interface TextLayer {
  id: string; text: string; font: string; weight: number; size: number;
  runs?: TextRun[];
  color: string; x: number; y: number; rotation: number; opacity: number;
  scaleX?: number; scaleY?: number; backdropRadius?: number;
  backdropColor?: string; backdropOpacity?: number; backdropBlur?: number;
  backdropPadding?: TextPadding;
  backdropStroke?: string; backdropStrokeOpacity?: number; backdropStrokeWidth?: number;
  align: TextAlign; lineHeight: number; visible: boolean;
  boxWidth?: number; wrap?: TextWrap; // fixed text box width (px); unset = grows with the text
  start: number; end: number;
  locked?: boolean; stroke?: string;
  strokeWidth?: number; fillOpacity?: number; letterSpacing?: number;
  strokeOpacity?: number;
  arc?: number; shadowColor?: string; shadowBlur?: number;
  shadowX?: number; shadowY?: number; shadowOpacity?: number;
  shadowSpread?: number; shadowType?: 'box'|'realistic'; shadowPosition?: 'outside'|'inside';
  z?: number; blend?: BlendMode;
  media?: { blobId: string; url: string; width: number; height: number; fit: 'contain' | 'cover' | 'stretch'; cornerRadii?: CornerRadii };
  animation?: 'none' | 'fade' | 'rise' | 'typewriter';
  animationDuration?: number; backdrop?: boolean;
  entrance?: LayerAnimation;
  exit?: LayerAnimation;
  entranceDuration?: number; exitDuration?: number;
}

export function textMotion(layer: TextLayer, seconds: number) {
  const length = Math.max(0.01, layer.end - layer.start);
  const entrance = layer.entrance ?? layer.animation ?? 'none';
  const exit = layer.exit ?? (layer.animation && layer.animation !== 'none' ? 'fade' : 'none');
  const duration = Math.min(length / 2, Math.max(0.05, layer.entranceDuration ?? layer.animationDuration ?? 0.35));
  const endDuration = Math.min(length / 2, Math.max(0.05, layer.exitDuration ?? layer.animationDuration ?? 0.35));
  const progress = Math.max(0, Math.min(1, (seconds - layer.start) / duration));
  const fadeOut = Math.max(0, Math.min(1, (layer.end - seconds) / endDuration));
  const pose=(mode:LayerAnimation,p:number)=>{
    const remaining=(1-p)**3;
    return {x:mode==='slideLeft'?64*remaining:mode==='slideRight'?-64*remaining:0,
      y:mode==='rise'?30*remaining:mode==='drop'?-48*remaining:0,
      scale:mode==='zoomIn'?.65+.35*(1-remaining):mode==='zoomOut'?1+.35*remaining:mode==='pop'?1+Math.pow(2,-8*p)*Math.cos(p*Math.PI*3)*-.45*(1-p):1,
      rotation:mode==='rotate'?-18*remaining:0};
  };
  const incoming=pose(entrance,progress), outgoing=pose(exit,fadeOut);
  const chars=[...layer.text];
  const typed=entrance==='typewriter'?Math.ceil(chars.length*progress):chars.length;
  const remaining=exit==='typewriter'?Math.ceil(chars.length*fadeOut):chars.length;
  return {
    opacity: (entrance !== 'none' ? progress : 1) * (exit !== 'none' ? fadeOut : 1),
    x:incoming.x-outgoing.x, y:incoming.y-outgoing.y,
    scale:incoming.scale*outgoing.scale, rotation:incoming.rotation-outgoing.rotation,
    text:chars.slice(0,Math.min(typed,remaining)).join(''),
  };
}

export function captionFontSize(size: number, longestLine: number, canvasWidth: number) {
  return size * Math.min(1, canvasWidth * 0.86 / Math.max(1, longestLine));
}

const images = new Map<string, HTMLImageElement>();
let fontRevision=0;
export function textFontRevision(){return fontRevision;}
export function releaseOverlayOriginals(){images.forEach(image=>{image.src='';});images.clear();}
export function overlayImage(url: string) {
  let image = images.get(url);
  if (!image) { image = new Image(); image.src = url; images.set(url, image); }
  return image;
}
export async function registerCustomFont(file: File, weight: number) {
  if (file.size > 20 * 1024 * 1024) throw new Error('A fonte ultrapassa 20 MB.');
  const family = `Local ${file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 70)} ${crypto.randomUUID().slice(0, 6)}`;
  const face = new FontFace(family, await file.arrayBuffer(), { weight: String(weight) });
  await face.load();
  await idbPut(`font:${family}:${weight}`, file);
  document.fonts.add(face);
  fontRevision++;
  fontPromises.set(`${family}:${weight}`, Promise.resolve());
  return family;
}
const fontPromises = new Map<string, Promise<void>>();
export function ensureFont(family: string, weight: number): Promise<void> {
  if (['Arial', 'Georgia', 'monospace', 'system-ui'].includes(family)) return Promise.resolve();
  const key = `${family}:${weight}`;
  const pending = fontPromises.get(key);
  if (pending) return pending;
  const promise = (async () => {
    const cacheKey = `font:${key}`;
    let blob = await idbGet(cacheKey);
    if (!blob) {
      const share = await fontshareFamily(family);
      let url: string | undefined;
      if (share) url = await fontshareFileUrl(share, weight);
      else {
        // No project text or personal data is sent to Google; only family/weight.
        const response = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Fonte indisponível no Google Fonts.');
        const css = await response.text();
        const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)];
        url = urls.at(-1)?.[1]; // Latin subset includes Portuguese characters.
      }
      if (!url) throw new Error('Arquivo da fonte não encontrado.');
      const fontResponse = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!fontResponse.ok) throw new Error('Falha ao baixar a fonte.');
      blob = await fontResponse.blob();
      await idbPut(cacheKey, blob);
    }
    const face = new FontFace(family, await blob.arrayBuffer(), { weight: String(weight) });
    await face.load();
    document.fonts.add(face);
    fontRevision++;
  })().catch((error) => { fontPromises.delete(key); throw error; });
  fontPromises.set(key, promise);
  return promise;
}

export async function prepareTextFonts(layers: TextLayer[], originals=false) {
  await Promise.all(layers.filter((layer) => layer.visible).map(async (layer) => {
    if (layer.media) { if (!layer.media.url) throw new Error(`Imagem indisponível: ${layer.text}. Reabra o projeto ou importe novamente.`); if(originals)await overlayImage(layer.media.url).decode();else if(!await loadPreviewImage(layer.media.url))throw new Error(`Imagem indisponível: ${layer.text}`);return; }
    await Promise.all(textFontVariants(layer).map(style=>ensureFont(style.font,style.weight)));
  }));
}

// One rasterization path for Pixi, Three, the on-screen preview and capture.
// Coordinates are scene pixels and scale with the requested export resolution.
export class TextCompositor {
  private canvas: HTMLCanvasElement | null = null;
  render(source: HTMLCanvasElement, layers: TextLayer[], width: number, height: number, seconds: number, originals=false, mediaPreview:RenderImage|null=null, transparentSource=false, maskOnly=false) {
    if (!layers.length) {
      source.style.removeProperty('display');
      this.canvas?.remove();
      return source;
    }
    const output = this.canvas ??= document.createElement('canvas');
    if (output.width !== source.width || output.height !== source.height) {
      output.width = source.width; output.height = source.height;
    }
    output.className = 'stage-canvas text-composite';
    output.style.setProperty('--canvas-aspect', String(width / height));
    if (source.parentNode && output.parentNode !== source.parentNode) source.after(output);
    source.style.display = 'none';
    const ctx = output.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, output.width, output.height);
    if(!transparentSource)ctx.drawImage(source, 0, 0);
    ctx.scale(output.width / width, output.height / height);
    for (const layer of layers) {
      if (!layer.visible || seconds < layer.start || seconds >= layer.end) continue;
      ctx.save();
      const motion = textMotion(layer, seconds);
      ctx.translate(layer.x + motion.x, layer.y + motion.y);
      ctx.rotate((layer.rotation+motion.rotation) * Math.PI / 180);
      ctx.scale(bounded(layer.scaleX ?? 1, .05, 20)*motion.scale, bounded(layer.scaleY ?? 1, .05, 20)*motion.scale);
      ctx.globalAlpha = layer.opacity * motion.opacity;
      if (layer.media) {
        if (layer.media.url) {
          const image = originals?overlayImage(layer.media.url):mediaPreview??peekPreviewImage(layer.media.url);
          const { width: w, height: h, fit } = layer.media;
          if (image && image.width && (!('complete' in image)||image.complete)) {
            const scale = fit === 'cover' ? Math.max(w / image.width, h / image.height) : Math.min(w / image.width, h / image.height);
            ctx.beginPath();
            const radii = normalizedRadii(w, h, layer.media.cornerRadii);
            if (radii.some(r => r > 0)) ctx.roundRect(-w / 2, -h / 2, w, h, radii);
            else ctx.rect(-w / 2, -h / 2, w, h);
            ctx.clip();
            const iw = fit === 'stretch' ? w : image.width * scale, ih = fit === 'stretch' ? h : image.height * scale;
            ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih);
          }
        }
        ctx.restore(); continue;
      }
      ctx.fillStyle = layer.color;
      ctx.textAlign = canvasAlign(layer.align);
      ctx.textBaseline = 'middle';
      ctx.font = `${layer.weight} ${layer.size}px "${layer.font}", sans-serif`;
      let drawSize = layer.size;
      if (layer.backdrop) {
        drawSize = captionFontSize(layer.size, layoutText(ctx,layer).width, width);
        ctx.font = `${layer.weight} ${drawSize}px "${layer.font}", sans-serif`;
      }
      const layout = layoutText(ctx, layer, drawSize), lineCount = layout.lines.length, lineStep = drawSize * layer.lineHeight;
      const textWidth = layout.width, left = boxLeft(layer, textWidth), visible = motion.text.length;
      if (layer.backdrop && motion.text) {
        const box = textBackdropBox(textWidth,lineCount * lineStep,anchorAlign(layer),layer.backdropPadding);
        const alpha = ctx.globalAlpha;
        ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, bounded(layer.backdropRadius ?? 12, 0, Math.min(box.width,box.height) / 2));
        ctx.fillStyle = maskOnly?'#ffffff':layer.backdropColor ?? '#101114'; ctx.globalAlpha = alpha * (maskOnly?1:bounded(layer.backdropOpacity ?? .8,0,1)); ctx.fill();
        if(!maskOnly && layer.backdropStroke && (layer.backdropStrokeWidth ?? 1)>0) {
          ctx.globalAlpha = alpha * bounded(layer.backdropStrokeOpacity ?? 1,0,1);
          ctx.strokeStyle = layer.backdropStroke; ctx.lineWidth = bounded(layer.backdropStrokeWidth ?? 1,0,30); ctx.lineJoin='round'; ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = layer.color;
      }
      if(maskOnly){ctx.restore();continue;}
      ctx.shadowColor = 'transparent';
      // The layout always covers the full text, so a typewriter entrance or
      // exit reveals characters in place instead of reflowing the lines.
      const glyphs=(g:CanvasRenderingContext2D,paint:(text:string,x:number,y:number,color?:string,opacity?:number)=>void)=>{
        g.save();g.textAlign='left';
        layout.lines.forEach((line,index)=>{
          const y=(index-(lineCount-1)/2)*lineStep,origin=left+lineOffset(layer.align,textWidth,line.width);
          for(const segment of line.segments){
            if(segment.start>=visible||!segment.text.trim())continue;
            g.font=segment.font;paint(segment.text.slice(0,visible-segment.start),origin+segment.x,y,segment.style.color,segment.style.fillOpacity);
          }
        });
        g.restore();
      };
      const shadow:TextShadowSettings|undefined=layer.shadowColor?{color:layer.shadowColor,opacity:layer.shadowOpacity??.5,x:layer.shadowX??0,y:layer.shadowY??0,blur:layer.shadowBlur??12,spread:layer.shadowSpread??0,type:layer.shadowType??'box',position:layer.shadowPosition??'outside'}:undefined;
      const inkPad=drawSize*.5+(layer.strokeWidth??0);
      const shadowBounds={x:left-inkPad,y:-(lineCount-1)/2*lineStep-drawSize,width:textWidth+2*inkPad,height:(lineCount-1)*lineStep+2*drawSize};
      const drawShadow=()=>{if(!shadow)return;drawTextShadow(ctx,output.width,output.height,output.width/width,shadow,(g,spread)=>{
        g.font=ctx.font;g.textBaseline='middle';g.fillStyle='#fff';g.strokeStyle='#fff';g.lineJoin='round';
        const baseWidth=layer.stroke?(layer.strokeWidth??3):0;
        glyphs(g,(text,x,y)=>{g.fillText(text,x,y);if(baseWidth+2*Math.max(0,spread)>0){g.lineWidth=baseWidth+2*Math.max(0,spread);g.strokeText(text,x,y);}});
        if(spread<0){g.globalCompositeOperation='destination-out';g.lineWidth=-2*spread;glyphs(g,(text,x,y)=>g.strokeText(text,x,y));g.globalCompositeOperation='source-over';}
      },shadowBounds);};
      if(shadow?.position==='outside')drawShadow();
      const paint = (text: string, x: number, y: number, color=layer.color, opacity=layer.fillOpacity??1) => {
        if (layer.stroke && (layer.strokeWidth ?? 3) > 0) { const alpha=ctx.globalAlpha;ctx.globalAlpha*=layer.strokeOpacity??1;ctx.strokeStyle = layer.stroke; ctx.lineWidth = layer.strokeWidth ?? 3; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);ctx.globalAlpha=alpha; }
        const alpha = ctx.globalAlpha; ctx.globalAlpha *= opacity; ctx.fillStyle=color;
        ctx.fillText(text, x, y); ctx.globalAlpha = alpha;
      };
      glyphs(ctx,paint);
      if(shadow?.position==='inside')drawShadow();
      ctx.restore();
    }
    return output;
  }
  destroy() { this.canvas?.remove(); this.canvas = null; }
}

// A cached, transparent layer surface shared by both GPU backends. Static
// overlays are rasterized only on edit/resize, not at every playback frame.
export class OverlayRaster {
  private source = document.createElement('canvas');
  private compositor = new TextCompositor();
  private maskCompositor: TextCompositor|null=null;
  maskCanvas: HTMLCanvasElement|null=null;
  private signature = '';
  private mediaUrl='';
  private mediaPreview:RenderImage|null=null;
  private mediaPending=false;
  canvas: HTMLCanvasElement = this.source;
  update(layer: TextLayer, width: number, height: number, scale: number, seconds: number, originals=false) {
    const url=layer.media?.url??'';
    if(url!==this.mediaUrl){this.mediaUrl=url;this.mediaPreview=null;this.mediaPending=false;}
    if(url&&!originals&&!this.mediaPreview){this.mediaPreview=peekPreviewImage(url);if(!this.mediaPreview&&!this.mediaPending){this.mediaPending=true;void loadPreviewImage(url).then(image=>{if(this.mediaUrl===url){this.mediaPreview=image;this.mediaPending=false;}});}}
    const image=url?(originals?overlayImage(url):this.mediaPreview):null;
    const ready = layer.media ? !!image&&image.width>0&&(!('complete' in image)||image.complete) : document.fonts.check(`${layer.weight} ${layer.size}px "${layer.font}"`);
    const active=layer.visible&&seconds>=layer.start&&seconds<layer.end;
    const motion=active?textMotion(layer,seconds):null;
    // Cache the actual appearance, not the clock. A settled entrance animation
    // must reuse the raster until its exit starts or its properties change.
    const signature = JSON.stringify([layer, width, height, scale, ready, active, motion, originals, fontRevision]);
    if (signature === this.signature) return false;
    this.signature = signature;
    const rw=Math.max(1,Math.round(width*scale)),rh=Math.max(1,Math.round(height*scale));
    if(this.source.width!==rw)this.source.width=rw;if(this.source.height!==rh)this.source.height=rh;
    this.canvas = this.compositor.render(this.source, [layer], width, height, seconds, originals, this.mediaPreview,true);
    if(layer.backdrop && !layer.media && (layer.backdropBlur??0)>0){
      this.maskCompositor??=new TextCompositor();
      this.maskCanvas=this.maskCompositor.render(this.source,[layer],width,height,seconds,originals,null,true,true);
    }else{this.maskCompositor?.destroy();this.maskCompositor=null;this.maskCanvas=null;}
    return true;
  }
  destroy() { this.mediaUrl='';this.mediaPreview=null;this.compositor.destroy();this.maskCompositor?.destroy();this.maskCanvas=null; this.source.width = this.source.height = 1; }
}
