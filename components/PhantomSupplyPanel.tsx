'use client';
import { useState } from 'react';

const COUPON = 'RafaelPosada10';
export default function PhantomSupplyPanel({pt}:{pt:boolean}) {
  const [status,setStatus]=useState<'idle'|'copied'|'manual'>('idle');
  const copy=async()=>{
    try { await navigator.clipboard.writeText(COUPON); setStatus('copied'); }
    catch { setStatus('manual'); }
  };
  return <section className="support-panel phantom-panel">
    <span className="eyebrow">{pt?'Recursos para designers':'Resources for designers'}</span>
    <h3 className="phantom-title">Phantom Supply</h3>
    <p>{pt?'Uma plataforma com milhares de mockups premium, selecionados para designers que querem apresentar seus projetos com mais impacto e cuidado visual.':'A platform with thousands of premium mockups, curated for designers who want to present their projects with more impact and visual care.'}</p>
    <p>{pt?'Explore diferentes categorias e estilos para encontrar a apresentação que combina com sua marca. O acervo também reúne fontes, motion, templates e assets para ampliar seu repertório criativo.':'Explore different categories and styles to find a presentation that suits your brand. The archive also includes fonts, motion, templates and assets to expand your creative toolkit.'}</p>
    <ul className="phantom-categories" aria-label={pt?'Categorias da plataforma':'Platform categories'}>{['Mockups',pt?'Fontes':'Fonts','Motion','Templates','Assets'].map(category=><li key={category}>{category}</li>)}</ul>
    <div className="phantom-coupon"><span className="eyebrow">{pt?'Cupom de desconto':'Discount code'}</span><strong className="phantom-discount">{pt?'10% de desconto':'10% off'}</strong><p>{pt?'Use o código abaixo no site da Phantom Supply.':'Use the code below on the Phantom Supply website.'}</p>
      <div className="phantom-code-row"><code className="phantom-code" tabIndex={0} aria-label={pt?'Cupom RafaelPosada10':'Coupon RafaelPosada10'}>{COUPON}</code><button type="button" className="btn" aria-label={pt?'Copiar cupom RafaelPosada10':'Copy coupon RafaelPosada10'} onClick={()=>void copy()}>{status==='copied'?(pt?'Copiado':'Copied'):(pt?'Copiar cupom':'Copy code')}</button></div>
      <span className="phantom-copy-status" role="status" aria-live="polite">{status==='copied'?(pt?'Cupom copiado.':'Coupon copied.'):status==='manual'?(pt?'Selecione o código e copie com ⌘/Ctrl+C.':'Select the code and copy with ⌘/Ctrl+C.'):' '}</span>
    </div>
    <a className="btn primary phantom-visit" href="https://phantom.supply/" target="_blank" rel="noopener noreferrer">{pt?'Conhecer a Phantom Supply':'Explore Phantom Supply'} ↗</a>
    <p className="ctl-hint">{pt?'O acesso ao acervo e o uso do cupom acontecem no site da Phantom Supply.':'The archive and coupon redemption are available on the Phantom Supply website.'}</p>
  </section>;
}
