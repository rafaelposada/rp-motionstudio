// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useEffect, useRef, useState } from 'react';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { idbDelete, idbPut } from '@/lib/assetDb';
import { coverCrop, DEFAULT_FOCUS, type CropFocus, type MediaFit } from '@/lib/crop';
import { shapeVideo, type ShapeMedia } from '@/lib/shapeFill';
import { loadPreviewImage } from '@/lib/textureLoad';
import type { TextLayer } from '@/lib/textLayers';
import { ControlRow } from './Controls';
import { tx } from '@/lib/tx';

const FITS: { mode: MediaFit; pt: string; en: string; hintPt: string; hintEn: string }[] = [
  { mode: 'fill', pt: 'Preencher', en: 'Fill', hintPt: 'Preenche a forma sem deformar; pode recortar as bordas.', hintEn: 'Fills the shape without distortion; edges may be cropped.' },
  { mode: 'fit', pt: 'Ajustar', en: 'Fit', hintPt: 'Mostra a mídia inteira sem deformar.', hintEn: 'Shows the entire media without distortion.' },
  { mode: 'stretch', pt: 'Esticar', en: 'Stretch', hintPt: 'Preenche toda a forma esticando a mídia.', hintEn: 'Fills the whole shape by stretching the media.' },
];
const FOCUS_CELLS: CropFocus[] = [0, .5, 1].flatMap((y) => [0, .5, 1].map((x) => ({ x, y })));
const IMAGE_LIMIT = 50 * 1024 * 1024, VIDEO_LIMIT = 300 * 1024 * 1024;

async function mediaSize(url: string, kind: ShapeMedia['kind']) {
  if (kind === 'image') { const image = new Image(); image.src = url; await image.decode(); if (image.naturalWidth * image.naturalHeight > 60e6) throw new Error('60 MP'); return { width: image.naturalWidth, height: image.naturalHeight }; }
  const video = document.createElement('video'); video.preload = 'metadata'; video.muted = true; video.src = url;
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('video')); });
  const size = { width: video.videoWidth, height: video.videoHeight }; video.removeAttribute('src'); video.load(); return size;
}

// Photo or video inside a shape: upload, fill/fit/stretch, focal point,
// drag-to-frame and zoom — the same controls the cards use.
export default function ShapeMediaFill({ layer, pt }: { layer: TextLayer; pt: boolean }) {
  const media = layer.shape?.media, [status, setStatus] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null), drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const patchMedia = (change: Partial<ShapeMedia>) => { const shape = useSceneStore.getState().textLayers.find((l) => l.id === layer.id)?.shape; if (shape?.media) useSceneStore.getState().patchTextLayer(layer.id, { shape: { ...shape, media: { ...shape.media, ...change } } }); };
  const focus = media?.crop ?? DEFAULT_FOCUS, fit = media?.fit ?? 'fill';
  const w = Math.abs(layer.shape?.width ?? 1), h = Math.abs(layer.shape?.height ?? 1), aspect = w / Math.max(1, h);

  const upload = async (file: File) => {
    const kind: ShapeMedia['kind'] = file.type.startsWith('video/') ? 'video' : 'image';
    if (file.size > (kind === 'video' ? VIDEO_LIMIT : IMAGE_LIMIT)) { setStatus(kind === 'video' ? tx(pt, 'Limite: 300 MB por vídeo.', 'Limit: 300 MB per video.') : tx(pt, 'Limite: 50 MB por imagem.', 'Limit: 50 MB per image.')); return; }
    setStatus(tx(pt, 'Carregando mídia…', 'Loading media…'));
    const url = URL.createObjectURL(file), blobId = `shapefill_${crypto.randomUUID()}`, revision = sceneRestoreRevision();
    try {
      const size = await mediaSize(url, kind);
      await idbPut(blobId, file);
      if (revision !== sceneRestoreRevision()) { URL.revokeObjectURL(url); await idbDelete(blobId); return; }
      const shape = useSceneStore.getState().textLayers.find((l) => l.id === layer.id)?.shape; if (!shape) return;
      useSceneStore.getState().patchTextLayer(layer.id, { shape: { ...shape, media: { blobId, url, kind, ...size, name: file.name, fit: shape.media?.fit ?? 'fill' } } });
      setStatus(kind === 'video' ? tx(pt, 'Vídeo aplicado. Ele começa quando a camada aparece.', 'Video applied. It starts when the layer appears.') : tx(pt, 'Imagem aplicada.', 'Image applied.'));
    } catch (error) {
      URL.revokeObjectURL(url); await idbDelete(blobId).catch(() => {});
      setStatus(error instanceof Error && error.message === '60 MP' ? tx(pt, 'Imagem muito grande: limite de 60 megapixels.', 'Image too large: 60 megapixel limit.') : tx(pt, 'Não foi possível abrir este arquivo.', 'Could not open this file.'));
    }
  };

  useEffect(() => {
    const output = canvas.current; if (!media?.url || !output || fit !== 'fill') return;
    let current = true;
    const paint = (source: CanvasImageSource, sw: number, sh: number) => {
      if (!current || !sw || !sh) return;
      output.width = 480; output.height = Math.max(1, Math.round(480 / aspect));
      const crop = coverCrop(sw, sh, aspect, focus);
      output.getContext('2d')?.drawImage(source, crop.fx, crop.fy, crop.fw, crop.fh, 0, 0, output.width, output.height);
    };
    if (media.kind === 'video') {
      const video = shapeVideo(media.url), draw = () => paint(video, video.videoWidth, video.videoHeight);
      if (video.readyState >= 2) draw();
      video.addEventListener('loadeddata', draw); video.addEventListener('seeked', draw);
      return () => { current = false; video.removeEventListener('loadeddata', draw); video.removeEventListener('seeked', draw); };
    }
    void loadPreviewImage(media.url).then((image) => { if (image) paint(image, image.width, image.height); });
    return () => { current = false; };
  }, [media?.url, media?.kind, fit, aspect, focus]);

  return <div className="shape-media-fill">
    <label className="upload">{media ? tx(pt, 'Trocar foto ou vídeo', 'Replace photo or video') : tx(pt, '+ Foto ou vídeo', '+ Photo or video')}
      <input type="file" accept="image/*,video/*" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }} /></label>
    {status && <p role="status" className="ctl-hint">{status}</p>}
    {media && <>
      <p className="ctl-hint shape-media-name">{media.kind === 'video' ? '▶' : '▧'} {media.name ?? tx(pt, 'Mídia', 'Media')}</p>
      <div className="media-fit-pills" role="group" aria-label={tx(pt, 'Preenchimento da mídia', 'Media fit')}>
        {FITS.map((f) => <button key={f.mode} type="button" className={fit === f.mode ? 'active' : ''} aria-pressed={fit === f.mode} title={tx(pt, f.hintPt, f.hintEn)} onClick={() => patchMedia({ fit: f.mode })}>{tx(pt, f.pt, f.en)}</button>)}
      </div>
      {fit === 'fill' && <div className="media-framing">
        <canvas ref={canvas} aria-label={tx(pt, 'Arraste para enquadrar', 'Drag to reframe')} style={{ aspectRatio: String(aspect) }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, fx: focus.x, fy: focus.y }; }}
          onPointerMove={(e) => { const start = drag.current; if (!start) return; const rect = e.currentTarget.getBoundingClientRect(); patchMedia({ crop: { ...focus, x: Math.max(0, Math.min(1, start.fx - (e.clientX - start.x) / rect.width)), y: Math.max(0, Math.min(1, start.fy - (e.clientY - start.y) / rect.height)) } }); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
        <span className="ctl-hint">{tx(pt, 'Arraste a imagem para reposicionar dentro da forma.', 'Drag to reposition inside the shape.')}</span>
        <div className="shape-media-focus"><span className="ctl-hint">{tx(pt, 'Ponto focal', 'Focal point')}</span>
          <div className="crop-grid">{FOCUS_CELLS.map((c) => <button key={`${c.x}-${c.y}`} type="button" className={`crop-cell ${focus.x === c.x && focus.y === c.y ? 'active' : ''}`} aria-label={`${tx(pt, 'Ponto focal', 'Focal point')} ${c.x * 2 + 1}, ${c.y * 2 + 1}`} onClick={() => patchMedia({ crop: { ...focus, x: c.x, y: c.y } })} />)}</div>
        </div>
      </div>}
      {fit !== 'stretch' && <ControlRow def={{ key: 'shapeMediaZoom', label: 'Zoom', type: 'slider', min: 1, max: 4, step: .01, default: 1 }} value={focus.zoom ?? 1} onChange={(zoom) => patchMedia({ crop: { ...focus, zoom: Number(zoom) } })} />}
      <div className="inspector-actions">
        {fit !== 'stretch' && <button type="button" className="link-btn" onClick={() => patchMedia({ crop: { ...DEFAULT_FOCUS, zoom: 1 } })}>{tx(pt, 'Redefinir enquadramento', 'Reset framing')}</button>}
        <button type="button" className="link-btn" onClick={() => { const shape = useSceneStore.getState().textLayers.find((l) => l.id === layer.id)?.shape; if (shape) useSceneStore.getState().patchTextLayer(layer.id, { shape: { ...shape, media: undefined, fill: shape.fill ?? '#ffffff' } }); setStatus(''); }}>{tx(pt, 'Remover mídia', 'Remove media')}</button>
      </div>
    </>}
  </div>;
}
