'use client';
import {useEffect,useRef,useState} from 'react';
import {parseNumericExpression} from '@/lib/numericExpression';
import {textPadding,type TextPadding} from '@/lib/textPadding';
function PaddingField({value,label,onChange}:{value:number;label:string;onChange:(n:number)=>void}){
  const [draft,setDraft]=useState(String(value)),[invalid,setInvalid]=useState(false),focused=useRef(false),discard=useRef(false);
  useEffect(()=>{if(!focused.current)setDraft(String(value));},[value]);
  const commit=()=>{focused.current=false;if(discard.current){discard.current=false;return;}const n=parseNumericExpression(draft,'px');if(n===null){setInvalid(true);return;}const bounded=Math.max(0,Math.min(400,n));setDraft(String(bounded));setInvalid(false);onChange(bounded);};
  return <input type="text" inputMode="decimal" aria-label={label} aria-invalid={invalid} value={draft} onFocus={()=>{focused.current=true;}} onChange={e=>{setDraft(e.target.value);setInvalid(false);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();discard.current=true;focused.current=false;setDraft(String(value));setInvalid(false);e.currentTarget.blur();}}}/>;
}
export default function TextPaddingEditor({value,pt,onChange}:{value?:TextPadding;pt:boolean;onChange:(value:TextPadding)=>void}){
  const split=Array.isArray(value)||value===undefined,p=textPadding(value),names=pt?['Superior','Direito','Inferior','Esquerdo']:['Top','Right','Bottom','Left'];
  return <div className="text-padding-editor"><div className="text-padding-head"><span>Padding <small>px</small></span>{!split&&<PaddingField value={p[0]} label={pt?'Padding do fundo':'Background padding'} onChange={onChange}/>}
    <div className="settings-segment" role="group" aria-label={pt?'Modo do padding':'Padding mode'}><button type="button" aria-pressed={!split} aria-label={pt?'Padding igual em todos os lados':'Equal padding on all sides'} title={pt?'Todos os lados':'All sides'} onClick={()=>onChange(p[0])}>□</button><button type="button" aria-pressed={split} aria-label={pt?'Padding independente por lado':'Independent padding per side'} title={pt?'Por lado':'Per side'} onClick={()=>onChange(p)}>⊡</button></div></div>
    {split&&<div className="text-padding-sides">{names.map((name,i)=><label key={name}><PaddingField value={p[i]} label={`Padding ${name.toLowerCase()}`} onChange={n=>{const next=[...p] as typeof p;next[i]=n;onChange(next);}}/><small>{['T','R','B','L'][i]}</small></label>)}</div>}
  </div>;
}
