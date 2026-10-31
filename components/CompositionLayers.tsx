'use client';
import { useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { compositionOrder } from '@/lib/composition';
import { moveCompositionLayer, deleteCompositionLayer, selectOverlayForEditing } from '@/lib/compositionActions';
import { idbPut, idbDelete } from '@/lib/assetDb';
import { ControlRow } from './Controls';
export default function CompositionLayers() {
  const layers = useSceneStore((s) => s.textLayers), tracks = useSceneStore((s) => s.tracks);
  const audioUrl = useSceneStore((s) => s.audioUrl);
  const selected = useUIStore((s) => s.selectedTextId), model = useUIStore((s) => s.selectedMotionId), show = useUIStore((s) => s.showSelectionBox);
  const pt = useUIStore((s) => s.locale) === 'pt', [status, setStatus] = useState('');
  const order = compositionOrder(tracks, layers), mediaLayer = layers.find((l) => l.id === selected && l.media);
  const upload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) { setStatus(pt ? 'Limite: 50 MB por imagem.' : 'Limit: 50 MB per image.'); return; }
    setStatus(pt ? 'Carregando imagem…' : 'Loading image…');
    const url = URL.createObjectURL(file), blobId = `overlay_${crypto.randomUUID()}`;
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth * image.naturalHeight > 60e6) throw new Error(pt ? 'Imagem muito grande: limite de 60 megapixels.' : 'Image too large: 60 megapixel limit.');
      await idbPut(blobId, file);
      const s = useSceneStore.getState(); s.addTextLayer(); const layer = useSceneStore.getState().textLayers.at(-1)!;
      const width = Math.min(s.width * .35, image.naturalWidth), height = width * image.naturalHeight / image.naturalWidth;
      s.patchTextLayer(layer.id, { text: file.name, z: Math.max(-1, ...order.map((l) => l.z)) + 1, media: { blobId, url, width, height, fit: 'contain' } });
      useUIStore.getState().selectText(layer.id); setStatus(pt ? 'Imagem estática adicionada.' : 'Static image added.');
    } catch (error) { URL.revokeObjectURL(url); await idbDelete(blobId).catch(() => {}); setStatus(error instanceof Error ? error.message : 'Falha ao carregar.'); }
  };
  return <details className="composition-panel" open><summary>{pt ? 'Camadas da composição' : 'Composition layers'} · {order.length}</summary>
    <label className="upload">{pt ? '+ Imagem avulsa / logotipo' : '+ Standalone image / logo'}<input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} /></label>
    <label className="upload">{audioUrl ? (pt ? 'Substituir trilha sonora' : 'Replace soundtrack') : (pt ? '+ Trilha sonora' : '+ Soundtrack')}<input type="file" accept="audio/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 100 * 1024 * 1024) { setStatus(pt ? 'Limite de áudio: 100 MB.' : 'Audio limit: 100 MB.'); return; } setStatus(pt ? 'Salvando trilha…' : 'Saving soundtrack…'); try { const audioBlobId = `aux_${crypto.randomUUID()}`; await idbPut(audioBlobId, file); useSceneStore.setState({ audioBlobId, audioUrl: URL.createObjectURL(file) }); setStatus(pt ? 'Trilha salva. Reproduza para ouvir.' : 'Soundtrack saved. Press Play to listen.'); } catch { setStatus(pt ? 'Não foi possível salvar o áudio.' : 'Could not save audio.'); } e.target.value = ''; }} /></label>
    {audioUrl && <button className="btn" onClick={() => useSceneStore.setState({ audioUrl: null, audioBlobId: undefined })}>{pt ? 'Remover trilha sonora' : 'Remove soundtrack'}</button>}
    <p role="status" className="ctl-hint">{status}</p>
    <div className="composition-list">{[...order].reverse().map((item, i) => { const overlay = layers.find((l) => l.id === item.id), track = tracks.find((l) => l.id === item.id), name = overlay?.text || track?.name || '', visible = overlay?.visible ?? track?.visible; return <div key={item.id} className={`composition-row ${selected === item.id || model === item.id ? 'selected' : ''}`}>
      <button className="composition-name" title={name} onClick={() => { if (overlay) selectOverlayForEditing(item.id); else { useSceneStore.getState().setActiveTrack(item.id); useUIStore.getState().selectMotion(item.id); } }}>{overlay ? (overlay.media ? '▧ ' : 'T ') : '▥ '}{name}</button>
      <button aria-label={`${pt ? 'Visibilidade' : 'Visibility'}: ${name}`} onClick={() => overlay ? useSceneStore.getState().patchTextLayer(item.id, { visible: !visible }) : useSceneStore.getState().patchTrack(item.id, { visible: !visible })}>{visible ? '◉' : '○'}</button>
      <button aria-label={`${pt ? 'Trazer à frente' : 'Bring forward'}: ${name}`} disabled={i === 0} onClick={() => moveCompositionLayer(item.id, 1)}>↑</button><button aria-label={`${pt ? 'Enviar atrás' : 'Send backward'}: ${name}`} disabled={i === order.length - 1} onClick={() => moveCompositionLayer(item.id, -1)}>↓</button>
      <button aria-label={`${pt ? 'Excluir camada' : 'Delete layer'}: ${name}`} onClick={() => deleteCompositionLayer(item.id)}>×</button>
    </div>; })}</div>
    <label className="ctl-hint"><input type="checkbox" checked={show} onChange={(e) => useUIStore.getState().setShowSelectionBox(e.target.checked)} /> {pt ? 'Mostrar caixa delimitadora' : 'Show bounding box'}</label>
    <p className="ctl-hint">{pt ? 'Topo da lista = frente da composição. As setas misturam textos, modelos e imagens. No modo Modelo único, os demais modelos continuam fora da composição.' : 'Top = front. Arrows mix text, models and images. In Single model mode, other models remain excluded.'}</p>
    {mediaLayer?.media && <><strong>{pt ? 'Imagem estática selecionada' : 'Selected static image'}</strong>{(['width', 'height'] as const).map((axis) => <ControlRow key={axis} def={{ key: axis, label: axis === 'width' ? (pt ? 'Largura da imagem' : 'Image width') : (pt ? 'Altura da imagem' : 'Image height'), type: 'slider', min: 1, max: 4000, step: 1, default: 200 }} value={mediaLayer.media![axis]} onChange={(value) => useSceneStore.getState().patchTextLayer(mediaLayer.id, { media: { ...mediaLayer.media!, [axis]: value } })} />)}
    {(['x', 'y', 'rotation', 'opacity'] as const).map((key) => <ControlRow key={key} def={{ key, label: key === 'opacity' ? (pt ? 'Opacidade' : 'Opacity') : key === 'rotation' ? (pt ? 'Rotação' : 'Rotation') : `Posição ${key.toUpperCase()}`, type: 'slider', min: key === 'opacity' ? 0 : -4000, max: key === 'opacity' ? 1 : 4000, step: key === 'opacity' ? .01 : 1, default: 0 }} value={mediaLayer[key]} onChange={(value) => useSceneStore.getState().patchTextLayer(mediaLayer.id, { [key]: value })} />)}
    <label className="text-edit-label">{pt ? 'Preenchimento' : 'Fit'}<select className="field" value={mediaLayer.media.fit} onChange={(e) => useSceneStore.getState().patchTextLayer(mediaLayer.id, { media: { ...mediaLayer.media!, fit: e.target.value as 'contain' | 'cover' | 'stretch' } })}><option value="contain">{pt ? 'Ajustar · preservar proporção' : 'Fit · preserve aspect'}</option><option value="cover">{pt ? 'Preencher · recortar' : 'Fill · crop'}</option><option value="stretch">{pt ? 'Esticar' : 'Stretch'}</option></select></label></>}
  </details>;
}
