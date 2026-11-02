// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import {create} from 'zustand';
export interface UpdateInfo {current:string;managed:boolean;desktop?:boolean;available:boolean;latest?:{version:string;sha:string;url:string;notes:string[]};previous:string|null;token:string;checkedAt:number;error?:string;job:{id:string;phase:string;message:string;version:string}|null}
interface Updates {info:UpdateInfo|null;loading:boolean;auto:boolean;error:string;armed:boolean;setAuto:(v:boolean)=>void;hydrate:()=>void}
const key='rp-motionstudio-update-checks';
export const useUpdateStore=create<Updates>(set=>({info:null,loading:false,auto:true,error:'',armed:false,
  hydrate:()=>{try{set({auto:localStorage.getItem(key)!=='off'});}catch{}},
  setAuto:auto=>{try{localStorage.setItem(key,auto?'on':'off');set({auto,error:''});}catch{set({error:'Não foi possível salvar a preferência.'});}}
}));
let pending:Promise<void>|null=null;
export function refreshUpdates(remote=false,force=false){
  if(pending)return pending;
  useUpdateStore.setState({loading:true});
  pending=(async()=>{try{const response=await fetch(`/api/updates${remote?`?check=1${force?'&force=1':''}`:''}`,{cache:'no-store',signal:AbortSignal.timeout(remote?28000:5000)});if(!response.ok)throw Error('A consulta de atualização está indisponível nesta instalação.');const info:UpdateInfo=await response.json();useUpdateStore.setState({info,error:''});}catch(error){useUpdateStore.setState({error:error instanceof Error?error.message:'Sem conexão com o serviço local.'});}finally{pending=null;useUpdateStore.setState({loading:false});}})();return pending;
}
export const updateRunning=(info:UpdateInfo|null)=>!!info?.job&&['queued','downloading','dependencies','building','testing','ready'].includes(info.job.phase);
