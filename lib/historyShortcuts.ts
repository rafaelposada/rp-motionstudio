export interface HistoryKey { key:string;code?:string;metaKey:boolean;ctrlKey:boolean;shiftKey:boolean;altKey:boolean;repeat?:boolean;isComposing?:boolean }
export function historyShortcut(event:HistoryKey):'undo'|'redo'|null {
  if(!(event.metaKey||event.ctrlKey)||event.altKey||event.repeat||event.isComposing)return null;
  const key=event.key.toLowerCase(),z=key==='z'||event.code==='KeyZ',y=key==='y'||event.code==='KeyY';
  if(z)return event.shiftKey?'redo':'undo';
  if(y&&event.ctrlKey&&!event.metaKey&&!event.shiftKey)return 'redo';
  return null;
}
