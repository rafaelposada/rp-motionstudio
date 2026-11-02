// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef, useState } from 'react';
import { useSceneStore, type AssetItem } from '@/store/useSceneStore';
import { getTemplate } from '@/templates';
import { cardAspectFor, coverCrop, DEFAULT_FOCUS } from '@/lib/crop';
import { useI18n } from '@/lib/useI18n';
import { ControlRow } from './Controls';

export default function MediaFraming({ asset }: { asset: AssetItem }) {
  const { locale } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const width = useSceneStore((s) => s.width);
  const height = useSceneStore((s) => s.height);
  const values = useSceneStore((s) => s.values);
  const templateId = useSceneStore((s) => s.activeTemplateId);
  const shape = useSceneStore((s) => s.cardShape);
  const setCrop = useSceneStore((s) => s.setAssetCrop);
  const focus = asset.crop ?? DEFAULT_FOCUS;
  const [slot, setSlot] = useState(0);
  const [status, setStatus] = useState('');
  const slotCount = Math.max(1, Math.min(500, Number(values.count ?? 1)));
  const template = getTemplate(templateId);
  const aspect = template.slotAspect?.(Math.min(slot, slotCount - 1), values, width, height) ?? cardAspectFor(template.meta, width, height, shape);
  const transformImage = async (mode: 'rotate' | 'flipX' | 'flipY') => {
    const img = image.current; if (!img) return;
    try {
      if (img.naturalWidth * img.naturalHeight > 40000000) throw new Error('Imagem muito grande para transformar com segurança.');
      const output = document.createElement('canvas');
      output.width = mode === 'rotate' ? img.naturalHeight : img.naturalWidth;
      output.height = mode === 'rotate' ? img.naturalWidth : img.naturalHeight;
      const ctx = output.getContext('2d')!;
      ctx.translate(output.width / 2, output.height / 2);
      if (mode === 'rotate') ctx.rotate(Math.PI / 2);
      if (mode === 'flipX') ctx.scale(-1, 1);
      if (mode === 'flipY') ctx.scale(1, -1);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((b) => b ? resolve(b) : reject(new Error('Falha ao transformar imagem.')), 'image/png'));
      const state = useSceneStore.getState(); const index = state.assets.findIndex((item) => item.id === asset.id);
      if (index >= 0) state.replaceAssetAt(index, { name: asset.name.replace(/\.[^.]+$/, '') + '.png', kind: 'image', blob, url: URL.createObjectURL(blob) });
    } catch (error) { setStatus(String(error)); }
  };
  useEffect(() => {
    if (asset.kind === 'video') return;
    let current = true;
    const img = new Image(); img.src = asset.url;
    img.decode().then(() => { if (current) { image.current = img; paint(); } }).catch(() => {});
    function paint() {
      const output = canvas.current; if (!output) return;
      output.width = 480; output.height = Math.round(480 / aspect);
      const crop = coverCrop(img.naturalWidth, img.naturalHeight, aspect, focus);
      output.getContext('2d')?.drawImage(img, crop.fx, crop.fy, crop.fw, crop.fh, 0, 0, output.width, output.height);
    }
    return () => { current = false; };
  }, [asset.url, asset.kind, aspect, focus]);
  if ((asset.fit ?? 'fill') !== 'fill') return null;
  return <div className="media-framing">
    {template.slotAspect && <label className="text-edit-label">{locale === 'pt' ? 'Prévia do cartão' : 'Card preview'}<select className="field" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>{Array.from({ length: slotCount }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></label>}
    {asset.kind !== 'video' && <canvas ref={canvas} aria-label={locale === 'pt' ? 'Arraste para enquadrar' : 'Drag to reframe'} style={{ aspectRatio: String(aspect) }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, fx: focus.x, fy: focus.y }; }}
      onPointerMove={(e) => { const start = drag.current; if (!start) return; const rect = e.currentTarget.getBoundingClientRect(); setCrop(asset.id, { ...focus, x: Math.max(0, Math.min(1, start.fx - (e.clientX - start.x) / rect.width)), y: Math.max(0, Math.min(1, start.fy - (e.clientY - start.y) / rect.height)) }); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />}
    <span className="ctl-hint">{locale === 'pt' ? 'Arraste a imagem para reposicionar. O enquadramento pode variar conforme a proporção de cada cartão.' : 'Drag to reposition. Framing may vary with each card’s aspect.'}</span>
    {asset.kind !== 'video' && <div className="inspector-actions"><button className="link-btn" onClick={() => void transformImage('rotate')}>↻ 90°</button><button className="link-btn" onClick={() => void transformImage('flipX')}>{locale === 'pt' ? 'Espelhar H' : 'Flip H'}</button><button className="link-btn" onClick={() => void transformImage('flipY')}>{locale === 'pt' ? 'Espelhar V' : 'Flip V'}</button></div>}
    {status && <p role="status" className="ctl-hint">{status}</p>}
    <ControlRow def={{ key: 'cropZoom', label: 'Zoom', type: 'slider', min: 1, max: 4, step: 0.01, default: 1 }} value={focus.zoom ?? 1} onChange={(zoom) => setCrop(asset.id, { ...focus, zoom })} />
    <button className="link-btn" onClick={() => setCrop(asset.id, { ...DEFAULT_FOCUS, zoom: 1 })}>{locale === 'pt' ? 'Redefinir enquadramento' : 'Reset framing'}</button>
  </div>;
}
