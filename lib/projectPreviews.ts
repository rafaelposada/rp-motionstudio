// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { idbGet, idbPut } from './assetDb';

export const projectPreviewKey = (id: string) => `project-preview:${id}`;

// Small, local contact sheets. Opening Home never instantiates a renderer for
// each recent project or decodes its original photos and videos.
export async function saveProjectPreview(id: string, source: HTMLCanvasElement | null | undefined) {
  if (!source?.width || !source.height) return;
  const canvas = document.createElement('canvas');
  canvas.width = 360; canvas.height = 240;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = '#17181b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(336 / source.width, 216 / source.height);
  const width = source.width * scale, height = source.height * scale;
  ctx.drawImage(source, (360 - width) / 2, (240 - height) / 2, width, height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .78));
  if (blob) await idbPut(projectPreviewKey(id), blob);
}

export const loadProjectPreview = (id: string) => idbGet(projectPreviewKey(id));
