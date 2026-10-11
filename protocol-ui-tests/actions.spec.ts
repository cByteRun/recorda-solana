import {test,expect} from '@playwright/test';
import {Connection,Keypair,PublicKey,SystemProgram,Transaction,VersionedTransaction,sendAndConfirmTransaction} from '@solana/web3.js';
import {TOKEN_2022_PROGRAM_ID,createMint} from '@solana/spl-token';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createProtocol} from '../src/shared/solana/protocol';
import {createActionsV2,auditActionsV2} from '../src/shared/solana/actions-v2';
import {readChainClock,waitForRecordDate} from '../src/shared/solana/chain-clock.mjs';
const rpc=new Connection(process.env.RECORDA_TEST_RPC||'http://127.0.0.1:8899','confirmed');
const evidence=JSON.parse(readFileSync('target/protocol-evidence/actions-v2.json','utf8'));
for(const scenario of evidence.scenarios) test(`wallet-free ${scenario.kind} receipt, role boundaries and historical reopen`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/actions?action=${scenario.action}`);await expect(page.getByTestId('actions-root')).toHaveAttribute('data-busy','false');await expect(page.getByText('Audit: Verified')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Operator controls'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Sign atomic burn and payment'})).toHaveCount(0);
 await page.getByLabel('Role',{exact:true}).selectOption('Investor');await expect(page.getByText('Connect your holder wallet')).toBeVisible();await expect(page.getByRole('table')).toHaveCount(0);
 await page.getByLabel('Role',{exact:true}).selectOption('Operator');await expect(page.getByText('Connect the instrument authority. View selection grants no signing rights.')).toBeVisible();
 await page.getByLabel('Role',{exact:true}).selectOption('Auditor');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export verified audit'}).click();const file=await download;expect(file.suggestedFilename()).toContain(scenario.action);
 await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.getByText('Audit: Verified')).toBeVisible();expect(errors).toEqual([]);
});

test('Voting browser → holder-signed YES/NO → tally → audited receipt; unknown wallet cannot vote',async({page})=>{
 test.setTimeout(300000);const operator=Keypair.generate(),holders=[Keypair.generate(),Keypair.generate()];let active=operator;
 await rpc.confirmTransaction(await rpc.requestAirdrop(operator.publicKey,10_000_000_000),'confirmed');
 const protocol=createProtocol(rpc),client=createActionsV2(rpc);const mint=await createMint(rpc,operator,operator.publicKey,null,2,undefined,undefined,TOKEN_2022_PROGRAM_ID);
 const clock=await readChainClock(rpc),setup=await protocol.createInstrument(operator.publicKey,mint,BigInt(Date.now()),clock.timestamp+86400n);
 const send=async(ix:Awaited<ReturnType<typeof protocol.registerHolder>>)=>sendAndConfirmTransaction(rpc,new Transaction().add(ix),[operator]);
 await send(setup.instruction);for(const[index,h]of holders.entries()){await send(await protocol.registerHolder(operator.publicKey,setup.instrument,h.publicKey,BigInt([10,5][index])));await send(SystemProgram.transfer({fromPubkey:operator.publicKey,toPubkey:h.publicKey,lamports:100_000_000}));}
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.exposeFunction('actionsSign',(bytes:number[])=>{const tx=VersionedTransaction.deserialize(Uint8Array.from(bytes));tx.sign([active]);return [...tx.serialize()];});
 await page.addInitScript(address=>{
  const provider={isPhantom:true,publicKey:undefined as unknown,async connect(){const path='/src/shared/solana/protocol.ts';const{RECORDA_PROGRAM_ID}=await import(/* @vite-ignore */path);const Key=RECORDA_PROGRAM_ID.constructor;this.publicKey=new Key((window as unknown as {activeWallet?:string}).activeWallet||address);return{publicKey:this.publicKey};},async signTransaction(tx:{serialize():Uint8Array;constructor:{deserialize(bytes:Uint8Array):unknown}}){return tx.constructor.deserialize(Uint8Array.from(await(window as unknown as {actionsSign(b:number[]):Promise<number[]>}).actionsSign([...tx.serialize()])));}};Object.assign(window,{phantom:{solana:provider}});
 },operator.publicKey.toBase58());
 await page.goto(`/actions?instrument=${setup.instrument.toBase58()}`);await page.getByLabel('Role',{exact:true}).selectOption('Operator');await page.getByRole('button',{name:'Connect Phantom'}).click();
 const now=(await readChainClock(rpc)).timestamp;const record=now+30n,opens=now+100n,closes=now+170n;
 await page.getByLabel('Action kind',{exact:true}).selectOption('voting');await page.getByLabel('Proposal',{exact:true}).fill('Keep the maturity date unchanged');for(const[label,value]of [['Record date',record],['Opens',opens],['Closes',closes]]as const)await page.getByLabel(label,{exact:true}).fill(new Date(Number(value)*1000).toISOString().slice(0,19));
 await page.getByRole('button',{name:'Create action',exact:true}).click();await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state','scheduled');
 await waitForRecordDate(rpc,record);await page.getByRole('button',{name:'Capture snapshot / resume'}).click();await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state','snapshotted',{timeout:30000});
 await page.getByRole('button',{name:'Calculate rights / resume'}).click();await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state','awaitingApproval');await page.getByRole('button',{name:'Approve action',exact:true}).click();await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state','approved');
 const address=await page.getByLabel('Action PDA',{exact:true}).inputValue();
 async function connect(key:Keypair){active=key;await page.evaluate(address=>{(window as unknown as {activeWallet:string}).activeWallet=address;},key.publicKey.toBase58());await page.getByRole('button',{name:/^(Connect Phantom|Wallet )/}).click();await expect(page.getByTestId('actions-root')).toHaveAttribute('data-busy','false');}
 await page.getByLabel('Role',{exact:true}).selectOption('Investor');await connect(Keypair.generate());await expect(page.getByText('No position for connected wallet')).toBeVisible();await expect(page.getByRole('button',{name:'YES',exact:true})).toHaveCount(0);
 await waitForRecordDate(rpc,opens);await connect(holders[0]);await expect(page.getByText('Snapshot units: 10')).toBeVisible();await page.getByRole('button',{name:'YES',exact:true}).click();await expect(page.getByTestId('actions-root')).toHaveAttribute('data-busy','false');await expect(page.getByRole('button',{name:'YES',exact:true})).toHaveCount(0);await page.reload();await expect(page.getByText('Audit: Verified')).toBeVisible();await page.getByLabel('Role',{exact:true}).selectOption('Investor');await page.getByLabel('Proposal document to verify',{exact:true}).fill('Keep the maturity date unchanged');await page.getByRole('button',{name:'Verify proposal document'}).click();await connect(holders[1]);await page.getByRole('button',{name:'NO',exact:true}).click();await expect(page.getByRole('button',{name:'NO',exact:true})).toHaveCount(0);
 await waitForRecordDate(rpc,closes);await connect(operator);await page.getByLabel('Role',{exact:true}).selectOption('Operator');await page.getByRole('button',{name:'Finalize vote tally'}).click();await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state','settled');await page.getByRole('button',{name:'Finalize receipt'}).click();await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state','finalized');await expect(page.getByText('Audit: Verified')).toBeVisible();
 const loaded=await client.read(new PublicKey(address));expect((await auditActionsV2(new PublicKey(address),loaded)).issues).toEqual([]);expect(loaded.vault).toBeNull();expect(loaded.action.yes.toString()).toBe('10');expect(loaded.action.no.toString()).toBe('5');expect(loaded.receipt?.passed).toBe(true);expect(errors).toEqual([]);
 mkdirSync('target/protocol-evidence',{recursive:true});writeFileSync('target/protocol-evidence/voting-ui.json',JSON.stringify({action:address,errors,result:'PASSED'},null,2));
});
