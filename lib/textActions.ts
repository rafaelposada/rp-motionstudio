import {useSceneStore} from '@/store/useSceneStore';
import {useUIStore} from '@/store/useUIStore';
import {useHistoryStore} from '@/store/useHistoryStore';
import {selectOverlayForEditing} from './compositionActions';

export function addCompositionText(point?:{x:number;y:number}):string|null {
  const scene=useSceneStore.getState();
  if(point&&(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.y<0||point.x>scene.width||point.y>scene.height))return null;
  const history=useHistoryStore.getState();history.beginGesture();
  try {
    scene.setPlaying(false);scene.addTextLayer();
    const created=useSceneStore.getState().textLayers.at(-1);if(!created)return null;
    scene.patchTextLayer(created.id,{text:useUIStore.getState().locale==='pt'?'Seu texto':'Your text',...(point?{...point,align:'left' as const}:{})});
    selectOverlayForEditing(created.id);return created.id;
  }finally{history.endGesture();}
}

export function textToolShortcut(event:{key:string;repeat?:boolean;isComposing?:boolean;metaKey?:boolean;ctrlKey?:boolean;altKey?:boolean;defaultPrevented?:boolean}) {
  return !event.defaultPrevented&&!event.repeat&&!event.isComposing&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&event.key.toLowerCase()==='t';
}
