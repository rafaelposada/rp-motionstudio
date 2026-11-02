// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { compositionOrder } from '@/lib/composition';
import { moveCompositionLayer, deleteCompositionLayer, selectOverlayForEditing, selectModelForEditing, duplicateCompositionLayers, selectedCompositionIds, recoverModel, layerDisplayName } from '@/lib/compositionActions';
import LayerDropTarget, { LayerDragHandle, layerDragProps } from './LayerDropTarget';
import { tx } from '@/lib/tx';

export default function CompositionLayers() {
  const layers = useSceneStore(s => s.textLayers), tracks = useSceneStore(s => s.tracks);
  const selectedIds = useUIStore(s => s.selectedLayerIds), model = useUIStore(s => s.selectedMotionId);
  const pt = useUIStore(s => s.locale) === 'pt';
  const order = compositionOrder(tracks, layers);
  return <section className="layers-panel">
    <header className="layers-panel-header"><h3>{tx(pt, 'Camadas', 'Layers')}</h3><span>{order.length}</span></header>
    <p className="ctl-hint">{tx(pt, 'Topo = frente. Shift + clique seleciona várias camadas. Arraste o nome para ordenar.', 'Top = front. Shift + click selects multiple layers. Drag a name to reorder.')}</p>
    <div className="composition-list" role="list" aria-label={tx(pt, 'Camadas da composição', 'Composition layers')}>
      {[...order].reverse().map((item, i) => {
        const overlay = layers.find(l => l.id === item.id), track = tracks.find(l => l.id === item.id);
        const name = layerDisplayName(overlay?.text || track?.name || '', pt), visible = overlay?.visible ?? track?.visible;
        return <LayerDropTarget key={item.id} id={item.id}>
          <div role="listitem" className={`composition-row ${selectedIds.includes(item.id) ? 'selected' : ''}`}>
            <LayerDragHandle id={item.id} name={name}/>
            <button className="composition-name" {...layerDragProps(item.id)} aria-pressed={selectedIds.includes(item.id)} title={name}
              onClick={e => overlay ? selectOverlayForEditing(item.id, e.shiftKey, false, 'layers') : selectModelForEditing(item.id, e.shiftKey, false, 'layers')}>
              <span className="layer-kind" aria-hidden="true">{overlay ? (overlay.media ? '▧' : overlay.shape ? '◇' : 'T') : '▥'}</span><span>{name}</span>
            </button>
            <div className="composition-actions">
              <button title={tx(pt, 'Mostrar / ocultar', 'Show / hide')} aria-label={`${tx(pt, 'Visibilidade', 'Visibility')}: ${name}`} onClick={() => overlay ? useSceneStore.getState().patchTextLayer(item.id, { visible: !visible }) : useSceneStore.getState().patchTrack(item.id, { visible: !visible })}>{visible ? '◉' : '○'}</button>
              <button title={tx(pt, 'Trazer à frente', 'Bring forward')} aria-label={`${tx(pt, 'Trazer à frente', 'Bring forward')}: ${name}`} disabled={i === 0} onClick={() => moveCompositionLayer(item.id, 1)}>↑</button>
              <button title={tx(pt, 'Enviar atrás', 'Send backward')} aria-label={`${tx(pt, 'Enviar atrás', 'Send backward')}: ${name}`} disabled={i === order.length - 1} onClick={() => moveCompositionLayer(item.id, -1)}>↓</button>
              <button title={tx(pt, 'Duplicar · ⌘/Ctrl+D', 'Duplicate · ⌘/Ctrl+D')} aria-label={`${tx(pt, 'Duplicar camada', 'Duplicate layer')}: ${name}`} disabled={overlay?.locked} onClick={() => duplicateCompositionLayers(selectedCompositionIds(item.id))}>⧉</button>
              <button title={tx(pt, 'Excluir', 'Delete')} aria-label={`${tx(pt, 'Excluir camada', 'Delete layer')}: ${name}`} disabled={overlay?.locked} onClick={() => void deleteCompositionLayer(item.id)}>×</button>
            </div>
          </div>
        </LayerDropTarget>;
      })}
    </div>
    {selectedIds.length > 1 && <p className="selection-count" role="status">{selectedIds.length} {tx(pt, 'camadas selecionadas', 'layers selected')}</p>}
    {model && selectedIds.length === 1 && <button type="button" className="btn full layer-recover" onClick={() => recoverModel(model)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 2H2v3m9-3h3v3M2 11v3h3m9-3v3h-3M5 5h6v6H5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{tx(pt, 'Recuperar enquadramento', 'Restore framing')}</span></button>}
  </section>;
}
