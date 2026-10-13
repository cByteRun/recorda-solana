import { PublicKey, SystemProgram, Transaction, type TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { connection, RPC_URL, RPC_NETWORK } from './config';
import { createProtocol, u64, RECORDA_PROGRAM_ID } from './protocol';
import { getPhantom } from './phantom';
import { createChainReader } from './bondops-reader';
import type { Workspace, Member, Action, Right } from '@/features/bondops/model/bondops-context';
export {PublicKey,Transaction};
const zero=SystemProgram.programId;
const address=(s:string)=>new PublicKey(s);
const pda=(...seeds:Uint8Array[])=>PublicKey.findProgramAddressSync(seeds,RECORDA_PROGRAM_ID)[0];
const seed=(s:string)=>Buffer.from(s), integer=(n:string|number)=>u64(n).toArrayLike(Buffer,'le',8);
export const opsPdas={
 workspace:(instrument:string)=>pda(seed('ops-workspace'),address(instrument).toBytes()),
 member:(workspace:PublicKey,wallet:string)=>pda(seed('ops-member'),workspace.toBytes(),address(wallet).toBytes()),
 deadline:(workspace:PublicKey,action:string)=>pda(seed('ops-deadline'),workspace.toBytes(),address(action).toBytes()),
 case:(workspace:PublicKey,action:string,holder:string)=>pda(seed('ops-case'),workspace.toBytes(),address(action).toBytes(),address(holder).toBytes()),
 audit:(workspace:PublicKey,sequence:string)=>pda(seed('ops-audit'),workspace.toBytes(),integer(sequence)),
 notice:(workspace:PublicKey,action:string,recipient:string,kind:number,stamp:number,subject:string)=>pda(seed('ops-notice'),workspace.toBytes(),address(action).toBytes(),address(recipient).toBytes(),Buffer.from([kind]),integer(stamp),address(subject).toBytes()),
};
const finalized=new Proxy(connection,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(['getAccountInfo','getMultipleAccountsInfo','getProgramAccounts'].includes(String(key)))return (address:PublicKey,config:unknown)=>value.call(target,address,{...(typeof config==='object'&&config?config:{}),commitment:'finalized'});return value.bind(target);}});
const program=createProtocol(finalized).program;
let reader:Awaited<ReturnType<typeof createChainReader>>|undefined;
async function source(){return reader??=await createChainReader(RPC_URL,{rpc:connection,network:RPC_NETWORK});}
const iso=(n:{toString():string}|number)=>new Date(Number(n.toString())*1000).toISOString();
const role=(n:number):Member['role']=>n===2?'reviewer':n===3?'auditor':'operator';
function next(a:Action,r:Right):Right['next']{
 if(r.status==='confirmed')return {label:'View execution proof',execute:false,reason:'Execution is confirmed; another payment is forbidden.'};
 if(!a.verified||r.status==='pending'||r.status==='unknown')return {label:'Reconcile before retry',execute:false,reason:'Verify finalized rights and any retained broadcast before another payment.'};
 return {label:!a.approved?'Review and approve':!a.funded?'Review funding':'Open authorized action',execute:true,reason:'Continue the existing Rust action lifecycle with the required signer.'};
}
export async function loadProgramWorkspace(wallet:string|null,previous:Workspace|null):Promise<Workspace>{
 const data=await (await source()).sync(['*'],{actions:previous?.actions??[]});
 const [workspaces,members,deadlines,cases,entries,notices]=await Promise.all([
  program.account.opsWorkspace.all(),program.account.opsMember.all(),program.account.opsDeadline.all(),program.account.opsCase.all(),program.account.opsAudit.all(),program.account.opsNotice.all(),
 ]);
 const profiles=workspaces.filter(w=>data.instruments.some(i=>i.id===w.account.instrument.toBase58())&&w.publicKey.equals(opsPdas.workspace(w.account.instrument.toBase58())));
 const profile=(instrument:string)=>profiles.find(w=>w.account.instrument.toBase58()===instrument);
 const validMembers=members.filter(m=>profiles.some(w=>w.publicKey.equals(m.account.workspace))&&m.publicKey.equals(opsPdas.member(m.account.workspace,m.account.wallet.toBase58())));
 const team:Member[]=profiles.map(w=>({id:w.account.admin.toBase58(),wallet:w.account.admin.toBase58(),name:`Workspace admin ${w.account.admin.toBase58().slice(0,6)}`,role:'operator',scopes:[w.account.instrument.toBase58()],workspace:'live'}));
 for(const m of validMembers.filter(m=>m.account.active)){const instrument=profiles.find(w=>w.publicKey.equals(m.account.workspace))!.account.instrument.toBase58();team.push({id:m.account.wallet.toBase58(),wallet:m.account.wallet.toBase58(),name:m.account.name,role:role(m.account.role),scopes:[instrument],workspace:'live'});}
 const consolidated:Member[]=[];
 for(const m of team){const existing=consolidated.find(x=>x.id===m.id&&x.role===m.role);if(existing)existing.scopes=[...new Set([...existing.scopes,...m.scopes])];else consolidated.push({...m});}
 const at=new Date().toISOString();
 const state:Workspace={schema:2,mode:'live',revision:0,...data,cases:[],audit:[],notifications:[],members:consolidated,totals:[],preferences:{leadHours:72,escalateHours:24},lastSync:at,syncError:data.actions.some(a=>!a.verified)?'Some actions could not be verified':null,serverTime:at,network:RPC_NETWORK==='local'?'Local validator':'Solana Devnet',opsWorkspaces:profiles.map(w=>({instrument:w.account.instrument.toBase58(),admin:w.account.admin.toBase58(),leadHours:w.account.leadHours,escalateHours:w.account.escalateHours,sequence:w.account.sequence.toString()}))};
 const owned=state.opsWorkspaces?.find(w=>w.admin===wallet)??state.opsWorkspaces?.[0];if(owned)state.preferences={leadHours:owned.leadHours,escalateHours:owned.escalateHours};
 for(const a of state.actions){const w=profile(a.instrument);const due=w&&deadlines.find(d=>d.publicKey.equals(opsPdas.deadline(w.publicKey,a.id))&&d.account.workspace.equals(w.publicKey)&&d.account.action.toBase58()===a.id);if(due){a.dueAt=iso(due.account.dueAt);a.dueSource='Rust program schedule';}
  a.timing=a.status==='cancelled'||a.verified&&['settled','finalized'].includes(a.status)?'complete':!a.dueAt?'unscheduled':Date.parse(a.dueAt)<Date.now()?'overdue':'upcoming';
  for(const r of a.rights){if(a.kind==='voting'||!r.calculated||BigInt(r.expectedMinor)<=0n){r.next=next(a,r);continue;}
   const id=opsPdas.case(opsPdas.workspace(a.instrument),a.id,r.holder).toBase58();const saved=cases.find(c=>c.publicKey.toBase58()===id&&c.account.action.toBase58()===a.id&&c.account.holder.toBase58()===r.holder);
   if(saved?.account.signature){r.signature=saved.account.signature;try{const proof=await (await source()).transaction(r.signature,a,r);if(r.status!=='confirmed'){r.status=proof.status;r.evidence=proof.evidence;r.confirmedMinor='0';}else{r.referenceStatus=proof.status;r.referenceEvidence=proof.evidence;}}catch(e){if(r.status!=='confirmed'){r.status='unknown';r.evidence=(e as Error).message;r.confirmedMinor='0';}}}
   r.next=next(a,r);
   if(saved||r.status!=='confirmed')state.cases.push({id,action:a.id,instrument:a.instrument,holder:r.holder,owner:saved&&!saved.account.owner.equals(zero)?saved.account.owner.toBase58():null,status:r.status==='confirmed'?'resolved':saved?.account.status===1?'investigating':'open',createdAt:saved?iso(saved.account.createdAt):a.recordAt,reason:r.status,history:entries.filter(e=>e.account.subject.toBase58()===id&&e.account.kind===3).sort((x,y)=>Number(x.account.sequence.sub(y.account.sequence))).map(e=>({at:iso(e.account.at),actor:e.account.actor.toBase58(),note:e.account.note})),lastEvidence:r.evidence});
  }
 }
 for(const e of entries.filter(e=>profiles.some(w=>w.publicKey.equals(e.account.workspace))&&e.publicKey.equals(opsPdas.audit(e.account.workspace,e.account.sequence.toString())))){const w=profiles.find(w=>w.publicKey.equals(e.account.workspace))!;state.audit.push({id:e.publicKey.toBase58(),at:iso(e.account.at),actor:e.account.actor.toBase58(),type:['settings','membership','schedule','case','reference'][e.account.kind]??'program',title:['Notification rules','Team permissions','Payment deadline','Case decision','Retained reference'][e.account.kind]??'Program event',detail:e.account.note,instrument:w.account.instrument.toBase58(),action:e.account.action.equals(zero)?undefined:e.account.action.toBase58(),caseId:e.account.kind===3?e.account.subject.toBase58():undefined,source:'rust-program',evidence:`PDA ${e.publicKey.toBase58()} · slot ${e.account.slot}`});}
 for(const a of state.actions)for(const s of a.signatures??[])state.audit.push({id:s.signature,at:a.recordAt,actor:'Solana',type:'chain',title:a.label,detail:`${s.err?'Failed transaction':'Program transaction'} · slot ${s.slot}`,action:a.id,instrument:a.instrument,source:'solana-finalized',evidence:s.signature});
 state.audit.sort((a,b)=>a.at.localeCompare(b.at));
 for(const n of notices.filter(n=>n.account.recipient.toBase58()===wallet&&profiles.some(w=>w.publicKey.equals(n.account.workspace)))){const a=state.actions.find(a=>a.id===n.account.action.toBase58());if(!a)continue;const stamp=Number(n.account.stamp.toString()),expected=opsPdas.notice(n.account.workspace,a.id,n.account.recipient.toBase58(),n.account.kind,stamp,n.account.subject.toBase58());if(!n.publicKey.equals(expected))continue;const superseded=n.account.kind<2&&a.dueAt!==iso(stamp);state.notifications.push({id:n.publicKey.toBase58(),type:['deadline','overdue','exception','escalation'][n.account.kind],title:`${a.label} · ${['Deadline approaching','Overdue payment','Exception','Escalation'][n.account.kind]}`,instrument:a.instrument,action:a.id,recipient:n.account.recipient.toBase58(),createdAt:iso(n.account.createdAt),readAt:Number(n.account.readAt.toString())?iso(n.account.readAt):superseded?at:null,channel:'on-chain inbox',delivery:superseded?'superseded':'available'});}
 state.totals=workspaceTotals(state.actions);return state;
}
function workspaceTotals(actions:Action[]):Workspace['totals']{
 const groups=new Map<string,Workspace['totals'][number]>();for(const a of actions.filter(a=>a.kind!=='voting'&&a.status!=='cancelled')){const id=`${a.asset}:${a.decimals}`,t=groups.get(id)??{asset:a.asset,currency:a.currency,decimals:a.decimals,expected:'0',confirmed:'0',unsettled:'0',unknown:'0'};for(const r of a.rights.filter(r=>r.calculated)){t.expected=(BigInt(t.expected)+BigInt(r.expectedMinor)).toString();t.confirmed=(BigInt(t.confirmed)+BigInt(r.confirmedMinor)).toString();t.unsettled=(BigInt(t.unsettled)+BigInt(r.expectedMinor)-BigInt(r.confirmedMinor)).toString();if(r.status==='unknown')t.unknown=(BigInt(t.unknown)+BigInt(r.expectedMinor)-BigInt(r.confirmedMinor)).toString();}groups.set(id,t);}return [...groups.values()];
}
export function unavailableProgramWorkspace(previous:Workspace,error:string):Workspace{
 const state=structuredClone(previous);state.syncError=error;state.lastSync=previous.lastSync;
 for(const i of state.instruments)i.verified=false;
 for(const a of state.actions){a.verified=false;a.verificationError=error;for(const r of a.rights){r.status='unknown';r.confirmedMinor='0';r.evidence='RPC unavailable: last known obligation is retained, execution is not freshly confirmed.';r.next=next(a,r);}}
 for(const c of state.cases){if(c.status==='resolved')c.status='investigating';c.reason='unknown';}
 for(const a of state.actions.filter(a=>a.kind!=='voting'&&a.status!=='cancelled'))for(const r of a.rights.filter(r=>r.calculated&&BigInt(r.expectedMinor)>0n)){if(!state.cases.some(c=>c.action===a.id&&c.holder===r.holder))state.cases.push({id:opsPdas.case(opsPdas.workspace(a.instrument),a.id,r.holder).toBase58(),action:a.id,instrument:a.instrument,holder:r.holder,owner:null,status:'open',createdAt:a.recordAt,reason:'unknown',history:[],lastEvidence:r.evidence});}
 state.totals=workspaceTotals(state.actions);return state;
}
export function walletMember(state:Workspace|null,wallet:string|null):Member|null{if(!wallet)return null;const records=state?.members.filter(m=>m.wallet===wallet)??[];return records.find(m=>m.role==='operator')??records.find(m=>m.role==='reviewer')??records[0]??{id:wallet,wallet,name:wallet.slice(0,8),role:'auditor',scopes:[],workspace:'live'};}
async function send(ix:TransactionInstruction,actor:PublicKey){const provider=getPhantom();if(!provider.publicKey)await provider.connect();if(!provider.publicKey?.equals(actor))throw Error('Connected wallet changed; reconnect before signing');const block=await connection.getLatestBlockhash('confirmed');const tx=new Transaction({feePayer:actor,...block}).add(ix);const signed=await provider.signTransaction(tx);if(!getPhantom().publicKey?.equals(actor))throw Error('Wallet changed before broadcast');const signature=await connection.sendRawTransaction(signed.serialize(),{skipPreflight:false,maxRetries:2});const result=await connection.confirmTransaction({signature,...block},'finalized');if(result.value.err)throw Error(`Program transaction failed: ${signature}`);return signature;}
export async function mutateProgramWorkspace(path:string,body:Record<string,unknown>,state:Workspace,wallet:string){
 if(path==='/cases'&&new TextEncoder().encode(String(body.note??'')).length>240)throw Error('On-chain case note must be at most 240 UTF-8 bytes');
 if(path==='/members'&&new TextEncoder().encode(String(body.name??'')).length>80)throw Error('On-chain member name must be at most 80 UTF-8 bytes');
 const actor=address(wallet),instrument=String(body.instrument??(Array.isArray(body.scopes)&&body.scopes[0]!=='*'?body.scopes[0]:undefined)??state.actions.find(a=>a.id===body.action)?.instrument??state.cases.find(c=>c.id===body.id)?.instrument??state.opsWorkspaces?.find(w=>w.admin===wallet||state.members.some(m=>m.wallet===wallet&&m.role!=='auditor'&&m.scopes.includes(w.instrument)))?.instrument??'');
 if(path==='/refresh')return;
 if(path==='/notifications/read'){await send(await program.methods.readOpsNotice().accountsStrict({actor,notice:address(String(body.id))}).instruction(),actor);return;}
 if(!instrument)throw Error('Select an instrument and initialize its on-chain workspace');
 const workspace=opsPdas.workspace(instrument),profile=await program.account.opsWorkspace.fetchNullable(workspace,'finalized');
 if(path==='/initialize'){const governance=pda(seed('governance'),address(instrument).toBytes());await send(await program.methods.initializeOps().accountsStrict({actor,instrument:address(instrument),governance:await connection.getAccountInfo(governance)?governance:null,workspace,systemProgram:zero}).instruction(),actor);return;}
 if(!profile)throw Error('Initialize this instrument workspace in Settings first');
 const member=profile.admin.equals(actor)?null:opsPdas.member(workspace,wallet);
 const base={actor,workspace,member,entry:opsPdas.audit(workspace,profile.sequence.toString()),systemProgram:zero};
 let ix:TransactionInstruction;
 if(path==='/settings')ix=await program.methods.configureOps(Number(body.leadHours),Number(body.escalateHours),profile.sequence).accountsStrict(base).instruction();
 else if(path==='/schedule')ix=await program.methods.setOpsDeadline(u64(Math.floor(Date.parse(String(body.dueAt))/1000)),profile.sequence).accountsStrict({...base,action:address(String(body.action)),deadline:opsPdas.deadline(workspace,String(body.action))}).instruction();
 else if(path==='/cases'||path==='/reference'){
  const c=state.cases.find(c=>c.id===body.id),a=state.actions.find(a=>a.id===(body.action??c?.action)),r=a?.rights.find(r=>r.holder===(body.holder??c?.holder));if(!a||!r)throw Error('Action/right unavailable');const holder=address(r.holder),accounts={...base,action:address(a.id),right:address(r.id),case:opsPdas.case(workspace,a.id,r.holder)};
  if(path==='/reference'){await (await source()).transaction(String(body.signature),a,r);ix=await program.methods.retainOpsReference(holder,String(body.signature),profile.sequence).accountsStrict(accounts).instruction();}
  else{const owner=body.owner?address(String(body.owner)):zero;ix=await program.methods.updateOpsCase(holder,owner,['open','investigating','resolved'].indexOf(String(body.status)),String(body.note),profile.sequence).accountsStrict({...accounts,assignee:owner.equals(zero)||owner.equals(profile.admin)?null:opsPdas.member(workspace,owner.toBase58())}).instruction();}
 }else if(path==='/members'){
  const target=state.members.find(m=>m.id===body.id),wallet=String(body.wallet??target?.wallet??body.id),roles={operator:1,reviewer:2,auditor:3};
  ix=await program.methods.setOpsMember(address(wallet),roles[(body.role??target?.role??'auditor') as keyof typeof roles],String(body.name??target?.name??wallet.slice(0,8)),!body.revoke,profile.sequence).accountsStrict({actor,workspace,target:opsPdas.member(workspace,wallet),entry:base.entry,systemProgram:zero}).instruction();
 }else if(path==='/sweep'){
  // Solana has no autonomous clock execution; every notice creation is a signed transaction.
  const slot=await connection.getSlot('finalized'),now=await connection.getBlockTime(slot);if(now===null)throw Error('Chain clock unavailable');
  for(const a of state.actions.filter(a=>a.instrument===instrument&&a.timing!=='complete')){
   const due=a.dueAt?Math.floor(Date.parse(a.dueAt)/1000):null;
   const candidates:{recipient:string;kind:number;stamp:number;caseId?:string;right?:string}[]=[];
   if(due!==null&&(a.dueSource==='Rust program schedule'||a.dueSource?.startsWith('on-chain'))&&due-now<=profile.leadHours*3600)for(const m of state.members.filter(m=>m.role!=='auditor'&&m.scopes.includes(instrument)))candidates.push({recipient:m.id,kind:now>due?1:0,stamp:due});
   for(const c of state.cases.filter(c=>c.action===a.id&&c.status!=='resolved')){const saved=await program.account.opsCase.fetchNullable(address(c.id),'finalized');if(!saved)continue;const stamp=Number(saved.createdAt.toString());candidates.push({recipient:c.owner??profile.admin.toBase58(),kind:now-stamp>=profile.escalateHours*3600?3:2,stamp,caseId:c.id,right:a.rights.find(r=>r.holder===c.holder)?.id});}
   for(const n of candidates){const notice=opsPdas.notice(workspace,a.id,n.recipient,n.kind,n.stamp,n.caseId??a.id);if(await connection.getAccountInfo(notice,'finalized'))continue;await send(await program.methods.createOpsNotice(address(n.recipient),n.kind,u64(n.stamp),address(n.caseId??a.id)).accountsStrict({actor,workspace,member,recipientMember:n.recipient===profile.admin.toBase58()?null:opsPdas.member(workspace,n.recipient),action:address(a.id),deadline:n.kind<2&&a.kind==='coupon'?opsPdas.deadline(workspace,a.id):null,case:n.caseId?address(n.caseId):null,right:n.right?address(n.right):null,notice,systemProgram:zero}).instruction(),actor);}
  }return;
 }else throw Error('Unsupported program operation');
 await send(ix,actor);
}
