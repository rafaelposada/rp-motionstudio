export type TextPadding = number | [number,number,number,number];
export function textPadding(value?:TextPadding):[number,number,number,number]{
  const p=value===undefined?[15,18,15,18]:typeof value==='number'?[value,value,value,value]:value;
  return [0,1,2,3].map(i=>Number.isFinite(p[i])?Math.max(0,Math.min(400,p[i])):0) as [number,number,number,number];
}
export function textBackdropBox(textWidth:number,inkHeight:number,align:string,padding?:TextPadding){
  const [top,right,bottom,left]=textPadding(padding);
  return {x:(align==='left'?0:align==='right'?-textWidth:-textWidth/2)-left,y:-inkHeight/2-top,width:textWidth+left+right,height:inkHeight+top+bottom};
}
