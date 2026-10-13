import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import idl from '../../src/shared/solana/idl/recorda.json' with {type:'json'};
import { createChainReader } from './chain.mjs';
const program=new Program(idl,{connection:{}});
const action={id:Keypair.generate().publicKey.toBase58(),version:2},right={id:Keypair.generate().publicKey.toBase58(),status:'due',evidence:'Unprocessed right'};
function transaction(targetAction=action.id,targetRight=right.id,name='settleV2'){
 const t=new Transaction({feePayer:Keypair.generate().publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58()});t.add(new TransactionInstruction({programId:new PublicKey(idl.address),keys:[{pubkey:new PublicKey(targetAction),isSigner:false,isWritable:true},{pubkey:new PublicKey(targetRight),isSigner:false,isWritable:true}],data:program.coder.instruction.encode(name,{})}));return {transaction:{message:t.compileMessage()},meta:{err:null,innerInstructions:[]}};
}
test('signature confirmation is bound to an exact settle instruction/action/right and authoritative finalized right',async()=>{
 let status=null,tx=null;const reader=await createChainReader(undefined,{rpc:{getSignatureStatuses:async()=>({value:[status]}),getTransaction:async()=>tx}});
 assert.equal((await reader.transaction('signature',action,right)).status,'unknown');
 status={confirmationStatus:'confirmed',err:null};tx=transaction();assert.equal((await reader.transaction('signature',action,right)).status,'pending');
 status={confirmationStatus:'finalized',err:null};assert.equal((await reader.transaction('signature',action,right)).status,'unknown');
 assert.equal((await reader.transaction('signature',action,{...right,status:'confirmed',evidence:'Finalized program right'})).status,'confirmed');
 tx=transaction(action.id,Keypair.generate().publicKey.toBase58());await assert.rejects(()=>reader.transaction('signature',action,right),/does not execute/);
 tx=transaction();status={confirmationStatus:'finalized',err:{InstructionError:[0,'Custom']}};assert.equal((await reader.transaction('signature',action,right)).status,'failed');
 tx=null;assert.equal((await reader.transaction('signature',action,right)).status,'unknown');
});
test('live reader refuses a different genesis before discovering instruments',async()=>{const reader=await createChainReader(undefined,{rpc:{getGenesisHash:async()=>'mainnet-or-local-validator'}});await assert.rejects(()=>reader.sync(['*'],{actions:[]}),/Expected Solana Devnet genesis/);});
