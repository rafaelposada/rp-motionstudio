'use client';

import { useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { useI18n } from '@/lib/useI18n';
import { ensureFont, type TextLayer } from '@/lib/textLayers';
import { ControlRow } from './Controls';
import { useUIStore } from '@/store/useUIStore';
import FontBrowser from './FontBrowser';
import ColorField from './ColorField';
import ShadowEditor from './ShadowEditor';
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
  const showSelectionBox = useUIStore((s) => s.showSelectionBox);
  const [fontName, setFontName] = useState('');
  const [status, setStatus] = useState('');
  const textLayers = layers.filter((item) => !item.media);
  const layer = layers.find((item) => item.id === selected)?.media ? undefined : textLayers.find((item) => item.id === selected) ?? textLayers.at(-1);

  const loadFont = async (family: string, weight: number) => {
    if (!layer || !family.trim()) return;
    const targetId = layer.id;
    setStatus(pt ? 'Preparando fonte…' : 'Preparing font…');
    try {
      await ensureFont(family.trim(), weight);
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
    <p className="ctl-hint">{pt ? 'Arraste o texto para posicionar e as alças para redimensionar ou girar. Shift preserva a proporção; Alt redimensiona pelo centro. Fontes do Google exigem internet no primeiro uso.' : 'Drag text to position it and use handles to resize or rotate. Shift preserves proportions; Alt resizes from the center. Google fonts require internet on first use.'}</p>
    <label className="text-edit-label"><span><input type="checkbox" checked={showSelectionBox} onChange={(e) => useUIStore.getState().setShowSelectionBox(e.target.checked)} /> {pt ? 'Mostrar caixa delimitadora' : 'Show bounding box'}</span></label>
    {textLayers.map((item, index) => <div key={item.id} className="text-layer-row">
      <button className={`btn ${layer?.id === item.id ? 'solid' : ''}`} onClick={() => selectOverlayForEditing(item.id)}>{index + 1}. {item.text.slice(0, 24) || (pt ? 'Texto vazio' : 'Empty text')}</button>
      <button className="icon-btn" aria-label={pt ? 'Alternar visibilidade' : 'Toggle visibility'} onClick={() => patch(item.id, { visible: !item.visible })}>{item.visible ? '◉' : '○'}</button>
      <button className="icon-btn" aria-label={pt ? 'Remover texto' : 'Remove text'} onClick={() => void deleteCompositionLayer(item.id)}>×</button>
    </div>)}
    {layer && <>
      <label className="text-edit-label">{pt ? 'Conteúdo' : 'Content'}<textarea className="field text-content" rows={4} value={layer.text} onChange={(e) => patch(layer.id, { text: e.target.value })} /></label>
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
      <ColorField pt={pt} label={pt?'Cor do texto':'Text fill'} color={layer.color} opacity={layer.fillOpacity??1} onChange={(color,fillOpacity)=>patch(layer.id,{color,fillOpacity})}/>
      <label className="text-edit-label">{pt ? 'Alinhamento' : 'Alignment'}<select className="field" value={layer.align} onChange={(e) => patch(layer.id, { align: e.target.value as CanvasTextAlign })}><option value="left">{pt ? 'Esquerda' : 'Left'}</option><option value="center">{pt ? 'Centro' : 'Center'}</option><option value="right">{pt ? 'Direita' : 'Right'}</option></select></label>
      {numberControl('x', pt ? 'Posição X' : 'Position X', -width, width * 2)}
      {numberControl('y', pt ? 'Posição Y' : 'Position Y', -height, height * 2)}
      <button className="btn" onClick={() => patch(layer.id, { x: width / 2, y: height / 2 })}>{pt ? 'Centralizar na tela' : 'Center on canvas'}</button>
      {numberControl('rotation', pt ? 'Rotação' : 'Rotation', -180, 180)}
      {(['scaleX','scaleY'] as const).map(key=><ControlRow key={key} def={{key,label:key==='scaleX'?(pt?'Escala horizontal':'Horizontal scale'):(pt?'Escala vertical':'Vertical scale'),type:'slider',min:5,max:2000,step:1,unit:'%',default:100}} value={(layer[key]??1)*100} onChange={value=>patch(layer.id,{[key]:Number(value)/100})}/>)}
      <ControlRow def={{key:'opacity',label:pt?'Opacidade da camada':'Layer opacity',type:'slider',min:0,max:100,step:1,unit:'%',default:100}} value={layer.opacity*100} onChange={(value)=>patch(layer.id,{opacity:Number(value)/100})}/>
      <p className="ctl-hint">{pt?'A opacidade da camada afeta o conjunto. A opacidade da cor afeta apenas o preenchimento do texto.':'Layer opacity affects the whole layer. Fill opacity affects only the text fill.'}</p>
      {numberControl('letterSpacing', pt ? 'Espaçamento entre letras' : 'Letter spacing', -10, 80, 0.1)}
      <label className="text-edit-label"><span><input type="checkbox" checked={!!layer.stroke} onChange={(e) => patch(layer.id, { stroke: e.target.checked ? '#000000' : undefined, strokeWidth: layer.strokeWidth ?? 3 })} /> {pt ? 'Contorno' : 'Stroke'}</span></label>
      {layer.stroke && <><ColorField pt={pt} label={pt?'Cor do contorno':'Stroke color'} color={layer.stroke} opacity={layer.strokeOpacity??1} onChange={(stroke,strokeOpacity)=>patch(layer.id,{stroke,strokeOpacity})}/>{numberControl('strokeWidth', pt ? 'Espessura do contorno' : 'Stroke width', 0, 30, 0.1)}</>}
      <ShadowEditor key={layer.id} layer={layer} pt={pt} patch={patch}/>
      <div className="text-font-search"><button className="btn" onClick={() => moveCompositionLayer(layer.id, -1)}>{pt ? 'Recuar camada' : 'Send backward'}</button><button className="btn" onClick={() => moveCompositionLayer(layer.id, 1)}>{pt ? 'Avançar camada' : 'Bring forward'}</button></div>
      {numberControl('lineHeight', pt ? 'Entrelinha' : 'Line height', 0.5, 3, 0.01)}
      <label className="text-edit-label">{pt ? 'Animação do texto' : 'Text animation'}<select className="field" value={layer.animation ?? 'none'} onChange={(e) => patch(layer.id, { animation: e.target.value as TextLayer['animation'], animationDuration: layer.animationDuration ?? 0.35 })}><option value="none">{pt ? 'Sem animação' : 'None'}</option><option value="fade">{pt ? 'Desvanecer' : 'Fade'}</option><option value="rise">{pt ? 'Subir suavemente' : 'Rise'}</option><option value="typewriter">{pt ? 'Digitar' : 'Typewriter'}</option></select></label>
      {layer.animation && layer.animation !== 'none' && numberControl('animationDuration', pt ? 'Duração da transição (s)' : 'Transition duration (s)', 0.05, 2, 0.05)}
      <label className="text-edit-label"><span><input type="checkbox" checked={layer.backdrop ?? false} onChange={(e) => patch(layer.id, { backdrop: e.target.checked })} /> {pt ? 'Fundo de contraste atrás do texto' : 'Contrast background behind text'}</span></label>
      {layer.backdrop && <ControlRow def={{key:'backdropRadius',label:pt?'Cantos do fundo':'Backdrop corners',type:'slider',min:0,max:200,step:1,unit:'px',default:12}} value={layer.backdropRadius??12} onChange={value=>patch(layer.id,{backdropRadius:Number(value)})}/>}
      {numberControl('start', pt ? 'Entrada (s)' : 'Start (s)', 0, duration, 0.01)}
      {numberControl('end', pt ? 'Saída (s)' : 'End (s)', 0, duration, 0.01)}
    </>}
  </div>;
}
