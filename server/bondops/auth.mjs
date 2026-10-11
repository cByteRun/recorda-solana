import { randomBytes, createPublicKey, verify } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
export const demoMembers=[{id:'demo-operator',name:'Demo Operator',role:'operator',scopes:['*']},{id:'demo-reviewer',name:'Demo Reviewer',role:'reviewer',scopes:['*']},{id:'demo-auditor',name:'Demo Auditor',role:'auditor',scopes:['*']}];
export const fail=(status,message)=>Object.assign(new Error(message),{status});
const token=()=>randomBytes(32).toString('hex');
export function createAuth({mode,members,origins,demoEnabled,secureCookies=false,now=()=>Date.now()}){
 const sessions=new Map(),challenges=new Map(),rates=new Map();
 function prune(){for(const [id,s]of sessions)if(s.expires<=now())sessions.delete(id);for(const[id,c]of challenges)if(c.expires<=now())challenges.delete(id);for(const[id,r]of rates)if(now()-r.at>60000)rates.delete(id);}
 function origin(request){const origin=request.headers.get('origin');if(!origin||!origins.includes(origin))throw fail(403,'Untrusted request origin');return origin;}
 function limit(identity){prune();const r=rates.get(identity)??{at:now(),count:0};if(++r.count>20)throw fail(429,'Too many authentication attempts');rates.set(identity,r);}
 function login(member){prune();if(sessions.size>=1000)throw fail(429,'Session capacity reached');const id=token(),csrf=token();sessions.set(id,{memberId:member.id,wallet:member.wallet,csrf,expires:now()+3600000});return {id,csrf,member,mode};}
 return {
  mode,members,
  cookie(id,request,clear=false){return `bondops-session=${clear?'':id}; HttpOnly; SameSite=Strict; Path=/api/bondops; Max-Age=${clear?0:3600}${secureCookies||new URL(request.url).protocol==='https:'?'; Secure':''}`;},
  session(request,required=false){prune();const id=request.headers.get('cookie')?.match(/(?:^|;\s*)bondops-session=([a-f0-9]{64})(?:;|$)/)?.[1],session=sessions.get(id),member=session&&members.find(m=>m.id===session.memberId&&m.wallet===session.wallet);if(!member&&required)throw fail(401,'Sign in to the workspace');return member?{...session,member,id}:null;},
  mutate(request,roles=['operator','reviewer']){origin(request);const session=this.session(request,true);if(!roles.includes(session.member.role))throw fail(403,'This workspace role cannot perform this operation');if(request.headers.get('x-bondops-csrf')!==session.csrf)throw fail(403,'Invalid CSRF token');return session.member;},
  demo(request,id){origin(request);limit('demo');if(mode!=='demo'||!demoEnabled||!['127.0.0.1','localhost','[::1]'].includes(new URL(request.headers.get('origin')).hostname))throw fail(403,'Sandbox sessions are disabled');const member=members.find(m=>m.id===id);if(!member)throw fail(400,'Unknown sandbox member');return login(member);},
  challenge(request,wallet){const domain=origin(request);limit(wallet);try{new PublicKey(wallet);}catch{throw fail(400,'Invalid wallet address');}if(!members.some(m=>m.wallet===wallet))throw fail(403,'Wallet is not a workspace member');if(challenges.size>=1000)throw fail(429,'Challenge capacity reached');const id=token(),message=`Recorda BondOps sign-in\nOrigin: ${domain}\nWallet: ${wallet}\nNonce: ${id}\nExpires: ${new Date(now()+300000).toISOString()}\nThis signs a login message, not a payment.`;challenges.set(id,{wallet,domain,message,expires:now()+300000});return {id,message};},
  verify(request,{id,signature}){const domain=origin(request);limit('verify');const c=challenges.get(id);challenges.delete(id);if(!c||c.expires<=now()||c.domain!==domain)throw fail(401,'Expired or invalid challenge');if(typeof signature!=='string')throw fail(400,'Signature must be base64');const bytes=Buffer.from(signature,'base64'),publicKey=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),new PublicKey(c.wallet).toBuffer()]),format:'der',type:'spki'});if(bytes.length!==64||!verify(null,Buffer.from(c.message),publicKey,bytes))throw fail(401,'Invalid wallet signature');const member=members.find(m=>m.wallet===c.wallet);if(!member)throw fail(403,'Membership revoked');return login(member);},
  logout(request){origin(request);const s=this.session(request);if(s&&request.headers.get('x-bondops-csrf')!==s.csrf)throw fail(403,'Invalid CSRF token');if(s)sessions.delete(s.id);}
 };
}
export function scope(member,instrument){if(!member.scopes.includes('*')&&!member.scopes.includes(instrument))throw fail(403,'Instrument is outside your workspace permissions');}
