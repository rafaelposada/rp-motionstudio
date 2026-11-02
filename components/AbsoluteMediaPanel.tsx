// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useState } from 'react';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { idbPut, idbDelete } from '@/lib/assetDb';
import { ControlRow } from './Controls';
import { BlendRow } from './BlendSelect';
import LayerAnimationControls from './LayerAnimationControls';
export default function AbsoluteMediaPanel() {
  const layers = useSceneStore((s) => s.textLayers);
  const audioUrl = useSceneStore((s) => s.audioUrl);
  const audioSettings = useSceneStore(s => s.audioSettings), duration = useSceneStore(s => s.duration);
  const selected = useUIStore((s) => s.selectedTextId);
  const pt = useUIStore((s) => s.locale) === 'pt', [status, setStatus] = useState('');
  const mediaLayer = layers.find((l) => l.id === selected && l.media);
  const uploadAudio = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) { setStatus(pt ? 'Limite de áudio: 100 MB.' : 'Audio limit: 100 MB.'); return; }
    const revision = sceneRestoreRevision(), audioBlobId = `aux_${crypto.randomUUID()}`;
    setStatus(pt ? 'Salvando trilha…' : 'Saving audio…');
    try {
      await idbPut(audioBlobId, file);
      if (revision !== sceneRestoreRevision()) { await idbDelete(audioBlobId); return; }
      useSceneStore.setState({ audioBlobId, audioUrl: URL.createObjectURL(file) });
      setStatus(pt ? 'Trilha salva. Reproduza para ouvir.' : 'Audio saved. Press Play to listen.');
    } catch { setStatus(pt ? 'Não foi possível salvar o áudio.' : 'Could not save audio.'); }
  };
  const upload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) { setStatus(pt ? 'Limite: 50 MB por imagem.' : 'Limit: 50 MB per image.'); return; }
    setStatus(pt ? 'Carregando imagem…' : 'Loading image…');
    const url = URL.createObjectURL(file), blobId = `overlay_${crypto.randomUUID()}`;
    const revision = sceneRestoreRevision();
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth * image.naturalHeight > 60e6) throw new Error(pt ? 'Imagem muito grande: limite de 60 megapixels.' : 'Image too large: 60 megapixel limit.');
      await idbPut(blobId, file);
      if (revision !== sceneRestoreRevision()) { URL.revokeObjectURL(url); await idbDelete(blobId); return; }
      const s = useSceneStore.getState(); s.addTextLayer(); const layer = useSceneStore.getState().textLayers.at(-1)!;
      const width = Math.min(s.width * .35, image.naturalWidth), height = width * image.naturalHeight / image.naturalWidth;
      s.patchTextLayer(layer.id, { text: file.name, media: { blobId, url, width, height, fit: 'contain' } });
      useUIStore.getState().selectText(layer.id); setStatus(pt ? 'Imagem estática adicionada.' : 'Static image added.');
    } catch (error) { URL.revokeObjectURL(url); await idbDelete(blobId).catch(() => {}); setStatus(error instanceof Error ? error.message : 'Falha ao carregar.'); }
  };
  return <section className="absolute-media-panel"><h3>{pt ? 'Imagem absoluta e áudio' : 'Absolute image and audio'}</h3>
    <label className="upload">{pt ? '+ Imagem absoluta' : '+ Absolute image'}<input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} /></label>
    <label className="upload">{audioUrl ? (pt ? 'Substituir áudio' : 'Replace audio') : (pt ? '+ Áudio' : '+ Audio')}<input type="file" accept="audio/*" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadAudio(file); }} /></label>
    {audioUrl && <><ControlRow def={{key:'audioVolume',label:pt?'Volume do áudio':'Audio volume',type:'slider',min:0,max:100,step:1,unit:'%',default:100}} value={audioSettings.volume*100} onChange={value=>useSceneStore.setState({audioSettings:{...audioSettings,volume:Number(value)/100}})}/>
      {(['fadeIn','fadeOut'] as const).map(key=><ControlRow key={key} def={{key:key==='fadeIn'?'audioFadeIn':'audioFadeOut',label:key==='fadeIn'?(pt?'Aparecimento gradual do áudio':'Audio fade in'):(pt?'Desaparecimento gradual do áudio':'Audio fade out'),type:'slider',min:0,max:duration/2,step:.01,unit:'s',default:0}} value={audioSettings[key]} onChange={value=>useSceneStore.setState({audioSettings:{...audioSettings,[key]:Number(value)}})}/>)}
      <button className="btn" onClick={() => useSceneStore.setState({ audioUrl: null, audioBlobId: undefined })}>{pt ? 'Remover áudio' : 'Remove audio'}</button></>}
    <p role="status" className="ctl-hint">{status}</p>
    {mediaLayer?.media && <><strong>{pt ? 'Imagem estática selecionada' : 'Selected static image'}</strong>{(['width', 'height'] as const).map((axis) => <ControlRow key={axis} def={{ key: axis, label: axis === 'width' ? (pt ? 'Largura da imagem' : 'Image width') : (pt ? 'Altura da imagem' : 'Image height'), type: 'slider', min: 1, max: 4000, step: 1, default: 200 }} value={mediaLayer.media![axis]} onChange={(value) => useSceneStore.getState().patchTextLayer(mediaLayer.id, { media: { ...mediaLayer.media!, [axis]: value } })} />)}
    {(['x', 'y', 'rotation'] as const).map((key) => <ControlRow key={key} def={{ key, label:key==='rotation'?(pt?'Rotação':'Rotation'):`${pt?'Posição':'Position'} ${key.toUpperCase()}`, type:'slider',min:-4000,max:4000,step:1,default:0 }} value={mediaLayer[key]} onChange={value=>useSceneStore.getState().patchTextLayer(mediaLayer.id,{[key]:Number(value)})}/>)}
    <ControlRow def={{key:'opacity',label:pt?'Opacidade':'Opacity',type:'slider',min:0,max:100,step:1,unit:'%',default:100}} value={mediaLayer.opacity*100} onChange={value=>useSceneStore.getState().patchTextLayer(mediaLayer.id,{opacity:Number(value)/100})}/>
    <BlendRow value={mediaLayer.blend} onChange={blend=>useSceneStore.getState().patchTextLayer(mediaLayer.id,{blend})}/>
    <ControlRow def={{key:'imageCorners',label:pt?'Arredondar todos os cantos':'Round all corners',type:'slider',min:0,max:Math.min(mediaLayer.media.width,mediaLayer.media.height)/2,step:1,unit:'px',default:0}} value={mediaLayer.media.cornerRadii?.[0]??0} onChange={value=>{const r=Number(value);useSceneStore.getState().patchTextLayer(mediaLayer.id,{media:{...mediaLayer.media!,cornerRadii:[r,r,r,r]}});}}/>
    <LayerAnimationControls layer={mediaLayer} pt={pt}/>
    <p className="ctl-hint">{pt?'Arraste os círculos internos na tela para arredondar. Alt ajusta somente o canto arrastado.':'Drag the inner circles to round corners. Alt changes only the dragged corner.'}</p>
    <label className="text-edit-label">{pt ? 'Preenchimento' : 'Fit'}<select className="field" value={mediaLayer.media.fit} onChange={(e) => useSceneStore.getState().patchTextLayer(mediaLayer.id, { media: { ...mediaLayer.media!, fit: e.target.value as 'contain' | 'cover' | 'stretch' } })}><option value="contain">{pt ? 'Ajustar · preservar proporção' : 'Fit · preserve aspect'}</option><option value="cover">{pt ? 'Preencher · recortar' : 'Fill · crop'}</option><option value="stretch">{pt ? 'Esticar' : 'Stretch'}</option></select></label></>}
  </section>;
}

