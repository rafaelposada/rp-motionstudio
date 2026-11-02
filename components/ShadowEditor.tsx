// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef, useState } from 'react';
import type { TextLayer } from '@/lib/textLayers';
import { parseNumericExpression } from '@/lib/numericExpression';
import { numericKeyValue } from '@/lib/numericKeyboard';
import ColorField from './ColorField';

function ShadowNumber({label,value,min,max,onChange,pt}:{label:string;value:number;min:number;max:number;onChange:(n:number)=>void;pt:boolean}) {
  const [draft,setDraft]=useState(String(value)),[invalid,setInvalid]=useState(false);
  const discard=useRef(false);
  useEffect(()=>{setDraft(String(value));setInvalid(false);},[value]);
  const apply=(n:number)=>{const next=Math.max(min,Math.min(max,Number(n.toFixed(10))));onChange(next);setDraft(String(next));setInvalid(false);};
  const commit=()=>{if(discard.current){discard.current=false;return;}const n=parseNumericExpression(draft);if(n===null){setInvalid(true);return;}apply(n);};
  return <label className="shadow-setting"><span>{label}</span><div className="shadow-number">
    <input type="text" inputMode="decimal" aria-label={`${pt?'Sombra':'Shadow'}: ${label}`} aria-invalid={invalid} value={draft}
      onChange={e=>{setDraft(e.target.value);setInvalid(false);}} onBlur={commit}
      onKeyDown={e=>{if(e.nativeEvent.isComposing)return;const next=numericKeyValue(e,parseNumericExpression(draft)??value,{min,max});if(next!==null){e.preventDefault();e.stopPropagation();apply(next);return;}if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();discard.current=true;setDraft(String(value));setInvalid(false);e.currentTarget.blur();}}}/>
    <div><button type="button" aria-label={`${pt?'Diminuir':'Decrease'} ${label}`} disabled={value<=min} onClick={()=>apply(value-1)}>−</button><button type="button" aria-label={`${pt?'Aumentar':'Increase'} ${label}`} disabled={value>=max} onClick={()=>apply(value+1)}>+</button></div>
  </div></label>;
}

export default function ShadowEditor({layer,pt,patch}:{layer:TextLayer;pt:boolean;patch:(id:string,values:Partial<TextLayer>)=>void}) {
  const [open,setOpen]=useState(false);
  const enabled=!!layer.shadowColor;
  const choose=(key:'shadowType'|'shadowPosition',options:{value:string;label:string}[],value:string)=><div className="shadow-segment">{options.map(option=><button type="button" aria-pressed={value===option.value} key={option.value} onClick={()=>patch(layer.id,{[key]:option.value})}>{option.label}</button>)}</div>;
  return <div className="shadow-editor"><div className="shadow-heading"><label><input type="checkbox" checked={enabled} onChange={e=>{patch(layer.id,{shadowColor:e.target.checked?'#000000':undefined,shadowBlur:layer.shadowBlur??12,shadowOpacity:layer.shadowOpacity??.5});setOpen(e.target.checked);}}/>{pt?'Sombra':'Shadow'}</label>{enabled&&<button type="button" className="btn" aria-expanded={open} onClick={()=>setOpen(!open)}>{pt?'Editar sombra':'Edit shadow'}</button>}</div>
    {enabled&&open&&<section className="shadow-popover" aria-label={pt?'Configurações da sombra':'Shadow settings'}><header><strong>{pt?'Sombra':'Shadow'}</strong><button type="button" aria-label={pt?'Fechar sombra':'Close shadow'} onClick={()=>setOpen(false)}>×</button></header>
      <div className="shadow-setting"><span>{pt?'Tipo':'Type'}</span>{choose('shadowType',[{value:'box',label:pt?'Simples':'Box'},{value:'realistic',label:pt?'Difusa':'Realistic'}],layer.shadowType??'box')}</div>
      <div className="shadow-setting"><span>{pt?'Posição':'Position'}</span>{choose('shadowPosition',[{value:'outside',label:pt?'Externa':'Outside'},{value:'inside',label:pt?'Interna':'Inside'}],layer.shadowPosition??'outside')}</div>
      <ColorField pt={pt} label={pt?'Cor da sombra':'Shadow color'} color={layer.shadowColor!} opacity={layer.shadowOpacity??.5} onChange={(shadowColor,shadowOpacity)=>patch(layer.id,{shadowColor,shadowOpacity})}/>
      {([{key:'shadowX',label:'X',min:-500,max:500,default:0},{key:'shadowY',label:'Y',min:-500,max:500,default:0},{key:'shadowBlur',label:pt?'Desfoque':'Blur',min:0,max:200,default:12},{key:'shadowSpread',label:pt?'Expansão':'Spread',min:-100,max:100,default:0}] as const).map(field=><ShadowNumber key={field.key} pt={pt} label={field.label} value={layer[field.key]??field.default} min={field.min} max={field.max} onChange={value=>patch(layer.id,{[field.key]:value})}/>)}
    </section>}
  </div>;
}
