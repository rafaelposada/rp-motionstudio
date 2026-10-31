import type { Template } from '@/lib/types';

const BASE = 340;

// Static by default for existing compositions, with optional rigid floating
// motion. Grid pitch is measured in final canvas pixels, exactly once.
const blank: Template = {
  meta: { id: 'blank-01', name: 'Canvas 01', group: 'Canvas', staticByDefault: true, defaultEasing: { id: 'linear' } },

  controls: [
    { key: 'count',        label: 'Count',         type: 'slider', min: 1, max: 12, step: 1,   default: 4 },
    { key: 'cols',         label: 'Columns',       type: 'slider', min: 1, max: 6, step: 1,    default: 2 },
    { key: 'cardSize',     label: 'Plane Size',    type: 'slider', min: 50, max: 500, step: 1, default: 220 },
    { key: 'cornerRadius', label: 'Corner Radius', type: 'slider', min: 0, max: 100, step: 1,  default: 14 },
    { key: 'gap',          label: 'Gap',           type: 'slider', min: 0, max: 200, step: 1,  default: 40 },
    { key: 'offset',       label: 'Offset',        type: 'xypad',                              default: { x: 0, y: 0 } },
    { key: 'motion',       label: 'Motion',        type: 'pills', options: ['static','float'], default: 'static', section: 'Motion' },
    { key: 'amplitude',    label: 'Amplitude',     type: 'slider', min: 0, max: 60, step: 1, default: 12, unit: 'px', section: 'Motion', visibleWhen: { key: 'motion', equals: 'float' } },
  ],

  transform: (frame, index, count, v, ctx) => {
    const sizeFactor = v.cardSize / BASE;
    const cols = Math.min(count, Math.max(1, Math.round(v.cols)));
    const rows = Math.ceil(count / cols);
    const col = index % cols;
    const row = Math.floor(index / cols);

    const aspect = ctx.cardAspect ?? 4 / 5;
    const spacingX = v.cardSize * Math.min(1, aspect) + v.gap;
    const spacingY = v.cardSize * Math.min(1, 1 / aspect) + v.gap;
    const rowItems = Math.min(cols, count - row * cols);
    const phase = Math.PI * 2 * frame / Math.max(1, ctx.totalFrames);
    const amplitude = v.motion === 'float' ? Math.max(0, Number(v.amplitude ?? 12)) : 0;
    const x = (col - (rowItems - 1) / 2) * spacingX + v.offset.x + Math.sin(phase) * amplitude;
    const y = (row - (rows - 1) / 2) * spacingY + v.offset.y + Math.sin(phase * 2) * amplitude * .5;

    return {
      x,
      y,
      scale: sizeFactor,
      rotation: 0,
      alpha: 1,
      depth: index,
    };
  },
};

export const blankVariants: Template[] = [blank];
