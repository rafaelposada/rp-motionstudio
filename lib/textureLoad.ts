// Shared image-decode path for both renderers. Uploads are blob: URLs with no
// file extension, which library-level loaders (PIXI.Assets, THREE.TextureLoader
// routing) can mis-handle — decoding via HTMLImageElement is reliable for both.
const pendingImages = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  const pending = pendingImages.get(url);
  if (pending) return pending;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img
      .decode()
      .then(() => resolve(img))
      .catch(() => resolve(null)); // unreadable/revoked URL — caller keeps placeholder
  }).finally(() => { pendingImages.delete(url); });
  pendingImages.set(url, promise);
  return promise;
}

export type RenderImage = HTMLImageElement | HTMLCanvasElement;
export const PREVIEW_IMAGE_EDGE = 2048;
const MAX_PREVIEW_PIXELS = 24 * 1024 * 1024;
const previewImages = new Map<string, RenderImage>();
const pendingPreviews = new Map<string, Promise<RenderImage | null>>();
let previewPixels = 0, decoding = 0;
const decodeQueue: (() => void)[] = [];

export function previewImageSize(width: number, height: number, edge = PREVIEW_IMAGE_EDGE) {
  const scale = Math.min(1, edge / Math.max(1, width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function peekPreviewImage(url: string) { return previewImages.get(url) ?? null; }
export function clearPreviewImages() { previewImages.clear(); previewPixels = 0; }
export function loadPreviewImage(url: string): Promise<RenderImage | null> {
  const cached = previewImages.get(url);
  if (cached) { previewImages.delete(url); previewImages.set(url, cached); return Promise.resolve(cached); }
  const pending = pendingPreviews.get(url); if (pending) return pending;
  const promise = (async () => {
    // Bound full-size decodes when a batch of large photos is imported.
    await new Promise<void>(resolve => { const start = () => { decoding++; resolve(); }; if (decoding < 2) start(); else decodeQueue.push(start); });
    try {
      const image = await loadImage(url); if (!image) return null;
      const size = previewImageSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
      let source: RenderImage = image;
      if (size.width < image.width || size.height < image.height) {
        const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
        const ctx = canvas.getContext('2d'); if (!ctx) return null;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, size.width, size.height);
        source = canvas;
      }
      previewImages.set(url, source); previewPixels += source.width * source.height;
      while (previewPixels > MAX_PREVIEW_PIXELS && previewImages.size > 1) {
        const oldest = previewImages.keys().next().value!; const entry = previewImages.get(oldest)!;
        previewPixels -= entry.width * entry.height; previewImages.delete(oldest);
      }
      return source;
    } finally { decoding--; decodeQueue.shift()?.(); }
  })().catch(() => null).finally(() => pendingPreviews.delete(url));
  pendingPreviews.set(url, promise); return promise;
}
