// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
type ArrangeKeys = Pick<KeyboardEvent,'key'|'code'|'metaKey'|'ctrlKey'|'shiftKey'|'altKey'>;
export function compositionArrangeShortcut(event: ArrangeKeys): 'front' | 'back' | null {
  if(!(event.metaKey||event.ctrlKey)||!event.shiftKey||event.altKey)return null;
  if(event.code==='BracketRight'||event.key===']'||event.key==='}')return 'front';
  if(event.code==='BracketLeft'||event.key==='['||event.key==='{')return 'back';
  return null;
}
