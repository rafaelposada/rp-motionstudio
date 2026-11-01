'use client';
import { useEffect, useState, useRef } from 'react';
import { registerCustomFont } from '@/lib/textLayers';
const previews = new Map<string, Promise<string>>();
const categoryLabel = (category: string, pt: boolean) => pt ? ({ 'Sans Serif': 'Sem serifa', Serif: 'Com serifa', Display: 'Decorativas', Handwriting: 'Manuscritas', Monospace: 'Monoespaçadas' } as Record<string,string>)[category] ?? category : category;
function previewFont(family: string) {
  if (!previews.has(family)) previews.set(family, (async()=>{
    const css=await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(family)}&display=swap`,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error();return r.text();});
    const url=[...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].at(-1)?.[1];if(!url)throw new Error();
    const name=`Preview ${family}`,face=new FontFace(name,`url("${url}")`);await face.load();document.fonts.add(face);return name;
  })().catch(()=>{previews.delete(family);return '';}));
  return previews.get(family)!;
}
function FontPreview({family,category,onChoose,pt}:{family:string;category:string;pt:boolean;onChoose:(font:string)=>void}) {
  const row=useRef<HTMLButtonElement>(null),[font,setFont]=useState('');
  useEffect(()=>{let active=true;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void previewFont(family).then(name=>{if(active)setFont(name);});}},{root:row.current?.closest('.font-browser-results'),rootMargin:'40px'});if(row.current)observer.observe(row.current);return()=>{active=false;observer.disconnect();};},[family]);
  return <button ref={row} type="button" onClick={()=>onChoose(family)}><span style={{fontFamily:font?`"${font}"`:category==='Serif'?'Georgia, serif':category==='Monospace'?'monospace':'inherit',fontSize:20}}>{family}</span><small>{categoryLabel(category,pt)}</small></button>;
}
export default function FontBrowser({ pt, weight, onChoose, onImport }: { pt: boolean; weight: number; onChoose: (font: string) => void; onImport: (font: string) => void }) {
  const [catalog, setCatalog] = useState<{ family: string; category: string }[]>([]), [query, setQuery] = useState(''), [category, setCategory] = useState(''), [status, setStatus] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0), [listHeight, setListHeight] = useState(264);
  useEffect(() => {
    const el = list.current; if (!el) return;
    const observer = new ResizeObserver(() => { if (el.clientHeight) setListHeight(el.clientHeight); });
    observer.observe(el); return () => observer.disconnect();
  }, []);
  useEffect(() => { if (list.current) list.current.scrollTop = 0; setScrollTop(0); }, [query, category]);
  useEffect(() => { const abort = new AbortController(); fetch('/font-catalog.json', { signal: abort.signal }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setCatalog).catch(() => {}); return () => abort.abort(); }, []);
  const results = catalog.filter((f) => f.family.toLowerCase().includes(query.toLowerCase()) && (!category || f.category === category));
  const rowHeight = 48, start = Math.max(0, Math.floor(scrollTop / rowHeight) - 3), end = Math.min(results.length, Math.ceil((scrollTop + listHeight) / rowHeight) + 3);
  return <details className="composition-panel"><summary>{pt ? 'Catálogo de fontes' : 'Font library'} · Google Fonts</summary>
    <input className="field" aria-label={pt ? 'Buscar fonte' : 'Search fonts'} placeholder={pt ? 'Buscar entre as famílias…' : 'Search font families…'} value={query} onChange={(e) => setQuery(e.target.value)} />
    <select className="field" aria-label={pt ? 'Categoria de fonte' : 'Font category'} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">{pt ? 'Todas as categorias' : 'All categories'}</option>{['Sans Serif', 'Serif', 'Display', 'Handwriting', 'Monospace'].map((c) => <option key={c} value={c}>{categoryLabel(c,pt)}</option>)}</select>
    <p className="ctl-hint">{results.length} {pt ? 'famílias disponíveis. Role a lista ou busque pelo nome. O primeiro uso de uma fonte exige internet.' : 'available families. Scroll or search by name. First use of a font requires internet.'}</p>
    <div ref={list} className="font-browser-results" tabIndex={0} role="region" aria-label={pt ? 'Lista de fontes — role para ver todas' : 'Font list — scroll to see all'} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} onWheel={(e) => e.stopPropagation()}>
      <div className="font-browser-spacer" style={{height:results.length*rowHeight}}>{results.slice(start,end).map((f,index)=><div className="font-browser-row" key={f.family} style={{top:(start+index)*rowHeight,height:rowHeight}}><FontPreview family={f.family} category={f.category} pt={pt} onChoose={onChoose}/></div>)}</div>
      {!results.length&&<p className="ctl-hint">{pt?'Nenhuma fonte encontrada.':'No fonts found.'}</p>}
    </div>
    <label className="upload">{pt ? 'Importar fonte · WOFF2 / WOFF / TTF / OTF' : 'Import font · WOFF2 / WOFF / TTF / OTF'}<input type="file" accept=".woff2,.woff,.ttf,.otf" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setStatus(pt ? 'Preparando fonte local…' : 'Preparing local font…'); try { const family = await registerCustomFont(file, weight); onImport(family); setStatus(pt ? 'Fonte importada e salva neste Mac.' : 'Font imported and saved on this Mac.'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao importar.'); } e.target.value = ''; }} /></label>
    <p className="ctl-hint">{pt ? 'Fontshare e outras fontes: importe o arquivo obtido pelo site do fornecedor. Use arquivos cuja licença permita seu projeto.' : 'Fontshare and other fonts: import the file from its provider. Use files licensed for your project.'}</p><p role="status" className="ctl-hint">{status}</p>
  </details>;
}
