import { BondOpsStore } from './store.mjs';
import { seed, event, reconcileCases, notify, visible } from './domain.mjs';
import { createAuth, demoMembers, fail, scope } from './auth.mjs';
import { resolve } from 'node:path';
const text=(value,max=2000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw fail(400,'Invalid text');return value.trim();};
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw fail(400,'Use an ISO date with explicit timezone');return new Date(value).toISOString();};
export function configFromEnv(env=process.env){
 const production=env.NODE_ENV==='production',mode=env.BONDOPS_MODE??(production?'live':'demo');
 if(!['live','demo'].includes(mode))throw Error('BONDOPS_MODE must be demo or live');

 return {mode,secureCookies:production,demoEnabled:!production&&mode==='demo',path:env.BONDOPS_DB_PATH??resolve('target/bondops/test-workspace.sqlite'),origins:(env.BONDOPS_ORIGINS??'http://127.0.0.1:4444,http://localhost:4444,http://127.0.0.1:3000,http://localhost:3000').split(','),members:[],background:env.BONDOPS_BACKGROUND!=='false'};
}
export function createBondOps(config,dependencies={}){
 const now=dependencies.now??(()=>Date.now());
 // SQLite is initialized only for the illustrative Test Workspace.
 const store=config.demoEnabled?(dependencies.store??new BondOpsStore(config.path)):null;
 const members=config.demoEnabled?demoMembers.map(m=>({...m,workspace:'demo'})):[];
 const auth=createAuth({...config,members,now});
 if(store){store.initialize('demo',seed('demo',now()));if((store.read('demo').schema??1)<2)store.update('demo',s=>{const sample=seed('demo',now());s.schema=2;s.demoTransactions=sample.demoTransactions;s.audit=[...sample.audit,...s.audit];});}
 let queue=Promise.resolve();
 const serialize=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const group=source=>members.filter(m=>m.workspace===source);
 const tick=source=>store.update(source,s=>{reconcileCases(s,now());notify(s,group(source),now());});
 function context(request,mutating=false,roles){const source=new URL(request.url).searchParams.get('source')??(config.demoEnabled?'demo':'live');if(source!=='demo'||!config.demoEnabled)throw fail(404,'Workspace unavailable');const session=auth.session(request,source==='live'||mutating);const member=mutating?auth.mutate(request,roles):session?.member;if(member&&member.workspace!==source)throw fail(403,'Sign in to the selected workspace');return {source,member};}
 function view(source,member){return visible(store.read(source),member,group(source),now());}
 function findAction(state,id,member){const action=state.actions.find(a=>a.id===id);if(!action)throw fail(404,'Action not found');scope(member,action.instrument);return action;}
 async function handle(request){
  const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
  try{
   const url=new URL(request.url),path=url.pathname.replace(/^\/api\/bondops/,'')||'/',method=request.method;
   if(url.searchParams.get('source')==='live'||path==='/auth/challenge'||path==='/auth/verify')throw fail(410,'Solana workspace uses RPC and signed Rust program instructions, not the Test Workspace API');
   let body={};if(method==='POST'){if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail(415,'JSON body required');const raw=await request.text();if(Buffer.byteLength(raw)>32768)throw fail(413,'Request too large');try{body=JSON.parse(raw||'{}');}catch{throw fail(400,'Invalid JSON');}if(!body||Array.isArray(body)||typeof body!=='object')throw fail(400,'Object body required');}
   if(path==='/session'&&method==='GET'){const s=auth.session(request);return json({mode:s?.member.workspace??(config.demoEnabled?'demo':'live'),member:s?.member??null,csrf:s?.csrf??null,demoEnabled:config.demoEnabled,liveConfigured:true});}
   if(path==='/auth/demo'&&method==='POST'){const s=auth.demo(request,text(body.member,80));return json({member:s.member,csrf:s.csrf,mode:s.member.workspace},200,{'set-cookie':auth.cookie(s.id,request)});}
   if(path==='/auth/logout'&&method==='POST'){auth.logout(request);return json({ok:true},200,{'set-cookie':auth.cookie('',request,true)});}
   const roles=path==='/settings'||path==='/members'?['operator']:path==='/notifications/read'?['operator','reviewer','auditor']:undefined;
   let {source,member}=context(request,method==='POST',roles);
   if(method==='GET'&&(path==='/workspace'||path==='/export')){const data=view(source,member);return json(path==='/export'?{schema:'recorda-bondops-export.v1',exportedAt:new Date(now()).toISOString(),mode:source,network:source==='demo'?'ILLUSTRATIVE_ONLY':'Solana Devnet',finality:source==='demo'?null:'finalized',historicalAvailability:'RPC history can be unavailable. Unknown items are not confirmed.',workspace:data}:data);}
   if(method!=='POST')throw fail(404,'Endpoint not found');
   return await serialize(async()=>{
    // Recheck permissions after waiting for preceding membership mutations.
    ({member}=context(request,true,roles));
    if(path==='/refresh'){tick(source);}
    else if(path==='/sweep'){tick(source);}
    else if(path==='/schedule')store.update(source,s=>{const a=findAction(s,text(body.action,100),member);if(a.kind!=='coupon')throw fail(409,'Voting and maturity deadlines come from the action contract');const previousDue=a.dueAt;a.dueAt=date(body.dueAt);if(Date.parse(a.dueAt)<Date.parse(a.recordAt))throw fail(400,'Payment due date cannot precede record date');a.dueSource='operator schedule';if(previousDue!==a.dueAt)for(const n of s.notifications.filter(n=>n.action===a.id&&['deadline','overdue'].includes(n.type)&&!n.readAt)){n.delivery='superseded';n.readAt=new Date(now()).toISOString();}if(body.label){a.label=text(body.label,120);a.labelSource='operator';}event(s,member.id,'schedule','Обновлён срок обязательства',a.dueAt,{instrument:a.instrument,action:a.id});notify(s,group(source),now());});
    else if(path==='/cases')store.update(source,s=>{const c=s.cases.find(c=>c.id===body.id);if(!c)throw fail(404,'Case not found');scope(member,c.instrument);const a=findAction(s,c.action,member),r=a.rights.find(r=>r.holder===c.holder);if(body.owner!==undefined){if(body.owner!==null&&!group(source).some(m=>m.id===body.owner&&m.role!=='auditor'&&(m.scopes.includes('*')||m.scopes.includes(c.instrument))))throw fail(400,'Assignee has no instrument permissions');c.owner=body.owner;}if(body.status!==undefined){if(!['open','investigating','resolved'].includes(body.status))throw fail(400,'Invalid case state');if(body.status==='resolved'&&(!a.verified||r?.status!=='confirmed'))throw fail(409,'Cannot close without matching verified execution');c.status=body.status;}const note=text(body.note);c.history.push({at:new Date(now()).toISOString(),actor:member.id,note,evidence:r?.evidence});event(s,member.id,'case','Обновлён операционный кейс',note,{instrument:c.instrument,action:c.action,caseId:c.id});notify(s,group(source),now());});
    else if(path==='/reference')throw fail(409,'Test Workspace cannot submit real transaction evidence');
    else if(path==='/notifications/read')store.update(source,s=>{const n=s.notifications.find(n=>n.id===body.id&&n.recipient===member.id);if(!n)throw fail(404,'Notification not found');scope(member,n.instrument);n.readAt=new Date(now()).toISOString();});
    else if(path==='/members')throw fail(409,'Test Workspace uses predefined illustrative roles');
    else if(path==='/settings')store.update(source,s=>{if(!member.scopes.includes('*'))throw fail(403,'Workspace settings require full workspace scope');for(const name of ['leadHours','escalateHours']){if(!Number.isInteger(body[name])||body[name]<1||body[name]>720)throw fail(400,'Notification intervals must be 1–720 hours');s.preferences[name]=body[name];}event(s,member.id,'settings','Обновлены правила уведомлений',JSON.stringify(s.preferences));notify(s,group(source),now());});
    else throw fail(404,'Endpoint not found');
    return json(view(source,member));
   });
  }catch(error){return json({error:error.status?error.message:'BondOps request failed',...(error.status?{}:{code:'INTERNAL_ERROR'})},error.status??500);}
 }
 let timer;if(config.background&&store){timer=setInterval(()=>void serialize(async()=>tick('demo')).catch(()=>{}),60000);timer.unref();}
 if(store)tick('demo');
 return {handle,store,auth,close(){if(timer)clearInterval(timer);store?.close();}};
}
