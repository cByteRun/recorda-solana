import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getPhantom } from '@/shared/solana/phantom';
export type EvidenceState='due'|'pending'|'failed'|'unknown'|'confirmed';
export interface Member {id:string;name:string;role:'operator'|'reviewer'|'auditor';scopes:string[];wallet?:string|null;workspace:'demo'|'live'}
export interface Right {id:string;holder:string;name:string;units:string;principalMinor:string;couponMinor:string;expectedMinor:string;confirmedMinor:string;status:EvidenceState;signature:string|null;referenceStatus?:string;referenceEvidence?:string;settledSlot:string|null;destination?:string|null;evidence:string;calculated:boolean;source:string;next:{label:string;execute:boolean;reason:string}}
export interface Action {id:string;version:number;label:string;instrument:string;kind:string;status:string;recordAt:string;recordSlot?:string;dueAt?:string|null;dueSource?:string|null;timing:'complete'|'overdue'|'upcoming'|'unscheduled';asset:string;currency:string;decimals:number;faceMinor?:string;rateBps?:number;frequency?:number;approved:boolean;funded:boolean;receipt:string|null;verified:boolean;source:string;rights:Right[];snapshotHash?:string;verificationError?:string;signatures?:{signature:string;slot:number;err:unknown;finality:string}[];quorumBps?:number;yes?:string;no?:string;abstain?:string;passed?:boolean}
export interface Instrument {id:string;symbol:string;name:string;authority:string;asset:string;currency:string;decimals:number;faceMinor:string;rateBps:number;frequency:number;supply:string;redeemedSupply:string;maturity:string;source:string;verified:boolean}
export interface Case {id:string;action:string;instrument:string;holder:string;status:'open'|'investigating'|'resolved';owner:string|null;createdAt:string;resolvedAt?:string;reason:string;history:{at:string;actor:string;note:string;evidence?:string}[];lastEvidence?:string}
export interface AuditEvent {id:string;at:string;actor:string;type:string;title:string;detail:string;instrument?:string;action?:string;caseId?:string;source?:string;evidence?:string}
export interface Notification {id:string;type:string;title:string;instrument:string;action:string;recipient:string;createdAt:string;readAt:string|null;channel:string;delivery:string}
export interface Workspace {mode:'demo'|'live';revision:number;instruments:Instrument[];actions:Action[];cases:Case[];audit:AuditEvent[];notifications:Notification[];members:Member[];totals:{asset:string;currency:string;decimals:number;expected:string;confirmed:string;unsettled:string;unknown:string}[];preferences:{leadHours:number;escalateHours:number};lastSync:string|null;syncError:string|null;serverTime:string;network?:string}
interface Session {mode:'demo'|'live';member:Member|null;csrf:string|null;demoEnabled:boolean;liveConfigured:boolean}
interface BondOps {data:Workspace|null;session:Session|null;source:'demo'|'live';busy:boolean;error:string|null;changeSource(source:'demo'|'live'):Promise<void>;signIn(demoMember?:string):Promise<void>;logout():Promise<void>;mutate(path:string,body?:unknown):Promise<void>;reload():Promise<void>;exportReport():Promise<void>}
const Context=createContext<BondOps|null>(null);
function selectedSource(): 'demo'|'live' {try{return sessionStorage.getItem('bondops-source')==='live'?'live':'demo';}catch{return 'demo';}}
async function request<T>(path:string,init?:RequestInit){const response=await fetch(`/api/bondops${path}`,{credentials:'same-origin',...init});if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Операционные данные недоступны. Повторите загрузку или обратитесь к администратору.');const data=await response.json();if(!response.ok)throw new Error(data.error??`BondOps API ${response.status}`);return data as T;}
export function BondOpsProvider({children}:{children:ReactNode}){
 const [data,setData]=useState<Workspace|null>(null),[session,setSession]=useState<Session|null>(null),[source,setSource]=useState<'demo'|'live'>(selectedSource),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const generation=useRef(0),csrf=useRef<string|null>(null),activeSource=useRef(source),locked=useRef(false);
 const load=useCallback(async(mode:'demo'|'live')=>{const generationId=++generation.current;try{const next=await request<Workspace>(`/workspace?source=${mode}`);if(generationId===generation.current){setData(next);}}catch(e){if(generationId===generation.current){setData(null);throw e;}}},[]);
 useEffect(()=>{let active=true;void (async()=>{try{const s=await request<Session>('/session');if(!active)return;const mode=s.member?.workspace??(s.demoEnabled?activeSource.current:'live');setSession(s);csrf.current=s.csrf;activeSource.current=mode;setSource(mode);await load(mode);}catch(e){if(active)setError((e as Error).message);}})();return()=>{active=false;generation.current++;};},[load]);
 useEffect(()=>{const id=setInterval(()=>{if(!locked.current)void load(activeSource.current).catch(e=>setError(e.message));},30000);return()=>clearInterval(id);},[load]);
 async function perform(fn:()=>Promise<void>){if(locked.current)return;locked.current=true;setBusy(true);setError(null);try{await fn();}catch(e){setError((e as Error).message);}finally{locked.current=false;setBusy(false);}}
 const post=<T,>(path:string,body:unknown={})=>request<T>(path,{method:'POST',headers:{'content-type':'application/json',...(csrf.current?{'x-bondops-csrf':csrf.current}:{})},body:JSON.stringify(body)});
 async function logoutInternal(){await post('/auth/logout');csrf.current=null;setSession(s=>s?{...s,member:null,csrf:null}:null);}
 const api:BondOps={data,session,source,busy,error,
  reload:()=>perform(()=>load(activeSource.current)),
  changeSource:mode=>perform(async()=>{if(session?.member)await logoutInternal();generation.current++;activeSource.current=mode;setSource(mode);try{sessionStorage.setItem('bondops-source',mode);}catch{/* Selection still applies for this page. */}setData(null);await load(mode);}),
  logout:()=>perform(async()=>{await logoutInternal();setData(null);if(source==='demo')await load('demo');}),
  signIn:(demoMember='demo-operator')=>perform(async()=>{
   let result:Pick<Session,'mode'|'member'|'csrf'>;
   if(source==='demo')result=await post('/auth/demo',{member:demoMember});
   else {const provider=getPhantom();if(!provider.signMessage)throw Error('Wallet message signing is required for workspace login');const wallet=(await provider.connect()).publicKey.toBase58(),challenge=await post<{id:string;message:string}>('/auth/challenge',{wallet});const signed=await provider.signMessage(new TextEncoder().encode(challenge.message),'utf8');result=await post('/auth/verify',{id:challenge.id,signature:btoa(String.fromCharCode(...signed.signature))});}
   csrf.current=result.csrf;setSession(s=>({...s!,...result}));await load(source);
  }),
  mutate:(path,body)=>perform(async()=>{try{const next=await post<Workspace>(`${path}?source=${source}`,body);generation.current++;setData(next);}catch(e){await load(source).catch(()=>{});throw e;}}),
  exportReport:()=>perform(async()=>{const report=await request<unknown>(`/export?source=${source}`);const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`recorda-bondops-${source}.json`;link.click();URL.revokeObjectURL(url);}),
 };
 return <Context.Provider value={api}>{children}</Context.Provider>;
}
export function useBondOps(){const value=useContext(Context);if(!value)throw Error('BondOpsProvider missing');return value;}
export function amount(minor:string|undefined,decimals=2){if(minor===undefined)return '—';const n=BigInt(minor),base=10n**BigInt(decimals);return `${(n/base).toLocaleString('en-US')}${decimals?'.'+(n%base).toString().padStart(decimals,'0'):''}`;}
export function dateTime(iso:string|null|undefined){return iso?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short',timeZoneName:undefined}).format(new Date(iso)):'Не назначен';}
export function actionHref(action:Action){return action.source==='illustrative'?`/actions?kind=${action.kind}`:`/${action.version===1?'protocol':'actions'}?action=${encodeURIComponent(action.id)}`;}
