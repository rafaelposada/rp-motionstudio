'use client';

import { useState } from 'react';
import { useSceneStore, sceneRestoreRevision } from '@/store/useSceneStore';
import { useI18n } from '@/lib/useI18n';
import { ensureFont, type TextLayer } from '@/lib/textLayers';
import { ControlRow } from './Controls';
import { useUIStore } from '@/store/useUIStore';
import FontBrowser from './FontBrowser';
import ColorField from './ColorField';
import ShadowEditor from './ShadowEditor';
import LayerAnimationControls from './LayerAnimationControls';
import { moveCompositionLayer, deleteCompositionLayer, selectOverlayForEditing } from '@/lib/compositionActions';

const FONTS = ['Arial', 'Georgia', 'monospace', 'Inter', 'Roboto', 'Montserrat', 'Poppins', 'DM Sans', 'Manrope', 'Oswald', 'Bebas Neue', 'Playfair Display', 'Lora', 'Merriweather', 'Space Grotesk'];

export default function TextPanel() {
  const { locale } = useI18n();
  const pt = locale === 'pt';
  const layers = useSceneStore((s) => s.textLayers);
  const add = useSceneStore((s) => s.addTextLayer);
  const patch = useSceneStore((s) => s.patchTextLayer);
  const width = useSceneStore((s) => s.width);
  const height = useSceneStore((s) => s.height);
  const duration = useSceneStore((s) => s.duration);
  const selected = useUIStore((s) => s.selectedTextId);
  const selectedIds = useUIStore(s => s.selectedLayerIds);
  const [fontName, setFontName] = useState('');
  const [status, setStatus] = useState('');
  const textLayers = layers.filter((item) => !item.media);
  const layer = layers.find((item) => item.id === selected)?.media ? undefined : textLayers.find((item) => item.id === selected) ?? textLayers.at(-1);

  const loadFont = async (family: string, weight: number) => {
    if (!layer || !family.trim()) return;
    const targetId = layer.id;
    const revision = sceneRestoreRevision();
    setStatus(pt ? 'Preparando fonte…' : 'Preparing font…');
    try {
      await ensureFont(family.trim(), weight);
      if (revision !== sceneRestoreRevision()) return;
      patch(targetId, { font: family.trim(), weight });
      setStatus(pt ? 'Fonte pronta e salva para uso offline.' : 'Font ready and saved offline.');
    } catch (error) {
      setStatus(`${pt ? 'Fonte não carregada. Verifique o nome e a internet.' : 'Font not loaded. Check its name and internet connection.'} ${error instanceof Error ? error.message : ''}`);
    }
  };
  const numberControl = (key: keyof TextLayer, label: string, min: number, max: number, step = 1) => layer && (
    <ControlRow key={key} def={{ key, label, type: 'slider', min, max, step, default: key === 'fillOpacity' ? 1 : key === 'strokeWidth' ? 3 : 0 }} value={layer[key] ?? (key === 'fillOpacity' ? 1 : key === 'strokeWidth' ? 3 : 0)} onChange={(value) => patch(layer.id, { [key]: value })} />
  );
  return <div className="section-body text-panel">
    <button className="btn solid full" onClick={() => { add(); const created = useSceneStore.getState().textLayers.at(-1); if (created) selectOverlayForEditing(created.id); }}>{pt ? '+ Adicionar texto' : '+ Add text'}</button>
    <p className="ctl-hint">{pt ? 'Duplo clique para editar na tela. Arraste para mover; gire pela área externa dos cantos.' : 'Double-click to edit on canvas. Drag to move; rotate outside the corners.'}</p>
    {textLayers.map((item, index) => <div key={item.id} className="text-layer-row">
      <button className={`btn ${selectedIds.includes(item.id) ? 'solid' : ''}`} aria-pressed={selectedIds.includes(item.id)} onClick={e => selectOverlayForEditing(item.id, e.shiftKey)}>{index + 1}. {item.text.slice(0, 24) || (pt ? 'Texto vazio' : 'Empty text')}</button>
      <button className="icon-btn" aria-label={pt ? 'Alternar visibilidade' : 'Toggle visibility'} onClick={() => patch(item.id, { visible: !item.visible })}>{item.visible ? '◉' : '○'}</button>
      <button className="icon-btn" aria-label={pt ? 'Remover texto' : 'Remove text'} onClick={() => void deleteCompositionLayer(item.id)}>×</button>
    </div>)}
    {selectedIds.length > 1 && <p className="ctl-hint">{pt ? 'Seleção múltipla: arraste e transforme o conjunto na tela. Os campos abaixo editam o texto ativo.' : 'Multiple selection: drag and transform the group on the canvas. The fields below edit the active text.'}</p>}
    {layer && <>
      <label className="text-edit-label">{pt ? 'Conteúdo' : 'Content'}<textarea className="field text-content" rows={4} value={layer.text} onChange={(e) => patch(layer.id, { text: e.target.value })} /></label>
      <h3 className="text-section-title">{pt ? 'Tipografia' : 'Typography'}</h3>
      <FontBrowser pt={pt} weight={layer.weight} onChoose={(family) => void loadFont(family, 400)} onImport={(family) => patch(layer.id, { font: family })} />
      <label className="text-edit-label">{pt ? 'Fonte' : 'Font'}<select className="field" value={FONTS.includes(layer.font) ? layer.font : 'custom'} onChange={(e) => { if (e.target.value !== 'custom') void loadFont(e.target.value, 400); }}>
        {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
        {!FONTS.includes(layer.font) && <option value="custom">{layer.font}</option>}
      </select></label>
      <div className="text-font-search"><input className="field" placeholder={pt ? 'Outra fonte do Google (nome exato)' : 'Another Google font (exact name)'} value={fontName} onChange={(e) => setFontName(e.target.value)} /><button className="btn" onClick={() => void loadFont(fontName, layer.weight)}>{pt ? 'Usar' : 'Use'}</button></div>
      <p className="ctl-hint" role="status">{status}</p>
      <label className="text-edit-label">{pt ? 'Peso' : 'Weight'}<select className="field" disabled={layer.font.startsWith('Local ')} value={layer.weight} onChange={(e) => void loadFont(layer.font, Number(e.target.value))}>{[300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}</select></label>
      {layer.font.startsWith('Local ') && <p className="ctl-hint">{pt ? 'Fonte local: importe outro arquivo para usar um peso diferente.' : 'Local font: import another file to use a different weight.'}</p>}
      {numberControl('size', pt ? 'Tamanho do texto' : 'Text size', 8, 400)}
      <label className="text-edit-label">{pt ? 'Alinhamento' : 'Alignment'}<select className="field" value={layer.align} onChange={(e) => patch(layer.id, { align: e.target.value as CanvasTextAlign })}><option value="left">{pt ? 'Esquerda' : 'Left'}</option><option value="center">{pt ? 'Centro' : 'Center'}</option><option value="right">{pt ? 'Direita' : 'Right'}</option></select></label>
      {numberControl('letterSpacing', pt ? 'Espaçamento entre letras' : 'Letter spacing', -10, 80, 0.1)}
      {numberControl('lineHeight', pt ? 'Entrelinha' : 'Line height', 0.5, 3, 0.01)}
      <h3 className="text-section-title">{pt ? 'Transformação' : 'Transform'}</h3>
      {numberControl('x', pt ? 'Posição X' : 'Position X', -width, width * 2)}
      {numberControl('y', pt ? 'Posição Y' : 'Position Y', -height, height * 2)}
      <button className="btn" onClick={() => patch(layer.id, { x: width / 2, y: height / 2 })}>{pt ? 'Centralizar na tela' : 'Center on canvas'}</button>
      {numberControl('rotation', pt ? 'Rotação' : 'Rotation', -180, 180)}
      {(['scaleX','scaleY'] as const).map(key=><ControlRow key={key} def={{key,label:key==='scaleX'?(pt?'Escala horizontal':'Horizontal scale'):(pt?'Escala vertical':'Vertical scale'),type:'slider',min:5,max:2000,step:1,unit:'%',default:100}} value={(layer[key]??1)*100} onChange={value=>patch(layer.id,{[key]:Number(value)/100})}/>)}
      <div className="text-font-search"><button className="btn" onClick={() => moveCompositionLayer(layer.id, -1)}>{pt ? 'Recuar camada' : 'Send backward'}</button><button className="btn" onClick={() => moveCompositionLayer(layer.id, 1)}>{pt ? 'Avançar camada' : 'Bring forward'}</button></div>
      <h3 className="text-section-title">{pt ? 'Aparência' : 'Appearance'}</h3>
      <ColorField pt={pt} label={pt?'Cor do texto':'Text fill'} color={layer.color} opacity={layer.fillOpacity??1} onChange={(color,fillOpacity)=>patch(layer.id,{color,fillOpacity})}/>
      <ControlRow def={{key:'opacity',label:pt?'Opacidade da camada':'Layer opacity',type:'slider',min:0,max:100,step:1,unit:'%',default:100}} value={layer.opacity*100} onChange={(value)=>patch(layer.id,{opacity:Number(value)/100})}/>
      <p className="ctl-hint">{pt?'A opacidade da camada afeta o conjunto. A opacidade da cor afeta apenas o preenchimento do texto.':'Layer opacity affects the whole layer. Fill opacity affects only the text fill.'}</p>
      <label className="text-edit-label"><span><input type="checkbox" checked={!!layer.stroke} onChange={(e) => patch(layer.id, { stroke: e.target.checked ? '#000000' : undefined, strokeWidth: layer.strokeWidth ?? 3 })} /> {pt ? 'Contorno' : 'Stroke'}</span></label>
      {layer.stroke && <><ColorField pt={pt} label={pt?'Cor do contorno':'Stroke color'} color={layer.stroke} opacity={layer.strokeOpacity??1} onChange={(stroke,strokeOpacity)=>patch(layer.id,{stroke,strokeOpacity})}/>{numberControl('strokeWidth', pt ? 'Espessura do contorno' : 'Stroke width', 0, 30, 0.1)}</>}
      <ShadowEditor key={layer.id} layer={layer} pt={pt} patch={patch}/>
      <label className="text-edit-label"><span><input type="checkbox" checked={layer.backdrop ?? false} onChange={(e) => patch(layer.id, { backdrop: e.target.checked })} /> {pt ? 'Fundo de contraste atrás do texto' : 'Contrast background behind text'}</span></label>
      {layer.backdrop && <div className="text-backdrop-controls">
        <ControlRow def={{key:'backdropBlur',label:pt?'BG Blur · desfoque do fundo':'BG Blur',type:'slider',min:0,max:40,step:.5,unit:'px',default:0}} value={layer.backdropBlur??0} onChange={value=>patch(layer.id,{backdropBlur:Number(value)})}/>
        <ColorField pt={pt} label={pt?'Cor do fundo do texto':'Text background color'} color={layer.backdropColor??'#101114'} opacity={layer.backdropOpacity??.8} onChange={(backdropColor,backdropOpacity)=>patch(layer.id,{backdropColor,backdropOpacity})}/>
        <ControlRow def={{key:'backdropRadius',label:pt?'Cantos do fundo':'Backdrop corners',type:'slider',min:0,max:200,step:1,unit:'px',default:12}} value={layer.backdropRadius??12} onChange={value=>patch(layer.id,{backdropRadius:Number(value)})}/>
        <label className="text-edit-label"><span><input type="checkbox" checked={!!layer.backdropStroke} onChange={e=>patch(layer.id,{backdropStroke:e.target.checked?'#ffffff':undefined,backdropStrokeWidth:layer.backdropStrokeWidth??1})}/> {pt?'Contorno do fundo':'Background stroke'}</span></label>
        {layer.backdropStroke && <><ColorField pt={pt} label={pt?'Cor do contorno do fundo':'Background stroke color'} color={layer.backdropStroke} opacity={layer.backdropStrokeOpacity??1} onChange={(backdropStroke,backdropStrokeOpacity)=>patch(layer.id,{backdropStroke,backdropStrokeOpacity})}/>
          <ControlRow def={{key:'backdropStrokeWidth',label:pt?'Espessura do contorno do fundo':'Background stroke width',type:'slider',min:0,max:30,step:.1,unit:'px',default:1}} value={layer.backdropStrokeWidth??1} onChange={value=>patch(layer.id,{backdropStrokeWidth:Number(value)})}/></>}
      </div>}
      <h3 className="text-section-title">{pt ? 'Animação e duração' : 'Animation and timing'}</h3>
      <LayerAnimationControls layer={layer} pt={pt}/>
    </>}
  </div>;
}
