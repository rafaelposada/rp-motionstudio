// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useState } from 'react';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { idbPut, idbDelete } from '@/lib/assetDb';
import { ControlRow } from './Controls';
import { BlendRow } from './BlendSelect';
import LayerAnimationControls from './LayerAnimationControls';
import { tx } from '@/lib/tx';
import { editSelectedOverlays } from '@/lib/compositionEditing';
import VideoStartControl from './VideoStartControl';
import { addAbsoluteMedia } from '@/lib/absoluteMedia';
import { animatedLayer, hasKeys, keyedPatch } from '@/lib/keyframes';
import { KeyedRow } from './KeyframeControls';
import MaskControl from './MaskControl';
import Tilt3DControls from './Tilt3DControls';
export default function AbsoluteMediaPanel() {
  const layers = useSceneStore((s) => s.textLayers);
  const audioUrl = useSceneStore((s) => s.audioUrl);
  const audioSettings = useSceneStore(s => s.audioSettings), duration = useSceneStore(s => s.duration);
  const selected = useUIStore((s) => s.selectedTextId);
  const pt = useUIStore((s) => s.locale) === 'pt', [status, setStatus] = useState('');
  const mediaLayer = layers.find((l) => l.id === selected && l.media);
  const keyFrame = useSceneStore((s) => mediaLayer && hasKeys(mediaLayer) ? s.frame : 0), fps = useSceneStore((s) => s.fps);
  const editMedia = (change: Partial<NonNullable<import('@/lib/textLayers').TextLayer['media']>>) => {
    if (mediaLayer) editSelectedOverlays(mediaLayer.id, layer => layer.media ? { media: { ...layer.media, ...change } } : {});
  };
  const seconds = (mediaLayer && hasKeys(mediaLayer) ? keyFrame : useSceneStore.getState().frame) / fps;
  const uploadAudio = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) { setStatus(tx(pt, 'Limite de áudio: 100 MB.', 'Audio limit: 100 MB.')); return; }
    const revision = sceneRestoreRevision(), audioBlobId = `aux_${crypto.randomUUID()}`;
    setStatus(tx(pt, 'Salvando trilha…', 'Saving audio…'));
    try {
      await idbPut(audioBlobId, file);
      if (revision !== sceneRestoreRevision()) { await idbDelete(audioBlobId); return; }
      useSceneStore.setState((state) => ({ audioBlobId, audioUrl: URL.createObjectURL(file), audioSettings: { ...state.audioSettings, name: file.name, muted: false } }));
      useUIStore.getState().setTimelineExpanded(true);
      setStatus(tx(pt, 'Trilha salva. Reproduza para ouvir.', 'Audio saved. Press Play to listen.'));
    } catch { setStatus(tx(pt, 'Não foi possível salvar o áudio.', 'Could not save audio.')); }
  };
  const upload = async (file: File) => {
    setStatus(tx(pt, 'Carregando mídia…', 'Loading media…'));
    try {
      const count = await addAbsoluteMedia([file]);
      setStatus(count ? tx(pt, 'Camada de mídia adicionada.', 'Media layer added.') : '');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tx(pt, 'Falha ao carregar a mídia.', 'Could not load media.'));
    }
  };
  return <section className="absolute-media-panel"><h3>{tx(pt, 'Mídia absoluta e áudio', 'Absolute media and audio')}</h3>
    <label className="upload">{tx(pt, '+ Imagem ou vídeo', '+ Image or video')}<input type="file" accept="image/*,video/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} /></label>
    <label className="upload">{audioUrl ? (tx(pt, 'Substituir áudio', 'Replace audio')) : (tx(pt, '+ Áudio', '+ Audio'))}<input type="file" accept="audio/*" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadAudio(file); }} /></label>
    {audioUrl && <><ControlRow def={{key:'audioVolume',label:tx(pt, 'Volume do áudio', 'Audio volume'),type:'slider',min:0,max:100,step:1,unit:'%',default:100}} value={audioSettings.volume*100} onChange={value=>useSceneStore.setState({audioSettings:{...audioSettings,volume:Number(value)/100}})}/>
      {(['fadeIn','fadeOut'] as const).map(key=><ControlRow key={key} def={{key:key==='fadeIn'?'audioFadeIn':'audioFadeOut',label:key==='fadeIn'?(tx(pt, 'Aparecimento gradual do áudio', 'Audio fade in')):(tx(pt, 'Desaparecimento gradual do áudio', 'Audio fade out')),type:'slider',min:0,max:duration/2,step:.01,unit:'s',default:0}} value={audioSettings[key]} onChange={value=>useSceneStore.setState({audioSettings:{...audioSettings,[key]:Number(value)}})}/>)}
      <button className="btn" onClick={() => useSceneStore.setState({ audioUrl: null, audioBlobId: undefined })}>{tx(pt, 'Remover áudio', 'Remove audio')}</button></>}
    <p role="status" className="ctl-hint">{status}</p>
    {mediaLayer?.media && <><strong>{mediaLayer.media.kind === 'video' ? tx(pt, 'Vídeo selecionado', 'Selected video') : tx(pt, 'Imagem selecionada', 'Selected image')}</strong>{(['width', 'height'] as const).map((axis) => <ControlRow key={axis} def={{ key: axis, label: axis === 'width' ? (tx(pt, 'Largura', 'Width')) : (tx(pt, 'Altura', 'Height')), type: 'slider', min: 1, max: 4000, step: 1, default: 200 }} value={mediaLayer.media![axis]} onChange={(value) => editMedia({ [axis]: value })} />)}
    {(['x', 'y', 'rotation'] as const).map((key) => <KeyedRow key={key} layer={mediaLayer} prop={key} pt={pt}><ControlRow def={{ key, label:key==='rotation'?(tx(pt, 'Rotação', 'Rotation')):`${tx(pt, 'Posição', 'Position')} ${key.toUpperCase()}`, type:'slider',min:-4000,max:4000,step:1,default:0 }} value={animatedLayer(mediaLayer, seconds)[key]} onChange={value=>editSelectedOverlays(mediaLayer.id, layer => keyedPatch(layer, { [key]: Number(value) }, seconds))}/></KeyedRow>)}
    <Tilt3DControls layer={mediaLayer} pt={pt}/>
    <KeyedRow layer={mediaLayer} prop="opacity" pt={pt}><ControlRow def={{key:'opacity',label:tx(pt, 'Opacidade', 'Opacity'),type:'slider',min:0,max:100,step:1,unit:'%',default:100}} value={animatedLayer(mediaLayer, seconds).opacity*100} onChange={value=>editSelectedOverlays(mediaLayer.id, layer => keyedPatch(layer, { opacity: Number(value) / 100 }, seconds))}/></KeyedRow>
    <BlendRow value={mediaLayer.blend} onChange={blend=>editSelectedOverlays(mediaLayer.id, () => ({ blend }))}/>
    <MaskControl layer={mediaLayer} pt={pt}/>
    <ControlRow def={{key:'imageCorners',label:tx(pt, 'Arredondar todos os cantos', 'Round all corners'),type:'slider',min:0,max:Math.min(mediaLayer.media.width,mediaLayer.media.height)/2,step:1,unit:'px',default:0}} value={mediaLayer.media.cornerRadii?.[0]??0} onChange={value=>{const r=Number(value);editMedia({ cornerRadii: [r, r, r, r] });}}/>
    {mediaLayer.media.kind === 'video' && <VideoStartControl url={mediaLayer.media.url} value={mediaLayer.media.videoStart} onChange={videoStart => editMedia({ videoStart })} />}
    <LayerAnimationControls layer={mediaLayer} pt={pt}/>
    <p className="ctl-hint">{tx(pt, 'Arraste os círculos internos na tela para arredondar. Alt ajusta somente o canto arrastado.', 'Drag the inner circles to round corners. Alt changes only the dragged corner.')}</p>
    <label className="text-edit-label">{tx(pt, 'Preenchimento', 'Fit')}<select className="field" value={mediaLayer.media.fit} onChange={(e) => editMedia({ fit: e.target.value as 'contain' | 'cover' | 'stretch' })}><option value="contain">{tx(pt, 'Ajustar · preservar proporção', 'Fit · preserve aspect')}</option><option value="cover">{tx(pt, 'Preencher · recortar', 'Fill · crop')}</option><option value="stretch">{tx(pt, 'Esticar', 'Stretch')}</option></select></label></>}
  </section>;
}

