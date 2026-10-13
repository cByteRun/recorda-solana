import { BN } from "@coral-xyz/anchor";
import { PublicKey, type Connection } from "@solana/web3.js";
import { createProtocol } from "./protocol";
import { createActionsV2, auditActionsV2 } from "./actions-v2";
import { auditProtocol } from "./protocol-audit";

function exportValue(value:unknown):unknown {
  if(typeof value==='bigint')return value.toString();
  if(BN.isBN(value))return (value as BN).toString();
  if(value instanceof PublicKey)return value.toBase58();
  if(value instanceof Uint8Array)return [...value];
  if(Array.isArray(value))return value.map(exportValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,input])=>[key,exportValue(input)]));
  return value;
}
/** Stable address cursor for account index; signature pages use the RPC's native before cursor. */
export async function listActionHistory(rpc: Connection, instrument: PublicKey, before?: string, limit = 20) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("History page limit must be 1–100");
  const { program } = createProtocol(rpc);
  const [legacy, current] = await Promise.all([
    program.account.corporateAction.all([{ memcmp: { offset: 16, bytes: instrument.toBase58() } }]),
    program.account.actionV2.all([{ memcmp: { offset: 8, bytes: instrument.toBase58() } }])
  ]);
  const entries = [...legacy.map(a => ({ address:a.publicKey.toBase58(),version:1,kind:'coupon',id:a.account.id.toString(),status:Object.keys(a.account.status)[0] })),...current.map(a=>({address:a.publicKey.toBase58(),version:2,kind:Object.keys(a.account.parameters.kind)[0],id:a.account.id.toString(),status:Object.keys(a.account.status)[0]}))].sort((a,b)=>a.address.localeCompare(b.address));
  const filtered = before ? entries.filter(a => a.address.localeCompare(before)>0) : entries;
  const page = filtered.slice(0,limit);
  return { entries:page, cursor:filtered.length>limit?page.at(-1)!.address:null, indexedCount:entries.length };
}
export async function signaturePage(rpc:Connection,address:PublicKey,before?:string,limit=20) {
  if (!Number.isInteger(limit)||limit<1||limit>100) throw new Error("Signature page limit must be 1–100");
  const signatures=await rpc.getSignaturesForAddress(address,{before,limit},'confirmed');
  const transactions=await Promise.all(signatures.map(async signature=>{
    try {const tx=await rpc.getTransaction(signature.signature,{commitment:'confirmed',maxSupportedTransactionVersion:0});return {...signature,evidenceAvailable:!!tx,logs:tx?.meta?.logMessages??null};}
    catch {return {...signature,evidenceAvailable:false,logs:null};}
  }));
  return {entries:transactions,cursor:signatures.length===limit?signatures.at(-1)!.signature:null};
}
export async function exportActionAudit(rpc:Connection,address:PublicKey,version:1|2) {
  const report=version===2?await createActionsV2(rpc).read(address):await createProtocol(rpc).read(address);
  const audit=version===2?await auditActionsV2(address,report as Awaited<ReturnType<ReturnType<typeof createActionsV2>['read']>>):await auditProtocol(address,report as Awaited<ReturnType<ReturnType<typeof createProtocol>['read']>>);
  if(audit.issues.length)throw new Error(`Cannot export invalid audit: ${audit.issues.join('; ')}`);
  const pages=[];let before:string|undefined;const seen=new Set<string>();
  do {const page=await signaturePage(rpc,address,before,100);pages.push(...page.entries);if(page.cursor&&seen.has(page.cursor))throw new Error('RPC history cursor did not advance');if(page.cursor)seen.add(page.cursor);before=page.cursor??undefined;}while(before);
  return {version:1,exportedAt:new Date().toISOString(),network:rpc.rpcEndpoint,action:address.toBase58(),schemaVersion:version,source:'on-chain accounts and RPC transaction history',report:exportValue(report),audit,transactions:pages,unavailableEvidence:pages.filter(t=>!t.evidenceAvailable).map(t=>t.signature),historicalAvailability:'An RPC may prune history. Unavailable transactions are disclosed; an empty/pruned page does not prove no historical transactions.'};
}
