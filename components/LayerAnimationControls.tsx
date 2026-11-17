// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useSceneStore } from '@/store/useSceneStore';
import type { TextLayer } from '@/lib/textLayers';
import { ControlRow } from './Controls';
import { tx } from '@/lib/tx';
import { editSelectedOverlays } from '@/lib/compositionEditing';
import TransitionControls from './TransitionControls';
export default function LayerAnimationControls({layer,pt}:{layer:TextLayer;pt:boolean}) {
  const duration=useSceneStore(s=>s.duration), fps=useSceneStore(s=>s.fps);
  const enter=layer.entrance??layer.animation??'none', exit=layer.exit??(layer.animation&&layer.animation!=='none'?'fade':'none');
  const length=Math.max(1/fps,layer.end-layer.start);
  return <div className="layer-animation-controls">
    <TransitionControls pt={pt} length={length} typewriter={!layer.media && !layer.shape && !layer.code} onChange={change => editSelectedOverlays(layer.id, () => change)}
      settings={{ entrance: enter, exit, entranceDuration: layer.entranceDuration ?? layer.animationDuration, exitDuration: layer.exitDuration ?? layer.animationDuration }} />
    <ControlRow def={{key:'start',label:tx(pt, 'Início da camada', 'Layer start'),type:'slider',min:0,max:Math.max(0,layer.end-1/fps),step:.01,unit:'s',default:0}} value={layer.start} onChange={value=>editSelectedOverlays(layer.id, target => ({ start: Math.min(Number(value), Math.max(0, target.end - 1 / fps)) }))}/>
    <ControlRow def={{key:'end',label:tx(pt, 'Fim da camada', 'Layer end'),type:'slider',min:Math.min(duration,layer.start+1/fps),max:duration,step:.01,unit:'s',default:duration}} value={layer.end} onChange={value=>editSelectedOverlays(layer.id, target => ({ end: Math.max(Number(value), Math.min(duration, target.start + 1 / fps)) }))}/>
    <p className="ctl-hint">{tx(pt, 'As transições acontecem nos extremos do intervalo da camada. Reproduza ou mova o indicador de tempo até o início/fim para visualizar.', 'Transitions run at the edges of the layer interval. Play or scrub to its start/end to preview.')}</p>
  </div>;
}
