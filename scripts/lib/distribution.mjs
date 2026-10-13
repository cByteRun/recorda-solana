import {createHash,createPublicKey,verify} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const digest=(...parts)=>createHash('sha256').update(Buffer.concat(parts)).digest();
const key=value=>new PublicKey(value).toBuffer();
const uint=(value,bytes)=>{const n=BigInt(value);if(n<0n||n>=(1n<<BigInt(bytes*8)))throw Error('Unsigned integer out of range');const out=Buffer.alloc(bytes);if(bytes===8)out.writeBigUInt64LE(n);else out.writeUInt32LE(Number(n));return out;};
export const canonical=value=>{const normalize=v=>typeof v==='bigint'?v.toString():Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,value])=>[k,normalize(value)])):v;return JSON.stringify(normalize(value));};
export const dataHash=value=>digest(Buffer.from(canonical(value))).toString('hex');
export function claimLeaf(distribution,instrument,mint,index,holder,destination,amount){return digest(Buffer.from('recorda:claim:v1'),key(distribution),key(instrument),key(mint),uint(index,4),key(holder),key(destination),uint(amount,8));}
export const merkleParent=(a,b)=>digest(Buffer.from('recorda:merkle:v1'),...(Buffer.compare(a,b)<=0?[a,b]:[b,a]));
export function merkle(leaves){if(!leaves.length)throw Error('Empty manifest');const levels=[leaves];while(levels.at(-1).length>1){const level=levels.at(-1);levels.push(Array.from({length:Math.ceil(level.length/2)},(_,i)=>merkleParent(level[i*2],level[i*2+1]??level[i*2])));}return {root:levels.at(-1)[0],proof:index=>{if(index<0||index>=leaves.length)throw Error('Invalid leaf index');const proof=[];for(const level of levels.slice(0,-1)){proof.push(level[index^1]??level[index]);index=Math.floor(index/2);}return proof;}};}
export function verifyProof(root,leaf,proof){if(proof.length>32)return false;return proof.reduce((current,next)=>merkleParent(current,Buffer.from(next,'hex')),leaf).equals(Buffer.from(root,'hex'));}
/** Replay an archival, ordered journal, never a post-record current balance RPC read.
 * Archive provider attests completeness/finality. The archive is an explicit trust boundary.
 */
export function replayIndex(journal,recordSlot,expectedProvider){
 if(!expectedProvider||journal.attestation?.provider!==expectedProvider)throw Error('Archive provider is not trusted');
 const {attestation,...payload}=journal,digest=dataHash(payload);
 if(attestation.hash!==digest||typeof attestation.signature!=='string')throw Error('Archive attestation hash mismatch');
 const signer=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),key(expectedProvider)]),type:'spki',format:'der'});
 const signature=Buffer.from(attestation.signature,'base64');
 if(signature.length!==64||!verify(null,Buffer.from(digest,'hex'),signer,signature))throw Error('Archive signature verification failed');
 key(journal.instrument);key(journal.mint);uint(recordSlot,8);uint(journal.bank?.timestamp??'-1',8);
 if(journal.version!==1||journal.finality!=='finalized'||!journal.source||journal.completeFromGenesis!==true||!journal.bank||BigInt(journal.bank.slot)!==BigInt(recordSlot))throw Error('Incomplete or unavailable finalized historical archive');
 if(!Array.isArray(journal.events)||!journal.events.length||journal.events[0].kind!=='genesis')throw Error('Missing genesis');
 const holders=new Map();let supply=0n,sequence=-1,previous=[-1n,-1,-1];const signatures=new Set();
 for(const event of journal.events){
  if(!Number.isSafeInteger(event.transactionIndex)||event.transactionIndex<0||!Number.isSafeInteger(event.instructionIndex)||event.instructionIndex<0||!/^[a-f0-9]{64}$/.test(event.evidenceHash))throw Error('Invalid journal provenance/order');uint(event.slot,8);
  if(event.sequence!==sequence+1)throw Error('Journal gap');sequence=event.sequence;
  const order=[BigInt(event.slot),event.transactionIndex,event.instructionIndex];
  if(order[0]>BigInt(recordSlot))throw Error('Post-record input');
  if(order[0]<previous[0]||(order[0]===previous[0]&&(order[1]<previous[1]||(order[1]===previous[1]&&order[2]<=previous[2]))))throw Error('Reordered or duplicate journal input');previous=order;
  if(!event.signature||!event.evidenceHash||event.finality!=='finalized')throw Error('Missing finalized transaction provenance');
  signatures.add(event.signature);
  switch(event.kind){
   case 'genesis':if(sequence!==0)throw Error('Repeated genesis');break;
   case 'register':{key(event.holder);const units=BigInt(event.units);uint(units,8);if(holders.has(event.holder))throw Error('Duplicate registry holder');holders.set(event.holder,{holder:event.holder,units,approved:true,policyVersion:1,expiresAt:null,frozen:false,group:0,jurisdiction:0});supply+=units;break;}
   case 'transfer':{const from=holders.get(event.from),to=holders.get(event.to),units=BigInt(event.units);if(!from?.approved||!to?.approved||units<=0n||from.units<units||from===to)throw Error('Invalid controlled transfer');from.units-=units;to.units+=units;break;}
   case 'retire':{const h=holders.get(event.holder),units=BigInt(event.units);if(!h||units<0n||h.units<units)throw Error('Invalid retirement');h.units-=units;supply-=units;break;}
   case 'eligibility':{const h=holders.get(event.holder);if(!h||h.units!==0n&&event.approved===false)throw Error('Invalid revocation');if(typeof event.approved!=='boolean'||!Number.isInteger(event.policyVersion)||event.policyVersion<h.policyVersion||event.policyVersion>4294967295||!Number.isInteger(event.group??0)||(event.group??0)<0||(event.group??0)>65535||!Number.isInteger(event.jurisdiction??0)||(event.jurisdiction??0)<0||(event.jurisdiction??0)>65535)throw Error('Invalid policy version');Object.assign(h,{approved:event.approved,policyVersion:event.policyVersion,expiresAt:event.expiresAt??null,frozen:!!event.frozen,group:event.group??0,jurisdiction:event.jurisdiction??0});break;}
   default:throw Error('Unsupported journal event');
  }
 }
 if(supply!==BigInt(journal.bank.supply)||[...holders.values()].reduce((n,h)=>n+h.units,0n)!==supply||holders.size!==journal.bank.registeredCount)throw Error('Historical bank/registry supply does not reconcile');
 const eligible=[...holders.values()].filter(h=>h.approved&&!h.frozen&&(h.expiresAt===null||BigInt(h.expiresAt)>BigInt(journal.bank.timestamp)));
 // Distribution scope requires all units accounted for; excluded balances cannot silently disappear.
 if(eligible.reduce((n,h)=>n+h.units,0n)!==supply)throw Error('Ineligible supply requires a separately approved distribution policy');
 return {version:1,source:journal.source,archiveProvider:expectedProvider,recordSlot:String(recordSlot),timestamp:String(journal.bank.timestamp),instrument:journal.instrument,mint:journal.mint,supply:supply.toString(),journalHash:dataHash(journal),signatureCount:signatures.size,holders:eligible.sort((a,b)=>Buffer.compare(key(a.holder),key(b.holder))).map(h=>({...h,units:h.units.toString()}))};
}
export function buildManifest(index,{distribution,paymentMint,face,rateBps,frequency,policyVersion,destinations}){
 if(!policyVersion||BigInt(face)<=0n||!Number.isInteger(rateBps)||rateBps<0||rateBps>10000||!Number.isInteger(frequency)||frequency<=0)throw Error('Invalid formula/policy');
 if(!index.journalHash||!index.source||!index.recordSlot)throw Error('Missing historical provenance');
 let total=0n;const leaves=index.holders.map((h,index)=>{const destination=destinations[h.holder];if(!destination)throw Error('Missing bound holder destination');const amount=BigInt(h.units)*BigInt(face)*BigInt(rateBps)/10000n/BigInt(frequency);uint(amount,8);total+=amount;return {index,holder:h.holder,destination,units:h.units,amount:amount.toString()};});uint(total,8);
 const tree=merkle(leaves.map(l=>claimLeaf(distribution,index.instrument,paymentMint,l.index,l.holder,l.destination,l.amount)));
 return {version:1,encoding:'recorda:claim:v1 / sorted SHA-256 recorda:merkle:v1 / duplicate odd leaf',distribution,instrument:index.instrument,paymentMint,recordSlot:index.recordSlot,policyVersion,source:index.source,provenanceHash:index.journalHash,face:String(face),rateBps,frequency,total:total.toString(),root:tree.root.toString('hex'),leaves:leaves.map(l=>({...l,proof:tree.proof(l.index).map(p=>p.toString('hex'))}))};
}
export function persistManifest(directory,manifest){const hash=dataHash(manifest),folder=join(directory,hash);mkdirSync(folder,{recursive:true});const path=join(folder,'manifest.json');if(existsSync(path)&&dataHash(JSON.parse(readFileSync(path)))!==hash)throw Error('Content-addressed archive corruption');writeFileSync(path,canonical(manifest)+'\n',{mode:0o644});for(const leaf of manifest.leaves)writeFileSync(join(folder,`${leaf.index}.json`),canonical({manifestHash:hash,root:manifest.root,leaf})+'\n');return {hash,path};}
export function loadManifest(directory,hash){if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid content address');const manifest=JSON.parse(readFileSync(join(directory,hash,'manifest.json')));if(dataHash(manifest)!==hash)throw Error('Manifest hash mismatch');for(const l of manifest.leaves)if(!verifyProof(manifest.root,claimLeaf(manifest.distribution,manifest.instrument,manifest.paymentMint,l.index,l.holder,l.destination,l.amount),l.proof))throw Error('Invalid stored proof');return manifest;}
