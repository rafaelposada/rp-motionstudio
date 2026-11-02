// RP MotionStudio desktop additions — Rafael Posada, 2026. Apache-2.0.
export interface DesktopRequest {id:string;action:string;payload?:unknown}
export interface DesktopAPI {
  platform:string;
  onRequest(callback:(request:DesktopRequest)=>void):()=>void;
  respond(id:string,result:{ok:boolean;value?:unknown;error?:string}):void;
  chooseFolder():Promise<string|null>;
  openProject():Promise<{name:string;bytes:Uint8Array}|null>;
  appearance(theme:'light'|'dark'):void;
  locale?(value:'pt'|'en'|'es'):void;
  prepareUpdate?():Promise<{version:string}>;
  applyUpdate?():Promise<boolean>;
  onUpdateProgress?(callback:(progress:{phase:string;received?:number;total?:number;version?:string})=>void):()=>void;
}
declare global {interface Window {rpDesktop?:DesktopAPI}}
const tasks = new Set<string>();
export function setDesktopBusy(task:string,busy:boolean) {if(busy)tasks.add(task);else tasks.delete(task);}
export function desktopBusy() {return tasks.size>0;}
export function desktopAPI() {return typeof window === 'undefined'?undefined:window.rpDesktop;}
