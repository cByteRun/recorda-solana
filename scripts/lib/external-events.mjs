import {PublicKey} from '@solana/web3.js';
import {dataHash,canonical} from './distribution.mjs';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function normalizeExternalEvent(input){
 if(input.version!==1||!input.source||!input.eventId||!input.evidence||!input.attestation||!['coupon','redemption','voting','partialRedemption'].includes(input.kind))throw Error('Missing canonical event/provenance');
 new PublicKey(input.instrument);
 const record=BigInt(input.recordAt);if(record<=0n||!input.parameters||typeof input.parameters!=='object'||Array.isArray(input.parameters))throw Error('Invalid external dates/parameters');
 const allowed=['period','includeCoupon','retireBps','opensAt','closesAt','quorumBps','proposalHash'];if(Object.keys(input.parameters).some(k=>!allowed.includes(k)))throw Error('Unsupported action parameters');
 const unsigned=(value,bits=64)=>{const n=BigInt(value??0);if(n<0n||n>=(1n<<BigInt(bits)))throw Error('Invalid external integer range');return n;};
 unsigned(record,63);
 if(typeof input.source!=='string'||typeof input.eventId!=='string'||!input.source.trim()||!input.eventId.trim()||input.eventId.length>256)throw Error('Invalid source identity');
 const p=input.parameters,includeCoupon=input.kind==='coupon'||p.includeCoupon===true;
 if(p.includeCoupon!==undefined&&typeof p.includeCoupon!=='boolean')throw Error('Invalid coupon policy');
 const parameters={period:unsigned(p.period).toString(),includeCoupon,retireBps:p.retireBps??(input.kind==='redemption'?10000:0),opensAt:unsigned(p.opensAt,63).toString(),closesAt:unsigned(p.closesAt,63).toString(),quorumBps:p.quorumBps??0,proposalHash:p.proposalHash??'0'.repeat(64)};
 if(!Number.isInteger(parameters.retireBps)||parameters.retireBps<0||parameters.retireBps>10000||!Number.isInteger(parameters.quorumBps)||parameters.quorumBps<0||parameters.quorumBps>10000||!(/^[a-f0-9]{64}$/).test(parameters.proposalHash))throw Error('Invalid external rules/hash');
 if(input.kind==='voting'){
  if(includeCoupon||parameters.period!=='0'||parameters.retireBps!==0||BigInt(parameters.opensAt)<record||BigInt(parameters.closesAt)<=BigInt(parameters.opensAt)||parameters.quorumBps===0||parameters.proposalHash==='0'.repeat(64))throw Error('Invalid external voting contract');
 }else{
  if(parameters.opensAt!=='0'||parameters.closesAt!=='0'||parameters.quorumBps!==0||parameters.proposalHash!=='0'.repeat(64))throw Error('Cross-kind external parameters');
  if(includeCoupon!== (BigInt(parameters.period)>0n))throw Error('Invalid external coupon period');
  if(input.kind==='coupon'&&parameters.retireBps!==0||input.kind==='redemption'&&parameters.retireBps!==10000||input.kind==='partialRedemption'&&parameters.retireBps===0)throw Error('Invalid external retirement fraction');
 }
 const le=(n,length)=>{const b=Buffer.alloc(length);if(length===8)b.writeBigUInt64LE(BigInt(n));else b.writeUInt16LE(Number(n));return b;};
 const encoding=Buffer.concat([Buffer.from([['coupon','redemption','voting','partialRedemption'].indexOf(input.kind)]),le(record,8),le(parameters.period,8),Buffer.from([Number(includeCoupon)]),le(parameters.retireBps,2),le(parameters.opensAt,8),le(parameters.closesAt,8),le(parameters.quorumBps,2),Buffer.from(parameters.proposalHash,'hex')]);
 const event={version:1,source:input.source,eventId:input.eventId,instrument:input.instrument,kind:input.kind,recordAt:record.toString(),parameters,evidenceHash:hash(Buffer.from(input.evidence)),attestationHash:dataHash(input.attestation)};
 return {...event,sourceHash:hash(Buffer.from(input.source)),eventIdHash:hash(Buffer.from(input.eventId)),normalizedHash:dataHash(event),payloadHash:hash(Buffer.concat([Buffer.from('recorda:external:parameters:v1'),new PublicKey(input.instrument).toBuffer(),encoding]))};
}
/** Durable idempotent proposal journal: conflicts never silently overwrite an approved event. */
export function proposeExternal(directory,input){const event=normalizeExternalEvent(input);mkdirSync(directory,{recursive:true});const path=join(directory,`${event.sourceHash}-${event.eventIdHash}.json`);if(existsSync(path)){const existing=JSON.parse(readFileSync(path));if(canonical(existing.event)!==canonical(event))throw Error('Conflicting external event revision');return {...existing,replayed:true};}const proposal={status:'PROPOSED',executionAuthority:'Operator review/signature required',event};writeFileSync(path,canonical(proposal)+'\n',{flag:'wx'});return {...proposal,replayed:false};}
