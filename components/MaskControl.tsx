// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useSceneStore } from '@/store/useSceneStore';
import type { TextLayer } from '@/lib/textLayers';
import { tx } from '@/lib/tx';

// Clip a layer to another layer's silhouette. The chosen layer stops drawing
// on its own and works only as the mask, as in Illustrator's clipping masks.
export default function MaskControl({ layer, pt }: { layer: TextLayer; pt: boolean }) {
  const layers = useSceneStore((s) => s.textLayers);
  const candidates = layers.filter((l) => l.id !== layer.id && l.maskId !== layer.id);
  const patch = (change: Partial<TextLayer>) => useSceneStore.getState().patchTextLayer(layer.id, change);
  const kind = (l: TextLayer) => l.media ? tx(pt, 'imagem', 'image') : l.shape ? tx(pt, 'forma', 'shape') : tx(pt, 'texto', 'text');
  return <div className="mask-control">
    <label className="text-edit-label">{tx(pt, 'Máscara', 'Mask')}
      <select className="field" value={layer.maskId ?? ''} onChange={(e) => patch({ maskId: e.target.value || undefined })}>
        <option value="">{tx(pt, 'Nenhuma', 'None')}</option>
        {candidates.map((l) => <option key={l.id} value={l.id}>{l.text.slice(0, 32) || tx(pt, 'Camada', 'Layer')} · {kind(l)}</option>)}
      </select>
    </label>
    {layer.maskId && <label className="mask-invert"><input type="checkbox" checked={!!layer.maskInvert} onChange={(e) => patch({ maskInvert: e.target.checked })} /> {tx(pt, 'Inverter máscara (mostra o que fica fora)', 'Invert mask (show what is outside)')}</label>}
    <p className="ctl-hint">{tx(pt, 'A camada escolhida recorta esta pela própria forma e deixa de aparecer sozinha. Funciona com formas, textos e imagens.', 'The chosen layer clips this one to its shape and stops showing on its own. Works with shapes, text and images.')}</p>
  </div>;
}
