// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useState, useRef } from 'react';
import { registerCustomFont } from '@/lib/textLayers';
import { fontshareCatalog, fontshareFileUrl, type FontshareFamily } from '@/lib/fontshare';
import { tx } from '@/lib/tx';
type Provider = 'google' | 'fontshare';
interface CatalogFont { family: string; category: string; share?: FontshareFamily }
const previews = new Map<string, Promise<string>>();
const CATEGORY_PT: Record<string,string> = { 'Sans Serif': 'Sem serifa', Serif: 'Com serifa', Display: 'Decorativas', Handwriting: 'Manuscritas', Monospace: 'Monoespaçadas' };
const categoryLabel = (category: string, pt: boolean) => CATEGORY_PT[category] ? tx(pt, CATEGORY_PT[category], category) : category;
function previewFont(font: CatalogFont) {
  const family=font.family;
  if (!previews.has(family)) previews.set(family, (async()=>{
    let url:string|undefined;
    if(font.share)url=await fontshareFileUrl(font.share,400);
    else{
      const css=await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(family)}&display=swap`,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error();return r.text();});
      url=[...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].at(-1)?.[1];
    }
    if(!url)throw new Error();
    const name=`Preview ${family}`,face=new FontFace(name,`url("${url}")`);await face.load();document.fonts.add(face);return name;
  })().catch(()=>{previews.delete(family);return '';}));
  return previews.get(family)!;
}
function FontPreview({font:entry,onChoose,pt}:{font:CatalogFont;pt:boolean;onChoose:(font:string)=>void}) {
  const {family,category}=entry;
  const row=useRef<HTMLButtonElement>(null),[font,setFont]=useState('');
  useEffect(()=>{let active=true;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void previewFont(entry).then(name=>{if(active)setFont(name);});}},{root:row.current?.closest('.font-browser-results'),rootMargin:'40px'});if(row.current)observer.observe(row.current);return()=>{active=false;observer.disconnect();};},[family]);
  return <button ref={row} type="button" onClick={()=>onChoose(family)}><span style={{fontFamily:font?`"${font}"`:category==='Serif'?'Georgia, serif':category==='Monospace'?'monospace':'inherit',fontSize:20}}>{family}</span><small>{categoryLabel(category,pt)}</small></button>;
}
export default function FontBrowser({ pt, weight, onChoose, onImport }: { pt: boolean; weight: number; onChoose: (font: string) => void; onImport: (font: string) => void }) {
  const [provider, setProvider] = useState<Provider>('google'), [google, setGoogle] = useState<CatalogFont[]>([]), [fontshare, setFontshare] = useState<CatalogFont[]>([]), [query, setQuery] = useState(''), [category, setCategory] = useState(''), [status, setStatus] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0), [listHeight, setListHeight] = useState(264);
  useEffect(() => {
    const el = list.current; if (!el) return;
    const observer = new ResizeObserver(() => { if (el.clientHeight) setListHeight(el.clientHeight); });
    observer.observe(el); return () => observer.disconnect();
  }, []);
  useEffect(() => { if (list.current) list.current.scrollTop = 0; setScrollTop(0); }, [query, category, provider]);
  useEffect(() => { const abort = new AbortController(); fetch('/font-catalog.json', { signal: abort.signal }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setGoogle).catch(() => {}); return () => abort.abort(); }, []);
  useEffect(() => { if (provider !== 'fontshare' || fontshare.length) return; let alive = true; void fontshareCatalog().then((list) => { if (alive) setFontshare(list.map((share) => ({ family: share.family, category: share.category, share }))); }); return () => { alive = false; }; }, [provider, fontshare.length]);
  const catalog = provider === 'google' ? google : fontshare;
  const results = catalog.filter((f) => f.family.toLowerCase().includes(query.toLowerCase()) && (!category || f.category === category));
  const rowHeight = 48, start = Math.max(0, Math.floor(scrollTop / rowHeight) - 3), end = Math.min(results.length, Math.ceil((scrollTop + listHeight) / rowHeight) + 3);
  return <details className="composition-panel"><summary>{tx(pt, 'Catálogo de fontes', 'Font library')} · {provider === 'google' ? 'Google Fonts' : 'Fontshare'}</summary>
    <div className="icon-segmented font-provider" role="radiogroup" aria-label={tx(pt, 'Biblioteca de fontes', 'Font library')}>{(['google','fontshare'] as const).map((item) => <button key={item} type="button" role="radio" aria-checked={provider === item} className={`icon-seg ${provider === item ? 'active' : ''}`} onClick={() => { setProvider(item); setCategory(''); }}>{item === 'google' ? 'Google Fonts' : 'Fontshare'}</button>)}</div>
    <input className="field" aria-label={tx(pt, 'Buscar fonte', 'Search fonts')} placeholder={tx(pt, 'Buscar entre as famílias…', 'Search font families…')} value={query} onChange={(e) => setQuery(e.target.value)} />
    <select className="field" aria-label={tx(pt, 'Categoria de fonte', 'Font category')} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">{tx(pt, 'Todas as categorias', 'All categories')}</option>{['Sans Serif', 'Serif', 'Display', 'Handwriting', 'Monospace'].map((c) => <option key={c} value={c}>{categoryLabel(c,pt)}</option>)}</select>
    <p className="ctl-hint">{results.length} {tx(pt, 'famílias disponíveis. Role a lista ou busque pelo nome. O primeiro uso de uma fonte exige internet.', 'available families. Scroll or search by name. First use of a font requires internet.')}</p>
    <div ref={list} className="font-browser-results" tabIndex={0} role="region" aria-label={tx(pt, 'Lista de fontes — role para ver todas', 'Font list — scroll to see all')} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} onWheel={(e) => e.stopPropagation()}>
      <div className="font-browser-spacer" style={{height:results.length*rowHeight}}>{results.slice(start,end).map((f,index)=><div className="font-browser-row" key={f.family} style={{top:(start+index)*rowHeight,height:rowHeight}}><FontPreview font={f} pt={pt} onChoose={onChoose}/></div>)}</div>
      {!results.length&&<p className="ctl-hint">{tx(pt, 'Nenhuma fonte encontrada.', 'No fonts found.')}</p>}
    </div>
    <label className="upload">{tx(pt, 'Importar fonte · WOFF2 / WOFF / TTF / OTF', 'Import font · WOFF2 / WOFF / TTF / OTF')}<input type="file" accept=".woff2,.woff,.ttf,.otf" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setStatus(tx(pt, 'Preparando fonte local…', 'Preparing local font…')); try { const family = await registerCustomFont(file, weight); onImport(family); setStatus(tx(pt, 'Fonte importada e salva neste Mac.', 'Font imported and saved on this Mac.')); } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao importar.'); } e.target.value = ''; }} /></label>
    <p className="ctl-hint">{provider === 'fontshare' ? (tx(pt, 'Fontes do Fontshare, gratuitas para uso pessoal e comercial (ITF Free Font License ou SIL OFL).', 'Fontshare fonts, free for personal and commercial use (ITF Free Font License or SIL OFL).')) : (tx(pt, 'Outras fontes: importe o arquivo obtido no site do fornecedor. Use arquivos cuja licença permita seu projeto.', 'Other fonts: import the file from its provider. Use files licensed for your project.'))}</p><p role="status" className="ctl-hint">{status}</p>
  </details>;
}
