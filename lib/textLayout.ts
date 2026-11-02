// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// One line layout for preview, export and selection bounds: paragraphs, inline
// styles, letter spacing, Framer-style wrapping inside a fixed box width and
// justified lines. Offsets are UTF-16 indices into layer.text.
import { resolvedTextSpans, type InlineStyle } from './richText';
import type { TextLayer, TextAlign, TextWrap } from './textLayers';

export interface LayoutSegment { text: string; start: number; font: string; x: number; width: number; style: Required<InlineStyle> }
export interface LayoutLine { segments: LayoutSegment[]; width: number }
export interface TextLayout { lines: LayoutLine[]; width: number }

interface Token { text: string; start: number; font: string; width: number; space: boolean; style: Required<InlineStyle>; chars: number }

const fontFor = (style: Required<InlineStyle>, size: number) => `${style.weight} ${size}px "${style.font}", sans-serif`;
// Where the text box sits relative to layer.x. Auto-width left/right text keeps
// its legacy edge anchor; a fixed box (and justified text) stays centered on x,
// so changing alignment moves the lines, never the box — as in Framer.
export const anchorAlign = (layer: Pick<TextLayer, 'align' | 'boxWidth'>): 'left' | 'center' | 'right' => layer.boxWidth && layer.boxWidth > 0 || layer.align === 'justify' ? 'center' : layer.align as 'left' | 'center' | 'right';
export const boxLeft = (layer: Pick<TextLayer, 'align' | 'boxWidth'>, width: number) => { const anchor = anchorAlign(layer); return anchor === 'center' ? -width / 2 : anchor === 'right' ? -width : 0; };
export const lineOffset = (align: TextAlign, box: number, line: number) => align === 'center' ? (box - line) / 2 : align === 'right' ? box - line : 0;
export const canvasAlign = (align: TextAlign): CanvasTextAlign => align === 'justify' ? 'left' : align;

function tokens(ctx: CanvasRenderingContext2D, layer: TextLayer, start: number, end: number, size: number, spacing: number) {
  const out: Token[] = [];
  for (const span of resolvedTextSpans(layer, start, end)) {
    const style = span.style as Required<InlineStyle>, font = fontFor(style, size);
    ctx.font = font;
    let offset = span.start;
    for (const part of span.text.split(/(\s+)/)) {
      if (!part) continue;
      const chars = [...part].length;
      out.push({ text: part, start: offset, font, style, chars, space: /^\s+$/.test(part), width: ctx.measureText(part).width + chars * spacing });
      offset += part.length;
    }
  }
  return out;
}

// A word wider than the box is split between characters.
function splitLong(ctx: CanvasRenderingContext2D, token: Token, max: number, spacing: number) {
  ctx.font = token.font;
  const pieces: Token[] = [];
  let text = '', start = token.start, width = 0, offset = token.start;
  for (const char of [...token.text]) {
    const w = ctx.measureText(char).width + spacing;
    if (text && width + w > max) { pieces.push({ ...token, text, start, width, chars: [...text].length }); text = ''; width = 0; start = offset; }
    text += char; width += w; offset += char.length;
  }
  if (text) pieces.push({ ...token, text, start, width, chars: [...text].length });
  return pieces;
}

function greedy(ctx: CanvasRenderingContext2D, list: Token[], max: number, spacing: number) {
  const lines: Token[][] = [];
  let line: Token[] = [], width = 0;
  const push = () => { while (line.length && line.at(-1)!.space) line.pop(); lines.push(line); line = []; width = 0; };
  for (const token of list) {
    if (token.space) { if (line.length) { line.push(token); width += token.width; } continue; }
    const pieces = token.width - spacing > max ? splitLong(ctx, token, max, spacing) : [token];
    for (const piece of pieces) {
      if (line.length && width + piece.width - spacing > max) push();
      line.push(piece); width += piece.width;
    }
  }
  push();
  return lines;
}

const wordsIn = (line: Token[]) => line.filter((token) => !token.space).length;

function wrapParagraph(ctx: CanvasRenderingContext2D, list: Token[], max: number, mode: TextWrap, spacing: number) {
  const base = greedy(ctx, list, max, spacing);
  if (base.length < 2 || mode === 'auto') return base;
  const widest = Math.max(...list.filter((t) => !t.space).map((t) => t.width - spacing), 1);
  if (mode === 'balance') {
    // The narrowest width that keeps the same number of lines evens them out.
    let lo = Math.min(widest, max), hi = max;
    for (let i = 0; i < 18 && hi - lo > .5; i++) { const mid = (lo + hi) / 2; if (greedy(ctx, list, mid, spacing).length <= base.length) hi = mid; else lo = mid; }
    return greedy(ctx, list, hi, spacing);
  }
  // Pretty: avoid a single orphan word on the last line when a slightly
  // narrower measure fixes it without adding lines.
  if (wordsIn(base.at(-1)!) > 1) return base;
  let lo = Math.max(widest, max * .6), hi = max, best = base;
  for (let i = 0; i < 18 && hi - lo > .5; i++) {
    const mid = (lo + hi) / 2, lines = greedy(ctx, list, mid, spacing);
    if (lines.length > base.length) lo = mid;
    else { if (wordsIn(lines.at(-1)!) > 1) best = lines; hi = mid; }
  }
  return best;
}

export function layoutText(ctx: CanvasRenderingContext2D, layer: TextLayer, size = layer.size): TextLayout {
  const spacing = layer.letterSpacing ?? 0, box = layer.boxWidth && layer.boxWidth > 0 ? layer.boxWidth : 0;
  const rows: { tokens: Token[]; last: boolean }[] = [];
  let offset = 0;
  for (const paragraph of layer.text.split('\n')) {
    const list = tokens(ctx, layer, offset, offset + paragraph.length, size, spacing);
    offset += paragraph.length + 1;
    const wrapped = box ? wrapParagraph(ctx, list, box, layer.wrap ?? 'auto', spacing) : [list];
    wrapped.forEach((line, index) => rows.push({ tokens: line, last: index === wrapped.length - 1 }));
  }
  const measured = rows.map((row) => ({ ...row, width: Math.max(0, row.tokens.reduce((sum, t) => sum + t.width, 0) - (row.tokens.length ? spacing : 0)) }));
  const width = box || Math.max(0, ...measured.map((row) => row.width));
  const lines = measured.map(({ tokens: list, last, width: natural }) => {
    const spaces = list.filter((t) => t.space).length;
    const extra = layer.align === 'justify' && !last && spaces ? Math.max(0, width - natural) / spaces : 0;
    const segments: LayoutSegment[] = [];
    let x = 0;
    for (const token of list) {
      if (spacing && !token.space) {
        // Letter spacing is drawn per character, like the original renderer.
        ctx.font = token.font;
        let start = token.start;
        for (const char of [...token.text]) { const w = ctx.measureText(char).width; segments.push({ text: char, start, font: token.font, x, width: w, style: token.style }); x += w + spacing; start += char.length; }
      } else {
        segments.push({ text: token.text, start: token.start, font: token.font, x, width: token.width, style: token.style });
        x += token.width + (token.space ? extra : 0);
      }
    }
    return { segments, width: extra ? width : natural };
  });
  return { lines, width };
}
