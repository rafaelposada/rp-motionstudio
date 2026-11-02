// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import { tx } from '@/lib/tx';
export default function UpdateConfirmation({title,children,onClose,busy=false,pt}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean;pt:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current,prior=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();prior?.focus();};},[]);
  return <dialog ref={dialog} className="update-progress-dialog update-confirm-dialog" aria-labelledby="update-confirm-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <header className="update-modal-heading"><span className="eyebrow">RP MotionStudio</span><button type="button" disabled={busy} onClick={onClose} aria-label={tx(pt, 'Fechar atualização', 'Close update')}>×</button></header>
    <h2 id="update-confirm-title">{title}</h2>{children}
  </dialog>;
}
