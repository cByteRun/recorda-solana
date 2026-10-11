import {test,expect} from '@playwright/test';import {Connection,PublicKey} from '@solana/web3.js';import {readFileSync} from 'node:fs';import {createActionsV2,auditActionsV2,type ReportV2} from '../src/shared/solana/actions-v2';import {u64} from '../src/shared/solana/protocol';import {listActionHistory,signaturePage} from '../src/shared/solana/audit-history';
const rpc=new Connection(process.env.RECORDA_TEST_RPC||'http://127.0.0.1:8899','confirmed'),client=createActionsV2(rpc),scenarios=JSON.parse(readFileSync('target/protocol-evidence/actions-v2.json','utf8')).scenarios;
const coupon=scenarios.find((s:{kind:string})=>s.kind==='coupon'),voting=scenarios.find((s:{kind:string})=>s.kind==='voting'),redemption=scenarios.find((s:{kind:string})=>s.kind==='redemption');
const attacks:Array<[string,{action:string},(report:ReportV2)=>void]>=[
 ['immutable face',coupon,r=>r.action.face=u64(BigInt(r.action.face.toString())+1n)],
 ['parameter period',coupon,r=>r.action.parameters.period=u64(999)],
 ['snapshot units',coupon,r=>r.rights[0].account.units=u64(999)],
 ['missing holder',coupon,r=>r.rights.pop()],
 ['duplicate holder',coupon,r=>r.rights.push(r.rights[0])],
 ['principal component',redemption,r=>r.rights[0].account.principal=u64(1)],
 ['final coupon component',redemption,r=>r.rights[0].account.coupon=u64(1)],
 ['retired units',redemption,r=>r.action.retired=u64(1)],
 ['missing settlement slot',redemption,r=>r.rights[0].account.settledSlot=u64(0)],
 ['wrong-kind receipt',redemption,r=>{r.receipt!.kind={voting:{}};}],
 ['forged receipt remaining supply',redemption,r=>{r.receipt!.remainingSupply=u64(17);}],
 ['forged receipt outcome hash',coupon,r=>{r.receipt!.summaryHash[0]^=1;}],
 ['missing authorized approval',voting,r=>r.action.approvedBy=PublicKey.default],
 ['forged YES tally',voting,r=>r.action.yes=u64(999)],
 ['duplicate VoteReceipt',voting,r=>r.votes.push(r.votes[0])],
 ['vote at closing timestamp',voting,r=>r.votes[0].account.timestamp=r.action.parameters.closesAt],
 ['forged quorum/pass outcome',voting,r=>r.action.passed=!r.action.passed],
 ['external evidence substitution',voting,r=>r.action.sourceEvidence[0]^=1],
 ['removed coupon-period consumption',coupon,r=>{r.period!.consumed=false;}]
];
for(const[name,scenario,mutate]of attacks)test(`Independent v2 auditor rejects ${name}`,async()=>{const address=new PublicKey(scenario.action),report=await client.read(address);expect((await auditActionsV2(address,report)).issues).toEqual([]);mutate(report);expect((await auditActionsV2(address,report)).issues.length).toBeGreaterThan(0);});
test('historical formulas use copied contract terms and supply; later instrument lifecycle is independent',async()=>{const address=new PublicKey(coupon.action),report=await client.read(address);report.instrument.faceValueMinor=u64(200000);report.instrument.couponBps=9000;report.instrument.maturityTimestamp=u64(9999999999n);expect((await auditActionsV2(address,report)).issues).toEqual([]);});
test('stable action pages reconcile all records; transaction pruning is disclosed',async()=>{const instrument=new PublicKey(coupon.instrument);const first=await listActionHistory(rpc,instrument,undefined,1);expect(first.cursor).not.toBeNull();const addresses=[...first.entries.map(e=>e.address)];let cursor=first.cursor;while(cursor){const page=await listActionHistory(rpc,instrument,cursor,1);addresses.push(...page.entries.map(e=>e.address));cursor=page.cursor;}expect(new Set(addresses).size).toBe(first.indexedCount);expect(addresses).toContain(redemption.action);const original=rpc.getTransaction;try{rpc.getTransaction=async()=>null;const signatures=await signaturePage(rpc,new PublicKey(coupon.action),undefined,2);expect(signatures.entries).toHaveLength(2);expect(signatures.entries.every(s=>!s.evidenceAvailable)).toBe(true);expect(signatures.cursor).not.toBeNull();}finally{rpc.getTransaction=original;}});
