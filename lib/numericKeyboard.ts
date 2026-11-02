// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
type NumericKeys=Pick<KeyboardEvent,'key'|'shiftKey'|'ctrlKey'|'metaKey'|'altKey'>;
export function numericKeyValue(event:NumericKeys,value:number,{step=1,min=-Infinity,max=Infinity,integer=false,horizontal=false}:{step?:number;min?:number;max?:number;integer?:boolean;horizontal?:boolean}={}):number|null{
  const direction=event.key==='ArrowUp'||horizontal&&event.key==='ArrowRight'?1:event.key==='ArrowDown'||horizontal&&event.key==='ArrowLeft'?-1:0;
  if(!direction||event.altKey||(event.ctrlKey||event.metaKey)&&!event.shiftKey||!Number.isFinite(value))return null;
  const base=Number.isFinite(step)&&step>0?step:1;
  const amount=integer?Math.max(1,base):base/(event.shiftKey?(event.metaKey||event.ctrlKey?100:10):1);
  const next=Math.max(min,Math.min(max,value+direction*amount));
  if(!Number.isFinite(next))return null;
  return Number((integer?Math.round(next):next).toFixed(10));
}
export function numericDecimals(value:number){return Number.isFinite(value)?(value.toFixed(10).replace(/0+$/,'').split('.')[1]?.length??0):0;}
export function integerNumericKey(key:string){return /^(count|rows|cols|columns|segments|sides|copies|seed|frames|steps|iterations|layers|mediaIndex|cardIndex|frame|_fade|_layerFade)$/.test(key);}
