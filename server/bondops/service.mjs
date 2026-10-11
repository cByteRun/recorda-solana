import { BondOpsStore } from './store.mjs';
import { seed, event, key, reconcileCases, notify, visible } from './domain.mjs';
import { createAuth, demoMembers, fail, scope } from './auth.mjs';
import { createChainReader } from './chain.mjs';
import { resolve } from 'node:path';
import { PublicKey } from '@solana/web3.js';
const text=(value,max=2000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw fail(400,'Invalid text');return value.trim();};
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw fail(400,'Use an ISO date with explicit timezone');return new Date(value).toISOString();};
export function configFromEnv(env=process.env){
 const production=env.NODE_ENV==='production',mode=env.BONDOPS_MODE??(production?'live':'demo');
 if(!['live','demo'].includes(mode))throw Error('BONDOPS_MODE must be demo or live');
 if(production&&!env.BONDOPS_DB_PATH)throw Error('BONDOPS_DB_PATH must point to persistent storage; no ephemeral production fallback');
 const configured=JSON.parse(env.BONDOPS_MEMBERS??'[]');
 if(!Array.isArray(configured)||configured.some(m=>!m.id||!m.name||!m.wallet||!['operator','reviewer','auditor'].includes(m.role)||!Array.isArray(m.scopes)||!m.scopes.length))throw Error('Invalid BONDOPS_MEMBERS');
 if(new Set(configured.map(m=>m.id)).size!==configured.length||new Set(configured.map(m=>m.wallet)).size!==configured.length||configured.some(m=>m.id.startsWith('demo-')))throw Error('Duplicate/reserved membership identity');
 for(const m of configured){new PublicKey(m.wallet);for(const instrument of m.scopes)if(instrument!=='*')new PublicKey(instrument);}
 return {mode,secureCookies:production,demoEnabled:!production&&mode==='demo',path:env.BONDOPS_DB_PATH??resolve('target/bondops/workspace.sqlite'),origins:(env.BONDOPS_ORIGINS??'http://127.0.0.1:4444,http://localhost:4444,http://127.0.0.1:3000,http://localhost:3000').split(','),members:configured.map(m=>({...m,workspace:'live'})),endpoint:env.BONDOPS_RPC_URL??'https://api.devnet.solana.com',programId:env.BONDOPS_PROGRAM_ID??env.VITE_RECORDA_PROGRAM_ID,background:env.BONDOPS_BACKGROUND!=='false'};
}
export function createBondOps(config,dependencies={}){
 const store=dependencies.store??new BondOpsStore(config.path),now=dependencies.now??(()=>Date.now());
 store.initialize('team-live',{schema:1,members:config.members});
 if(!store.read('team-live').members.length&&config.members.length)store.update('team-live',s=>{s.members=config.members;});
 const liveMembers=store.read('team-live').members;
 const members=[...liveMembers,...(config.demoEnabled?demoMembers.map(m=>({...m,workspace:'demo'})):[])];
 const auth=createAuth({...config,members,now});
 store.initialize('live',seed('live',now()));if(config.demoEnabled)store.initialize('demo',seed('demo',now()));
 let reader=dependencies.chain??null,queue=Promise.resolve();
 const serialize=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const group=source=>members.filter(m=>m.workspace===source);
 const tick=source=>store.update(source,s=>{reconcileCases(s,now());notify(s,group(source),now());});
 const chain=async()=>reader??(reader=await createChainReader(config.endpoint,{programId:config.programId}));
 function context(request,mutating=false,roles){const source=new URL(request.url).searchParams.get('source')??(config.demoEnabled?'demo':'live');if(!['demo','live'].includes(source)||source==='demo'&&!config.demoEnabled)throw fail(404,'Workspace unavailable');const session=auth.session(request,source==='live'||mutating);const member=mutating?auth.mutate(request,roles):session?.member;if(member&&member.workspace!==source)throw fail(403,'Sign in to the selected workspace');return {source,member};}
 function view(source,member){return visible(store.read(source),member,group(source),now());}
 function findAction(state,id,member){const action=state.actions.find(a=>a.id===id);if(!action)throw fail(404,'Action not found');scope(member,action.instrument);return action;}
 async function refresh(source,actor){
  if(source==='demo'){tick(source);return;}
  const previous=store.read(source),scopes=[...new Set(group('live').flatMap(m=>m.scopes))];
  if(!scopes.length)throw fail(503,'No live workspace membership/scopes configured');
  try{
   const provider=await chain(),data=await provider.sync(scopes,previous);
   // Retained broadcast references remain available after reload; uncertain outcomes block retries.
   for(const a of data.actions)for(const r of a.rights){const ref=previous.references?.find(ref=>ref.action===a.id&&ref.holder===r.holder);if(!ref)continue;r.signature=ref.signature;try{const proof=await provider.transaction(ref.signature,a,r);if(r.status!=='confirmed'){r.status=proof.status;r.confirmedMinor='0';r.evidence=proof.evidence;}else{r.referenceStatus=proof.status;r.referenceEvidence=proof.evidence;}}catch(error){if(r.status!=='confirmed'){r.status='unknown';r.confirmedMinor='0';r.evidence=`Submitted reference could not be verified: ${error.message}`;}else{r.referenceStatus='unknown';r.referenceEvidence=error.message;}}}
   store.update(source,s=>{
    for(const a of data.actions){const old=s.actions.find(x=>x.id===a.id);if(old?.dueSource==='operator schedule'&&a.kind==='coupon'){a.dueAt=old.dueAt;a.dueSource=old.dueSource;}if(old?.labelSource==='operator'){a.label=old.label;a.labelSource='operator';}
     const change=key(a.status,a.verified,a.receipt,a.rights.map(r=>[r.id,r.status,r.confirmedMinor]));if(old?.evidenceVersion!==change)event(s,actor,'chain','Обновлено подтверждение Solana',`${a.label} · ${a.status} · ${a.verified?'verified':'unknown'}`,{instrument:a.instrument,action:a.id,source:'solana-finalized',evidence:change});a.evidenceVersion=change;
    }
    // Disappearing accounts/history are uncertainty, not evidence of no obligation.
    for(const old of s.actions.filter(old=>!data.actions.some(a=>a.id===old.id)))data.actions.push({...old,verified:false,verificationError:'Action unavailable in current index',rights:old.rights.map(r=>({...r,status:'unknown',confirmedMinor:'0',evidence:'Previously indexed action is unavailable; investigate archival evidence.'}))});
    s.instruments=[...data.instruments,...s.instruments.filter(i=>!data.instruments.some(next=>next.id===i.id)).map(i=>({...i,verified:false}))];s.actions=data.actions;s.lastSync=new Date(now()).toISOString();s.syncError=data.actions.some(a=>!a.verified)?'Some actions could not be verified; unknown evidence remains visible':null;s.network='Solana Devnet';reconcileCases(s,now());notify(s,group(source),now());
   });
  }catch(error){store.update(source,s=>{s.syncError=error.message;s.lastAttempt=new Date(now()).toISOString();for(const a of s.actions){a.verified=false;for(const r of a.rights){r.status='unknown';r.confirmedMinor='0';r.evidence='RPC/verification unavailable; last known state is not fresh confirmation.';}}reconcileCases(s,now());event(s,actor,'unavailable','Источник подтверждения недоступен',error.message,{source:'solana-finalized'});});throw fail(503,'Solana reconciliation unavailable. Previously indexed obligations remain unknown.');}
 }
 async function handle(request){
  const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
  try{
   const persistedMembers=store.read('team-live').members;members.splice(0,members.length,...persistedMembers,...members.filter(m=>m.workspace==='demo'));
   const url=new URL(request.url),path=url.pathname.replace(/^\/api\/bondops/,'')||'/',method=request.method;
   let body={};if(method==='POST'){if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail(415,'JSON body required');const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw fail(413,'Request too large');try{body=JSON.parse(raw||'{}');}catch{throw fail(400,'Invalid JSON');}if(!body||Array.isArray(body)||typeof body!=='object')throw fail(400,'Object body required');}
   if(path==='/session'&&method==='GET'){const s=auth.session(request);return json({mode:s?.member.workspace??(config.demoEnabled?'demo':'live'),member:s?.member??null,csrf:s?.csrf??null,demoEnabled:config.demoEnabled,liveConfigured:group('live').length>0});}
   if(path==='/auth/challenge'&&method==='POST')return json(auth.challenge(request,text(body.wallet,60)));
   if(path==='/auth/verify'&&method==='POST'||path==='/auth/demo'&&method==='POST'){const s=path.endsWith('demo')?auth.demo(request,text(body.member,80)):auth.verify(request,body);return json({member:s.member,csrf:s.csrf,mode:s.member.workspace},200,{'set-cookie':auth.cookie(s.id,request)});}
   if(path==='/auth/logout'&&method==='POST'){auth.logout(request);return json({ok:true},200,{'set-cookie':auth.cookie('',request,true)});}
   const roles=path==='/settings'||path==='/members'?['operator']:path==='/notifications/read'?['operator','reviewer','auditor']:undefined;
   let {source,member}=context(request,method==='POST',roles);
   if(method==='GET'&&(path==='/workspace'||path==='/export')){const data=view(source,member);return json(path==='/export'?{schema:'recorda-bondops-export.v1',exportedAt:new Date(now()).toISOString(),mode:source,network:source==='demo'?'ILLUSTRATIVE_ONLY':'Solana Devnet',finality:source==='demo'?null:'finalized',historicalAvailability:'RPC history can be unavailable. Unknown items are not confirmed.',workspace:data}:data);}
   if(method!=='POST')throw fail(404,'Endpoint not found');
   return await serialize(async()=>{
    // Recheck permissions after waiting for preceding membership mutations.
    ({member}=context(request,true,roles));
    if(path==='/refresh')await refresh(source,member.id);
    else if(path==='/sweep'){tick(source);}
    else if(path==='/schedule')store.update(source,s=>{const a=findAction(s,text(body.action,100),member);if(a.kind!=='coupon')throw fail(409,'Voting and maturity deadlines come from the action contract');const previousDue=a.dueAt;a.dueAt=date(body.dueAt);if(Date.parse(a.dueAt)<Date.parse(a.recordAt))throw fail(400,'Payment due date cannot precede record date');a.dueSource='operator schedule';if(previousDue!==a.dueAt)for(const n of s.notifications.filter(n=>n.action===a.id&&['deadline','overdue'].includes(n.type)&&!n.readAt)){n.delivery='superseded';n.readAt=new Date(now()).toISOString();}if(body.label){a.label=text(body.label,120);a.labelSource='operator';}event(s,member.id,'schedule','Обновлён срок обязательства',a.dueAt,{instrument:a.instrument,action:a.id});notify(s,group(source),now());});
    else if(path==='/cases')store.update(source,s=>{const c=s.cases.find(c=>c.id===body.id);if(!c)throw fail(404,'Case not found');scope(member,c.instrument);const a=findAction(s,c.action,member),r=a.rights.find(r=>r.holder===c.holder);if(body.owner!==undefined){if(body.owner!==null&&!group(source).some(m=>m.id===body.owner&&m.role!=='auditor'&&(m.scopes.includes('*')||m.scopes.includes(c.instrument))))throw fail(400,'Assignee has no instrument permissions');c.owner=body.owner;}if(body.status!==undefined){if(!['open','investigating','resolved'].includes(body.status))throw fail(400,'Invalid case state');if(body.status==='resolved'&&(!a.verified||r?.status!=='confirmed'))throw fail(409,'Cannot close without matching verified execution');c.status=body.status;}const note=text(body.note);c.history.push({at:new Date(now()).toISOString(),actor:member.id,note,evidence:r?.evidence});event(s,member.id,'case','Обновлён операционный кейс',note,{instrument:c.instrument,action:c.action,caseId:c.id});notify(s,group(source),now());});
    else if(path==='/reference'){
     if(source!=='live')throw fail(409,'Demo cannot submit real transaction evidence');
     const s=store.read(source),a=findAction(s,text(body.action,100),member),r=a.rights.find(r=>r.holder===body.holder);if(!r)throw fail(404,'Right not found');if(r.status==='confirmed')throw fail(409,'Payment already confirmed');if(!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(body.signature??''))throw fail(400,'Invalid transaction signature');
     const previous=s.references?.find(ref=>ref.action===a.id&&ref.holder===r.holder);if(previous&&previous.signature!==body.signature&&!['failed','due'].includes(r.status))throw fail(409,'Reconcile the retained broadcast before adding another reference');
     const proof=await (await chain()).transaction(body.signature,a,r);
     store.update(source,s=>{s.references??=[];const id=key(a.id,r.holder),ref={id,action:a.id,holder:r.holder,signature:body.signature,at:new Date(now()).toISOString()};s.references=s.references.filter(x=>x.id!==id);s.references.push(ref);const right=findAction(s,a.id,member).rights.find(x=>x.holder===r.holder);right.signature=ref.signature;right.status=proof.status;right.evidence=proof.evidence;reconcileCases(s,now());event(s,member.id,'reference','Сохранена ссылка исполнения',ref.signature,{instrument:a.instrument,action:a.id});});
    }
    else if(path==='/notifications/read')store.update(source,s=>{const n=s.notifications.find(n=>n.id===body.id&&n.recipient===member.id);if(!n)throw fail(404,'Notification not found');scope(member,n.instrument);n.readAt=new Date(now()).toISOString();});
    else if(path==='/members'){
     if(source!=='live'||member.role!=='operator'||!member.scopes.includes('*'))throw fail(403,'Team administration requires a live workspace operator with full scope');
     const id=text(body.id,80);if(!/^[a-zA-Z0-9_-]+$/.test(id)||id.startsWith('demo-'))throw fail(400,'Invalid member identity');
     if(id===member.id)throw fail(409,'Self-revocation or role changes are not permitted');
     let updated;
     if(!body.revoke){const wallet=text(body.wallet,60);try{new PublicKey(wallet);}catch{throw fail(400,'Invalid wallet address');}if(!['operator','reviewer','auditor'].includes(body.role)||!Array.isArray(body.scopes)||!body.scopes.length||body.scopes.length>100)throw fail(400,'Invalid member permissions');for(const instrument of body.scopes){if(instrument!=='*'){try{new PublicKey(instrument);}catch{throw fail(400,'Invalid instrument scope');}}}if(group('live').some(m=>m.id!==id&&m.wallet===wallet))throw fail(409,'Wallet already belongs to a member');updated={id,name:text(body.name,120),wallet,role:body.role,scopes:[...new Set(body.scopes)],workspace:'live'};}
     store.updateMany(['team-live',source],states=>{const s=states['team-live'];const existing=s.members.find(m=>m.id===id);if(body.revoke&&!existing)throw fail(404,'Member not found');s.members=s.members.filter(m=>m.id!==id);if(updated)s.members.push(updated);event(states[source],member.id,'membership',body.revoke?'Доступ участника отозван':'Обновлены права участника',id);});
     const index=members.findIndex(m=>m.id===id);if(index>=0)members.splice(index,1);if(updated)members.push(updated);
    }
    else if(path==='/settings')store.update(source,s=>{if(!member.scopes.includes('*'))throw fail(403,'Workspace settings require full workspace scope');for(const name of ['leadHours','escalateHours']){if(!Number.isInteger(body[name])||body[name]<1||body[name]>720)throw fail(400,'Notification intervals must be 1–720 hours');s.preferences[name]=body[name];}event(s,member.id,'settings','Обновлены правила уведомлений',JSON.stringify(s.preferences));notify(s,group(source),now());});
    else throw fail(404,'Endpoint not found');
    return json(view(source,member));
   });
  }catch(error){return json({error:error.status?error.message:'BondOps request failed',...(error.status?{}:{code:'INTERNAL_ERROR'})},error.status??500);}
 }
 let timer;if(config.background){timer=setInterval(()=>void serialize(async()=>{for(const source of config.demoEnabled?['demo','live']:['live']){if(source==='live'&&group('live').length){try{await refresh(source,'scheduler');}catch{/* Failure already persisted. */}}else tick(source);}}).catch(()=>{}),60000);timer.unref();}
 // Create the in-app outbox at startup, not only when a browser is open.
 if(config.demoEnabled)tick('demo');
 return {handle,store,auth,close(){if(timer)clearInterval(timer);store.close();}};
}
