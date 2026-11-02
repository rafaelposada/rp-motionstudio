// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/useI18n';
import { tx, txf } from '@/lib/tx';
export default function InfoHint({text,name}:{text:string;name:string}) {
  const {locale}=useI18n(),id=useId(),button=useRef<HTMLButtonElement>(null),tip=useRef<HTMLSpanElement>(null);
  const [open,setOpen]=useState(false),[pinned,setPinned]=useState(false),[position,setPosition]=useState({left:0,top:0});
  const close=()=>{setOpen(false);setPinned(false);};
  const show=()=>{const r=button.current?.getBoundingClientRect();if(r)setPosition({left:Math.max(12,Math.min(window.innerWidth-292,r.left-8)),top:r.bottom+8});setOpen(true);};
  useLayoutEffect(()=>{if(!open)return;const a=button.current?.getBoundingClientRect(),b=tip.current?.getBoundingClientRect();if(a&&b&&b.bottom>window.innerHeight-12)setPosition(p=>({...p,top:Math.max(12,a.top-b.height-8)}));},[open,text]);
  useEffect(()=>{if(!open)return;window.addEventListener('scroll',close,true);window.addEventListener('resize',close);return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};},[open]);
  return <span className="info-hint" data-open={open?'true':'false'} onMouseEnter={show} onMouseLeave={()=>{if(!pinned)setOpen(false);}}>
    <button ref={button} type="button" className="info-hint-button" aria-label={txf(locale==='pt', 'Informações sobre {name}', 'Information about {name}', { name })} aria-describedby={open?id:undefined} aria-expanded={open}
      onFocus={show} onBlur={close} onClick={e=>{e.preventDefault();e.stopPropagation();if(pinned)close();else{show();setPinned(true);}}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}}>i</button>
    {open&&createPortal(<span ref={tip} id={id} role="tooltip" className="info-tooltip" style={position}>{text}</span>,document.body)}
  </span>;
}
export function InfoLabel({children,help,name,className='ctl-label'}:{children:React.ReactNode;help:string;name:string;className?:string}) {
  return <span className={className}>{children}<InfoHint text={help} name={name}/></span>;
}
