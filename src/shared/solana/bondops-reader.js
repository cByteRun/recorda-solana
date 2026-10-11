import { Connection, PublicKey } from '@solana/web3.js';
import { getMint, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { createProtocol } from './protocol';
import { createActionsV2, auditActionsV2 } from './actions-v2';
import { auditProtocol } from './protocol-audit';
const iso=seconds=>new Date(Number(seconds)*1000).toISOString();
const value=n=>n.toString(), zero=new PublicKey('11111111111111111111111111111111');
/** Reuse the same independent protocol audits as the working browser journeys. */
export async function createChainReader(endpoint='https://api.devnet.solana.com',options={}) {
 const base=options.rpc??new Connection(endpoint,{commitment:'finalized',disableRetryOnRateLimit:true,fetch:async(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})});
 // Shared clients explicitly request confirmed; operational confirmations require finalized reads.
 const rpc=new Proxy(base,{get(target,prop){const fn=target[prop];if(typeof fn!=='function')return fn;if(['getAccountInfo','getMultipleAccountsInfo','getProgramAccounts'].includes(prop))return (address,config)=>fn.call(target,address,{...(typeof config==='object'?config:{}),commitment:'finalized'});if(prop==='getSignaturesForAddress')return (address,options)=>fn.call(target,address,options,'finalized');return fn.bind(target);}});
 const programId=options.programId?new PublicKey(options.programId):undefined;
 const legacy=createProtocol(rpc,programId),current=createActionsV2(rpc,programId);
 async function readAction(address,version,instrument) {
  const key=new PublicKey(address), report=await (version===2?current:legacy).read(key), audit=await (version===2?auditActionsV2(key,report):auditProtocol(key,report));
  if(audit.issues.length)throw Error(audit.issues.join('; '));
  const a=report.action,v2=version===2,kind=v2?Object.keys(a.parameters.kind)[0]:'coupon',status=Object.keys(a.status)[0];
  const rights=report.rights.map(({publicKey,account:r})=>{
   const processed=v2?r.processed:r.settled,expected=value(v2?r.total:r.amountMinor),amount=kind==='voting'?'0':expected;
   return {id:publicKey.toBase58(),holder:r.holder.toBase58(),name:`Holder ${r.holder.toBase58().slice(0,6)}`,units:value(v2?r.units:r.snapshotUnits),principalMinor:value(v2?r.principal:r.principalMinor),couponMinor:value(v2?r.coupon:r.amountMinor),expectedMinor:amount,confirmedMinor:processed&&kind!=='voting'?amount:'0',calculated:r.calculated,status:processed?'confirmed':'due',signature:null,settledSlot:processed?value(r.settledSlot):null,destination:r.destination.equals(zero)?null:r.destination.toBase58(),source:'solana-finalized',evidence:processed?`Finalized program right ${publicKey.toBase58()} · slot ${r.settledSlot}`:'Finalized right is unprocessed; reconcile any retained broadcast before retry.'};
  });
  return {id:address,version,label:`${kind} #${a.id}`,instrument:instrument.id,kind,status,recordAt:iso(v2?a.parameters.recordAt:a.recordTimestamp),dueAt:kind==='voting'?iso(a.parameters.closesAt):kind==='redemption'?instrument.maturity:null,dueSource:kind==='voting'?'on-chain voting close':kind==='redemption'?'on-chain maturity':null,asset:instrument.asset,currency:instrument.currency,decimals:instrument.decimals,faceMinor:value(v2?a.face:report.instrument.faceValueMinor),rateBps:v2?a.rateBps:report.instrument.couponBps,frequency:v2?a.frequency:report.instrument.paymentsPerYear,approved:!a.approvedBy.equals(zero),funded:v2?!!report.vault&&report.vault.amount>=BigInt(value(a.total))-BigInt(value(a.paid)):['funded','executing','settled','finalized'].includes(status),receipt:report.receipt?(v2?current.pdas.receipt(key):legacy.pdas.receipt(key)).toBase58():null,recordSlot:value(a.recordSlot),snapshotHash:Buffer.from(a.snapshotHash).toString('hex'),verified:true,source:'solana-finalized',rights,signatures:report.signatures.map(s=>({signature:s.signature,slot:s.slot,err:s.err,finality:s.confirmationStatus??'finalized'})),...(kind==='voting'?{yes:value(a.yes),no:value(a.no),abstain:value(a.abstain),quorumBps:a.parameters.quorumBps,quorumMet:a.quorumMet,passed:a.passed}:{})};
 }
 return {
  endpoint,
  async sync(scopes,previous) {
   const genesis=await rpc.getGenesisHash();
   if(options.network==='local'){if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname)||['EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG','5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'].includes(genesis))throw Error('Expected an isolated local validator');}
   else if(genesis!=='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')throw Error('Expected Solana Devnet genesis; refusing another network');
   const records=scopes.includes('*')?await legacy.program.account.instrument.all():await Promise.all(scopes.map(async address=>({publicKey:new PublicKey(address),account:await legacy.program.account.instrument.fetch(new PublicKey(address),'finalized')})));const instruments=[],actions=[];
   for(const {publicKey,account:i} of records.filter(r=>scopes.includes('*')||scopes.includes(r.publicKey.toBase58()))) {
    if(!legacy.pdas.instrument(i.mint).equals(publicKey))throw Error('Noncanonical instrument');
    const [asset,bond]=await Promise.all([getMint(rpc,i.paymentMint,'finalized',TOKEN_2022_PROGRAM_ID),getMint(rpc,i.mint,'finalized',TOKEN_2022_PROGRAM_ID)]);
    if(bond.decimals!==0||!bond.mintAuthority?.equals(publicKey)||!bond.freezeAuthority?.equals(publicKey)||bond.supply!==BigInt(i.outstandingSupply.toString()))throw Error('Instrument mint supply/authority mismatch');
    if(asset.decimals!==2)throw Error('Unsupported settlement precision: Recorda contract uses minor units with two decimals');
    const inst={id:publicKey.toBase58(),symbol:`BOND-${i.id}`,name:`Instrument #${i.id}`,authority:i.authority.toBase58(),asset:i.paymentMint.toBase58(),currency:Buffer.from(i.currency).toString().replace(/\0/g,''),decimals:asset.decimals,faceMinor:value(i.faceValueMinor),rateBps:i.couponBps,frequency:i.paymentsPerYear,supply:value(i.outstandingSupply),redeemedSupply:value(i.redeemedSupply),maturity:iso(i.maturityTimestamp),source:'solana-finalized',verified:true};instruments.push(inst);
    const [old,typed]=await Promise.all([legacy.program.account.corporateAction.all([{memcmp:{offset:16,bytes:inst.id}}]),legacy.program.account.actionV2.all([{memcmp:{offset:8,bytes:inst.id}}])]);
    for(const record of [...old.map(r=>({...r,version:1})),...typed.map(r=>({...r,version:2}))]) {
     const address=record.publicKey.toBase58();
     try{actions.push(await readAction(address,record.version,inst));}catch(error){const prior=previous.actions.find(a=>a.id===address);actions.push({...prior,id:address,instrument:inst.id,label:prior?.label??`Action ${address.slice(0,6)}`,version:record.version,kind:prior?.kind??(record.version===2?Object.keys(record.account.parameters.kind)[0]:'coupon'),status:prior?.status??Object.keys(record.account.status)[0],asset:inst.asset,currency:inst.currency,decimals:2,recordAt:iso(record.version===2?record.account.parameters.recordAt:record.account.recordTimestamp),rights:(prior?.rights??[]).map(r=>({...r,status:'unknown',confirmedMinor:'0',evidence:`Verification unavailable: ${error.message}`})),verified:false,source:'solana-finalized',verificationError:error.message});}
    }
   }
   return {instruments,actions};
  },
  async transaction(signature,action,right) {
   const {value:[status]}=await rpc.getSignatureStatuses([signature],{searchTransactionHistory:true});
   if(!status)return {status:'unknown',evidence:'Signature unavailable in RPC history; do not retry automatically.'};
   const tx=await rpc.getTransaction(signature,{commitment:status.confirmationStatus==='finalized'?'finalized':'confirmed',maxSupportedTransactionVersion:0});
   if(!tx)return {status:'unknown',evidence:'Transaction unavailable; status alone cannot bind this execution to the right.'};
   const keys=tx.transaction.message.getAccountKeys({accountKeysFromLookups:tx.meta?.loadedAddresses});
   // Bind exact settle instruction to this action and canonical right, including multisig inner execution.
   const programId=legacy.program.programId.toBase58(), settle=action.version===2?'settleV2':'settleHolder';
   const match=ix=>{if(keys.get(ix.programIdIndex)?.toBase58()!==programId)return false;const decoded=legacy.program.coder.instruction.decode(typeof ix.data==='string'?ix.data:Buffer.from(ix.data),typeof ix.data==='string'?'base58':undefined);const accounts=(ix.accountKeyIndexes??ix.accounts).map(index=>keys.get(index)?.toBase58());return decoded?.name===settle&&accounts.includes(action.id)&&accounts.includes(right.id);};
   if(![...tx.transaction.message.compiledInstructions,...(tx.meta?.innerInstructions??[]).flatMap(x=>x.instructions)].some(match))throw Error('Transaction does not execute this action/right');
   if(status.err||tx.meta?.err)return {status:'failed',evidence:`Failed transaction ${signature}; finalized rights still control retries.`};
   if(status.confirmationStatus!=='finalized')return {status:'pending',evidence:`Transaction ${signature} awaits finalized confirmation.`};
   return {status:right.status==='confirmed'?'confirmed':'unknown',evidence:right.status==='confirmed'?right.evidence:`Finalized transaction ${signature} needs matching processed program right.`};
  }
 };
}
