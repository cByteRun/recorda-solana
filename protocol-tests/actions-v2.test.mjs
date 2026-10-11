import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID as tokenProgram, createMint, createAccount, mintTo, getAccount, getMint, createFreezeAccountInstruction, createThawAccountInstruction } from '@solana/spl-token';
const { Program, BN }=anchor;
const idl=JSON.parse(readFileSync('src/shared/solana/idl/recorda.json'));
const rpc=new Connection(process.env.RECORDA_TEST_RPC||'http://127.0.0.1:18899','confirmed');
const program=new Program(idl,{connection:rpc});
const systemProgram=SystemProgram.programId;
const bn=n=>new BN(n.toString());const u64=n=>bn(n).toArrayLike(Buffer,'le',8);
const pda=(...seeds)=>PublicKey.findProgramAddressSync(seeds.map(s=>typeof s==='string'?Buffer.from(s):s),program.programId)[0];
let nonce=10000; const evidence={network:'local-validator',scenarios:[],negatives:[],signatures:[]};
const ix=(method,args,accounts)=>program.methods[method](...args).accountsStrict(accounts).instruction();
async function send(instruction,payer,signers=[]) { const s=await sendAndConfirmTransaction(rpc,new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({microLamports:++nonce}),instruction),[payer,...signers]);evidence.signatures.push(s);return s; }
async function time(){return rpc.getBlockTime(await rpc.getSlot());}
async function wait(target){while(await time()<target)await delay(250);}
async function attack(name,instruction,payer,signers=[],addresses=[],land=false){
 const capture=async()=> (await rpc.getMultipleAccountsInfo(addresses)).map(x=>x&&[x.owner.toBase58(),x.data.toString('hex'),x.lamports]);const before=await capture();
 if(land){const tx=new Transaction().add(ComputeBudgetProgram.setComputeUnitPrice({microLamports:++nonce}),instruction);const latest=await rpc.getLatestBlockhash();tx.feePayer=payer.publicKey;tx.recentBlockhash=latest.blockhash;tx.sign(payer,...signers);const s=await rpc.sendRawTransaction(tx.serialize(),{skipPreflight:true,maxRetries:0});const result=await rpc.confirmTransaction({signature:s,...latest});assert.ok(result.value.err);evidence.signatures.push(s);}
 else await assert.rejects(send(instruction,payer,signers),/custom program error|Error Code|already in use|signature/i);
 assert.deepEqual(await capture(),before,`${name}: accounts mutated`);evidence.negatives.push(name);
}
test('Versioned engine: Coupon → Voting → holder-signed full Redemption; partial redemption', {timeout:360000}, async t=>{
 const payer=Keypair.generate(),stranger=Keypair.generate();const drop=await rpc.requestAirdrop(payer.publicKey,30_000_000_000);await rpc.confirmTransaction(drop,'confirmed');
 await send(SystemProgram.transfer({fromPubkey:payer.publicKey,toPubkey:stranger.publicKey,lamports:100_000_000}),payer);
 const paymentMint=await createMint(rpc,payer,payer.publicKey,payer.publicKey,2,undefined,undefined,tokenProgram);
 for (const partial of [false,true]) {
 const id=partial?902:901;const mint=pda('mint',payer.publicKey.toBuffer(),u64(id));const instrument=pda('instrument',mint.toBuffer());let maturity;
 const units=partial?[100,300,600,0]:[10,5,2,0];const holders=await Promise.all(units.map(async units=>{const key=Keypair.generate();return {key,units,position:pda('holder',instrument.toBuffer(),key.publicKey.toBuffer()),bondAccount:pda('bond-account',instrument.toBuffer(),key.publicKey.toBuffer()),destination:await createAccount(rpc,payer,paymentMint,key.publicKey,undefined,undefined,tokenProgram)};}));
 maturity=(await time())+10;
 await send(await ix('createInstrument',[bn(id),bn(100000),1000,2,bn(maturity),[...Buffer.from('MOCKUSD\0')]],{authority:payer.publicKey,instrument,mint,paymentMint,tokenProgram,systemProgram}),payer);
 for(const h of holders){await send(await ix('registerHolder',[bn(h.units)],{authority:payer.publicKey,instrument,mint,holder:h.key.publicKey,position:h.position,bondAccount:h.bondAccount,tokenProgram,systemProgram}),payer);await send(SystemProgram.transfer({fromPubkey:payer.publicKey,toPubkey:h.key.publicKey,lamports:100_000_000}),payer);}
 const kinds=partial?['partialRedemption']:['coupon','voting','redemption'];let actionId=0;
 for(const kind of kinds){
 const action=pda('action-v2',instrument.toBuffer(),u64(++actionId));const vault=pda('vault-v2',action.toBuffer());const receipt=pda('receipt-v2',action.toBuffer());
 const period=pda('period-v2',instrument.toBuffer(),u64(kind==='coupon'?1:kind==='redemption'?2:0));
 const manage={authority:payer.publicKey,instrument,mint,action,tokenProgram};const minimal={authority:payer.publicKey,instrument,action};
 const params={kind:{[kind]:{}},recordAt:bn((await time())+2),period:bn(kind==='coupon'?1:kind==='redemption'?2:0),includeCoupon:kind==='coupon'||kind==='redemption',retireBps:kind==='redemption'?10000:partial?2000:0,opensAt:bn(0),closesAt:bn(0),quorumBps:0,proposalHash:Array(32).fill(0)};
 if(kind==='voting'){params.opensAt=bn(Number(params.recordAt)+20);params.closesAt=bn(Number(params.opensAt)+20);params.quorumBps=5000;params.proposalHash=Array(32).fill(7);}
 if(kind==='redemption')await wait(maturity);
 await send(await ix('createActionV2',[bn(actionId),params],{...minimal,systemProgram}),payer);
 const protectedAccounts=[instrument,mint,action,receipt,vault,...holders.flatMap(h=>[h.bondAccount,h.destination,pda('right-v2',action.toBuffer(),h.key.publicKey.toBuffer())])];
 const calculate=h=>ix('calculateV2',[],{...minimal,right:pda('right-v2',action.toBuffer(),h.key.publicKey.toBuffer())});
 const transfer=()=>ix('transferBonds',[bn(1)],{holder:holders[0].key.publicKey,instrument,mint,fromPosition:holders[0].position,toPosition:holders[1].position,fromAccount:holders[0].bondAccount,toAccount:holders[1].bondAccount,tokenProgram});
 const settle=(h,actor=h.key.publicKey)=>ix('settleV2',[],{actor,instrument,mint,action,right:pda('right-v2',action.toBuffer(),h.key.publicKey.toBuffer()),position:h.position,bondAccount:h.bondAccount,paymentMint,vault,destination:h.destination,tokenProgram});
 const vote=(h,choice)=>ix('voteV2',[choice],{holder:h.key.publicKey,instrument,action,right:pda('right-v2',action.toBuffer(),h.key.publicKey.toBuffer()),vote:pda('vote-v2',action.toBuffer(),h.key.publicKey.toBuffer()),systemProgram});
 if(params.includeCoupon) await send(await ix('reservePeriodV2',[],{...minimal,period,systemProgram}),payer);
 await attack(`${kind}: unauthorized approval`,await ix('approveV2',[],{...minimal,authority:stranger.publicKey,period:params.includeCoupon?period:systemProgram}),payer,[stranger],protectedAccounts);
 await attack(`${kind}: legacy wrong-kind handler`,await ix('approveAction',[],manage),payer,[],protectedAccounts);
 if(kind==='voting'){
  const source=Array(32).fill(3),eventId=Array(32).fill(4),evidenceHash=Array(32).fill(5);
  const payload=[...createHash('sha256').update(Buffer.concat([Buffer.from('recorda:external:parameters:v1'),instrument.toBuffer(),program.coder.types.encode('actionParameters',params)])).digest()];
  const event=pda('external-v2',instrument.toBuffer(),Buffer.from(source),Buffer.from(eventId));
  const accounts={...minimal,event,systemProgram};
  await attack('external: unauthorized feed cannot attach/execute',await ix('proposeExternalV2',[source,eventId,payload,evidenceHash],{...accounts,authority:stranger.publicKey}),payer,[stranger],protectedAccounts);
  await attack('external: altered canonical payload',await ix('proposeExternalV2',[source,eventId,Array(32).fill(8),evidenceHash],accounts),payer,[],protectedAccounts);
  await send(await ix('proposeExternalV2',[source,eventId,payload,evidenceHash],accounts),payer);
  await attack('external: delivery replay',await ix('proposeExternalV2',[source,eventId,payload,evidenceHash],accounts),payer,[],protectedAccounts);
 }
 await wait(Number(params.recordAt));await send(await ix('beginV2',[],manage),payer);
 await attack(`${kind}: incomplete capture`,await ix('finishSnapshotV2',[],manage),payer,[],protectedAccounts);
 await attack(`${kind}: cancel after begin`,await ix('cancelV2',[],manage),payer,[],protectedAccounts);
 for(const h of holders)await send(await ix('captureV2',[],{...minimal,position:h.position,bondAccount:h.bondAccount,right:pda('right-v2',action.toBuffer(),h.key.publicKey.toBuffer()),tokenProgram,systemProgram}),payer);
 await send(await ix('finishSnapshotV2',[],manage),payer);
 for(const h of holders)await send(await calculate(h),payer);
 await send(await ix('approveV2',[],{...minimal,period:params.includeCoupon?period:systemProgram}),payer);
 if(kind==='voting'){
  await assert.equal(await rpc.getAccountInfo(vault),null);
  await attack('voting: rejects payment vault creation',await ix('createVaultV2',[],{...minimal,paymentMint,vault,tokenProgram,systemProgram}),payer,[],protectedAccounts);
  await attack('voting: vote before open',await vote(holders[0],0),payer,[holders[0].key],protectedAccounts);
  await send(await transfer(),payer,[holders[0].key]);
  await wait(Number(params.opensAt));
  await send(await vote(holders[0],0),payer,[holders[0].key]);
  await attack('voting: replay',await vote(holders[0],1),payer,[holders[0].key],protectedAccounts);
  await attack('voting: zero power',await vote(holders[3],0),payer,[holders[3].key],protectedAccounts);
  await send(await vote(holders[1],1),payer,[holders[1].key]);await send(await vote(holders[2],2),payer,[holders[2].key]);
  await attack('voting: early tally',await ix('finishVoteV2',[],manage),payer,[],protectedAccounts);
  await wait(Number(params.closesAt));await attack('voting: vote at/after close',await vote(holders[3],0),payer,[holders[3].key],protectedAccounts);
  await send(await ix('finishVoteV2',[],manage),payer);
  const a=await program.account.actionV2.fetch(action);assert.equal(a.yes.toString(),'6');assert.equal(a.no.toString(),'9');assert.equal(a.abstain.toString(),'2');assert.equal(a.passed,false);
 }else{
  if(kind!=='coupon'){
   await attack(`${kind}: transfer lock after snapshot`,await transfer(),payer,[holders[0].key],protectedAccounts);
   await attack(`${kind}: operator cannot burn holder bonds`,await settle(holders[0],payer.publicKey),payer,[],protectedAccounts);
  }
  if(kind==='coupon')await send(await ix('transferBonds',[bn(4)],{holder:holders[0].key.publicKey,instrument,mint,fromPosition:holders[0].position,toPosition:holders[1].position,fromAccount:holders[0].bondAccount,toAccount:holders[1].bondAccount,tokenProgram}),payer,[holders[0].key]);
  await send(await ix('createVaultV2',[],{...minimal,paymentMint,vault,tokenProgram,systemProgram}),payer);
  await attack(`${kind}: insufficient funding`,await ix('fundedV2',[],{...minimal,vault,tokenProgram}),payer,[],protectedAccounts);
  const a=await program.account.actionV2.fetch(action);const expected=kind==='coupon'?85000:partial?20000000:1785000;
  assert.equal(a.total.toString(),String(expected));await mintTo(rpc,payer,paymentMint,vault,payer,BigInt(expected),[],undefined,tokenProgram);await send(await ix('fundedV2',[],{...minimal,vault,tokenProgram}),payer);
  if(kind!=='coupon'){
    await attack(`${kind}: funded operator cannot burn`,await settle(holders[0],payer.publicKey),payer,[],protectedAccounts);
    const unsigned=await settle(holders[0]);unsigned.keys.find(k=>k.pubkey.equals(holders[0].key.publicKey)).isSigner=false;
    await attack(`${kind}: missing holder signature`,unsigned,payer,[],protectedAccounts);
  }
  await attack(`${kind}: wrong-kind vote on payable action`,await vote(holders[0],0),payer,[holders[0].key],protectedAccounts);
  const before=(await getAccount(rpc,holders[0].destination,'confirmed',tokenProgram)).amount;
  await send(createFreezeAccountInstruction(holders[0].destination,paymentMint,payer.publicKey,[],tokenProgram),payer);
  await attack(`${kind}: payment CPI rolls back burn and counters`,await settle(holders[0],kind==='coupon'?payer.publicKey:holders[0].key.publicKey),payer,kind==='coupon'?[]:[holders[0].key],protectedAccounts,true);
  await send(createThawAccountInstruction(holders[0].destination,paymentMint,payer.publicKey,[],tokenProgram),payer);
  for(const h of holders){await send(await settle(h,kind==='coupon'||h.units===0?payer.publicKey:h.key.publicKey),payer,kind==='coupon'||h.units===0?[]:[h.key]);}
  await attack(`${kind}: settle replay`,await settle(holders[0],kind==='coupon'?payer.publicKey:holders[0].key.publicKey),payer,kind==='coupon'?[]:[holders[0].key],protectedAccounts);
  assert.ok((await getAccount(rpc,holders[0].destination,'confirmed',tokenProgram)).amount>before);
  if(params.includeCoupon)await send(await ix('consumePeriodV2',[],{...minimal,period}),payer);
 }
 await send(await ix('finalizeV2',[],{...manage,period:params.includeCoupon?period:systemProgram,receipt,systemProgram}),payer);
 const a=await program.account.actionV2.fetch(action),r=await program.account.receiptV2.fetch(receipt),i=await program.account.instrument.fetch(instrument);
 assert.deepEqual(a.status,{finalized:{}});assert.equal(r.version,2);assert.deepEqual(r.commitment,a.commitment);assert.deepEqual(r.snapshotHash,a.snapshotHash);
 assert.equal((await getMint(rpc,mint,'confirmed',tokenProgram)).supply,BigInt(i.outstandingSupply.toString()));
 if(kind==='redemption'){assert.equal(i.redeemed,true);assert.equal(i.outstandingSupply.toString(),'0');assert.equal(i.redeemedSupply.toString(),'17');}
 if(partial){assert.equal(i.redeemed,false);assert.equal(i.outstandingSupply.toString(),'800');assert.equal(i.redeemedSupply.toString(),'200');}
 // Independently reconstruct receipt domain-bound commitment from raw Borsh bytes.
 const raw=(await rpc.getAccountInfo(receipt)).data;assert.deepEqual(Buffer.from(r.summaryHash),createHash('sha256').update(Buffer.concat([Buffer.from('recorda:receipt:v2'),raw.subarray(8,raw.length-32)])).digest());
 evidence.scenarios.push({kind,action:action.toBase58(),instrument:instrument.toBase58(),receipt:receipt.toBase58(),total:a.total.toString(),retired:a.retired.toString()});
 if(kind==='coupon'){
  const duplicate=pda('action-v2',instrument.toBuffer(),u64(99));const duplicateParams={...params,recordAt:bn((await time())+20)};
  await send(await ix('createActionV2',[bn(99),duplicateParams],{...minimal,action:duplicate,systemProgram}),payer);
  await attack('coupon: consumed period deduplication',await ix('reservePeriodV2',[],{...minimal,action:duplicate,period,systemProgram}),payer,[],protectedAccounts);
  await send(await ix('cancelV2',[],{...manage,action:duplicate}),payer);
 }
 }
 }
 mkdirSync('target/protocol-evidence',{recursive:true});writeFileSync('target/protocol-evidence/actions-v2.json',JSON.stringify(evidence,null,2));
});
