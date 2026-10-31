import type { Template } from '@/lib/types';
// Compatibility only: keep existing saved compositions readable after the
// AI creator is removed. This preset remains absent from the library picker.
export const reelClip: Template = {
  meta: { id: 'reel-clip', name: 'Foto · legado', group: 'Compatibilidade', cardAspect: 'canvas', catalogHidden: true },
  controls: [
    { key: 'count', label: 'Count', type: 'slider', min: 1, max: 1, step: 1, default: 1 },
    { key: 'zoom', label: 'Zoom Amount', type: 'slider', min: 0, max: 20, step: 0.1, default: 6 },
  ],
  transform: (frame, index, count, values, ctx) => ({
    x: 0, y: 0, rotation: 0, alpha: 1, depth: index,
    scale: Math.max(ctx.width, ctx.height) / 340 * (1 + (Number(values.zoom) / 100) * (0.5 - 0.5 * Math.cos(2 * Math.PI * frame / Math.max(1, ctx.totalFrames)))),
  }),
};
