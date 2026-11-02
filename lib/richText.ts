// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
import type { TextLayer } from './textLayers';
export type InlineStyle = Partial<Pick<TextLayer,'font'|'weight'|'color'|'fillOpacity'>>;
export interface TextRun {start:number;end:number;style:InlineStyle}
export interface TextRange {layerId:string;text:string;start:number;end:number}
const keys=['font','weight','color','fillOpacity'] as const;
export function resolvedTextSpans(layer:TextLayer,start=0,end=layer.text.length) {
  const points=new Set([Math.max(0,start),Math.min(layer.text.length,end)]);
  const runs=(layer.runs??[]).filter(r=>Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.end>start&&r.start<end&&r.end>r.start);
  for(const run of runs){points.add(Math.max(start,run.start));points.add(Math.min(end,run.end));}
  const sorted=[...points].sort((a,b)=>a-b);
  return sorted.slice(0,-1).map((a,i)=>{
    const b=sorted[i+1],style={font:layer.font,weight:layer.weight,color:layer.color,fillOpacity:layer.fillOpacity??1};
    for(const run of runs)if(run.start<=a&&run.end>=b)for(const key of keys){const value=run.style?.[key];if(value!==undefined)Object.assign(style,{[key]:value});}
    return {start:a,end:b,text:layer.text.slice(a,b),style};
  }).filter(span=>span.end>span.start);
}
function compactRuns(layer:TextLayer,runs:TextRun[]) {
  const normalized:TextRun[]=[];
  for(const span of resolvedTextSpans({...layer,runs})){
    const style:InlineStyle={};
    for(const key of keys)if(span.style[key]!== (key==='fillOpacity'?layer.fillOpacity??1:layer[key]))Object.assign(style,{[key]:span.style[key]});
    if(!Object.keys(style).length)continue;
    const last=normalized.at(-1);
    if(last?.end===span.start&&JSON.stringify(last.style)===JSON.stringify(style))last.end=span.end;
    else normalized.push({start:span.start,end:span.end,style});
  }
  return normalized;
}
export function validTextRange(layer:TextLayer,range:TextRange|null) {
  return range?.layerId===layer.id&&range.text===layer.text&&range.start>=0&&range.end<=layer.text.length&&range.end>range.start?range:null;
}
export function applyInlineStyle(layer:TextLayer,style:InlineStyle,range:TextRange|null):Partial<TextLayer> {
  const selected=validTextRange(layer,range);
  if(!selected){
    const next={...layer,...style};
    const runs=(layer.runs??[]).map(run=>{const rest={...run.style};for(const key of keys)if(key in style)delete rest[key];return {...run,style:rest};});
    return {...style,runs:compactRuns(next,runs)};
  }
  return {runs:compactRuns(layer,[...(layer.runs??[]),{start:selected.start,end:selected.end,style}])};
}
export function inlineProperty<K extends keyof InlineStyle>(layer:TextLayer,key:K,range:TextRange|null):{mixed:boolean;value:InlineStyle[K]} {
  const selection=validTextRange(layer,range),spans=resolvedTextSpans(layer,selection?.start??0,selection?.end??layer.text.length);
  const value=spans[0]?.style[key]??(key==='fillOpacity'?layer.fillOpacity??1:layer[key]);
  return {mixed:spans.some(span=>span.style[key]!==value),value};
}
export function remapTextRuns(layer:TextLayer,text:string):TextRun[]|undefined {
  if(!layer.runs?.length||text===layer.text)return layer.runs;
  let prefix=0,suffix=0;
  while(prefix<Math.min(layer.text.length,text.length)&&layer.text[prefix]===text[prefix])prefix++;
  while(suffix<Math.min(layer.text.length-prefix,text.length-prefix)&&layer.text[layer.text.length-1-suffix]===text[text.length-1-suffix])suffix++;
  // An edit must never split a surrogate pair between differently styled runs.
  if(prefix>0&&/[\uD800-\uDBFF]/.test(layer.text[prefix-1])&&/[\uDC00-\uDFFF]/.test(layer.text[prefix]??''))prefix--;
  if(suffix>0&&/[\uDC00-\uDFFF]/.test(layer.text[layer.text.length-suffix])&&/[\uD800-\uDBFF]/.test(layer.text[layer.text.length-suffix-1]??''))suffix--;
  const removedEnd=layer.text.length-suffix,insertEnd=text.length-suffix,delta=text.length-layer.text.length;
  const runs:TextRun[]=[];
  for(const run of layer.runs){
    if(run.start<prefix)runs.push({...run,end:Math.min(prefix,run.end)});
    if(run.end>removedEnd)runs.push({...run,start:Math.max(run.start,removedEnd)+delta,end:run.end+delta});
  }
  if(insertEnd>prefix){const inherited=resolvedTextSpans(layer,Math.max(0,prefix-1),Math.max(1,prefix))[0]?.style;
    if(inherited)runs.push({start:prefix,end:insertEnd,style:inherited});}
  return compactRuns({...layer,text},runs);
}
export function textFontVariants(layer:TextLayer) {
  const variants=new Map<string,{font:string;weight:number}>();
  for(const style of [{font:layer.font,weight:layer.weight},...resolvedTextSpans(layer).map(span=>span.style)])variants.set(`${style.font}:${style.weight}`,{font:style.font,weight:style.weight});
  return [...variants.values()];
}
export function richTextLines(ctx:CanvasRenderingContext2D,layer:TextLayer,text=layer.text,size=layer.size) {
  let offset=0;
  return text.split('\n').map(line=>{
    const start=offset;offset+=line.length+1;
    const spans=resolvedTextSpans(layer,start,start+line.length),spacing=layer.letterSpacing??0;
    const chunks=spans.flatMap(span=>spacing?[...span.text].map(char=>({text:char,style:span.style})):[{text:span.text,style:span.style}]);
    let x=0;
    const measured=chunks.map(chunk=>{
      const font=`${chunk.style.weight} ${size}px "${chunk.style.font}", sans-serif`;ctx.font=font;
      const width=ctx.measureText(chunk.text).width,segment={...chunk,font,x,width};x+=width+spacing;return segment;
    });
    return {segments:measured,width:Math.max(0,x-(measured.length?spacing:0))};
  });
}
