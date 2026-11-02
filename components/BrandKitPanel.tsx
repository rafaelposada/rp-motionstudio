// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import { useEffect, useState } from 'react';
import { applyKit, kitFromComposition, storeKitLogo, useBrandKits, type BrandKit } from '@/lib/brandKits';
import { tx } from '@/lib/tx';

// Settings → Brand kit: create, edit and delete kits.
export function BrandKitSettings({ pt }: { pt: boolean }) {
  const { kits, hydrate, save, remove } = useBrandKits();
  const [editing, setEditing] = useState<BrandKit | null>(null), [status, setStatus] = useState('');
  useEffect(() => hydrate(), [hydrate]);
  const kit = editing;
  const update = (change: Partial<BrandKit>) => kit && setEditing({ ...kit, ...change });
  return <>
    <h3>{tx(pt, 'Kit de marca', 'Brand kit')}</h3>
    <p className="settings-description">{tx(pt, 'Guarde cores, fontes e logo de cada marca neste computador e aplique em qualquer composição pela aba Tela.', 'Keep each brand’s colors, fonts and logo on this computer and apply them to any composition from the Canvas tab.')}</p>
    <div className="brandkit-actions">
      <button type="button" className="btn primary" onClick={() => setEditing(kitFromComposition(tx(pt, 'Nova marca', 'New brand')))}>{tx(pt, 'Criar a partir desta composição', 'Create from this composition')}</button>
      <button type="button" className="btn" onClick={() => setEditing({ id: crypto.randomUUID(), name: tx(pt, 'Nova marca', 'New brand'), colors: ['#ffffff', '#111111'], heading: 'Inter', body: 'Inter' })}>{tx(pt, 'Kit em branco', 'Blank kit')}</button>
    </div>
    {kits.length > 0 && <ul className="brandkit-list">{kits.map((k) => <li key={k.id}>
      <span className="brandkit-swatches" aria-hidden="true">{k.colors.slice(0, 6).map((c) => <i key={c} style={{ background: c }} />)}</span>
      <span className="brandkit-name"><strong>{k.name}</strong><small>{k.heading}{k.body !== k.heading ? ` · ${k.body}` : ''}{k.logo ? ' · logo' : ''}</small></span>
      <button type="button" className="btn" onClick={() => setEditing(k)}>{tx(pt, 'Editar', 'Edit')}</button>
      <button type="button" className="btn" onClick={() => { remove(k.id); if (editing?.id === k.id) setEditing(null); }}>{tx(pt, 'Excluir', 'Delete')}</button>
    </li>)}</ul>}
    {kit && <div className="brandkit-editor">
      <label className="text-edit-label">{tx(pt, 'Nome', 'Name')}<input className="field" value={kit.name} onChange={(e) => update({ name: e.target.value })} /></label>
      <div className="text-edit-label">{tx(pt, 'Cores', 'Colors')}
        <div className="brandkit-colors">{kit.colors.map((c, i) => <span key={i} className="brandkit-color">
          <input type="color" value={c} aria-label={`${tx(pt, 'Cor', 'Color')} ${i + 1}`} onChange={(e) => update({ colors: kit.colors.map((x, j) => j === i ? e.target.value : x) })} />
          <button type="button" aria-label={tx(pt, 'Remover cor', 'Remove color')} onClick={() => update({ colors: kit.colors.filter((_, j) => j !== i) })}>×</button>
        </span>)}{kit.colors.length < 10 && <button type="button" className="btn" onClick={() => update({ colors: [...kit.colors, '#888888'] })}>+</button>}</div>
        <small className="settings-description">{tx(pt, 'Ordem: 1ª cor nos textos, 2ª nas formas, última no fundo.', 'Order: 1st color on text, 2nd on shapes, last on the background.')}</small>
      </div>
      <label className="text-edit-label">{tx(pt, 'Fonte dos títulos', 'Heading font')}<input className="field" value={kit.heading} onChange={(e) => update({ heading: e.target.value })} placeholder="Inter" /></label>
      <label className="text-edit-label">{tx(pt, 'Fonte do texto', 'Body font')}<input className="field" value={kit.body} onChange={(e) => update({ body: e.target.value })} placeholder="Inter" /></label>
      <small className="settings-description">{tx(pt, 'Use o nome exato de uma fonte do Google Fonts ou do Fontshare.', 'Use the exact name of a Google Fonts or Fontshare family.')}</small>
      <label className="upload">{kit.logo ? `${tx(pt, 'Trocar logo', 'Replace logo')} · ${kit.logo.name}` : tx(pt, '+ Logo (PNG ou SVG)', '+ Logo (PNG or SVG)')}<input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; try { update({ logo: await storeKitLogo(file) }); } catch { setStatus(tx(pt, 'Não foi possível ler a imagem.', 'Could not read the image.')); } }} /></label>
      <div className="brandkit-actions"><button type="button" className="btn primary" onClick={() => { save(kit); setEditing(null); setStatus(tx(pt, 'Kit salvo.', 'Kit saved.')); }}>{tx(pt, 'Salvar kit', 'Save kit')}</button><button type="button" className="btn" onClick={() => setEditing(null)}>{tx(pt, 'Cancelar', 'Cancel')}</button></div>
    </div>}
    <p className="settings-description" role="status">{status}</p>
  </>;
}

// Canvas tab: apply a saved kit to the open composition.
export function BrandKitApply({ pt }: { pt: boolean }) {
  const { kits, hydrate } = useBrandKits();
  const [id, setId] = useState(''), [opts, setOpts] = useState({ fonts: true, colors: true, logo: true }), [busy, setBusy] = useState(false);
  useEffect(() => hydrate(), [hydrate]);
  const kit = kits.find((k) => k.id === id) ?? kits[0];
  if (!kits.length) return <p className="ctl-hint">{tx(pt, 'Crie um kit de marca em Ajustes → Kit de marca para aplicar cores, fontes e logo com um clique.', 'Create a brand kit in Settings → Brand kit to apply colors, fonts and logo in one click.')}</p>;
  return <div className="brandkit-apply">
    <select className="field" value={kit?.id} onChange={(e) => setId(e.target.value)}>{kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
    <div className="brandkit-options">{(['fonts', 'colors', 'logo'] as const).map((key) => <label key={key}><input type="checkbox" checked={opts[key]} disabled={key === 'logo' && !kit?.logo} onChange={(e) => setOpts({ ...opts, [key]: e.target.checked })} /> {key === 'fonts' ? tx(pt, 'Fontes', 'Fonts') : key === 'colors' ? tx(pt, 'Cores', 'Colors') : 'Logo'}</label>)}</div>
    <button type="button" className="btn primary" disabled={!kit || busy} onClick={async () => { if (!kit) return; setBusy(true); try { await applyKit(kit, opts); } finally { setBusy(false); } }}>{busy ? tx(pt, 'Aplicando…', 'Applying…') : tx(pt, 'Aplicar kit', 'Apply kit')}</button>
  </div>;
}
