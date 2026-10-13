import { PublicKey, SystemProgram, type Connection } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAccount, getMint } from "@solana/spl-token";
import { createGovernance } from "./governance";
import { createProtocol, RECORDA_PROGRAM_ID, u64, type ProtocolAccounts } from "./protocol";
import { Buffer } from "buffer";

export type ActionKindV2 = "coupon" | "redemption" | "voting" | "partialRedemption";
export type ParametersV2 = ProtocolAccounts["actionV2"]["parameters"];
export const kindV2 = (a: ProtocolAccounts["actionV2"]) => Object.keys(a.parameters.kind)[0] as ActionKindV2;
export const stageV2 = (a: ProtocolAccounts["actionV2"]) => Object.keys(a.status)[0];
const integer = (n: { toString(): string }) => BigInt(n.toString());
export function createActionsV2(rpc: Connection, programId = RECORDA_PROGRAM_ID) {
  const { program, pdas: legacy } = createProtocol(rpc, programId);
  const pda = (...seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const text = (s: string) => Buffer.from(s);
  const number = (n: bigint | string) => u64(n).toArrayLike(Buffer, "le", 8);
  const pdas = {
    action: (instrument: PublicKey, id: bigint | string) => pda(text("action-v2"), instrument.toBytes(), number(id)),
    right: (action: PublicKey, holder: PublicKey) => pda(text("right-v2"), action.toBytes(), holder.toBytes()),
    vote: (action: PublicKey, holder: PublicKey) => pda(text("vote-v2"), action.toBytes(), holder.toBytes()),
    receipt: (action: PublicKey) => pda(text("receipt-v2"), action.toBytes()),
    vault: (action: PublicKey) => pda(text("vault-v2"), action.toBytes()),
    period: (instrument: PublicKey, period: bigint | string) => pda(text("period-v2"), instrument.toBytes(), number(period))
  };
  const governance=createGovernance(rpc, programId);
  const tokenProgram = TOKEN_2022_PROGRAM_ID, systemProgram = SystemProgram.programId;
  async function owned<K extends keyof ProtocolAccounts>(name: K, address: PublicKey) {
    const info = await rpc.getAccountInfo(address, "confirmed");
    if (!info || !info.owner.equals(program.programId)) throw new Error(`Missing or invalid ${name} program owner`);
    return program.coder.accounts.decode<ProtocolAccounts[K]>(name, info.data);
  }
  async function context(action: PublicKey, authority: PublicKey) {
    const a = await owned("actionV2", action), instrument = a.instrument;
    const i = await owned("instrument", instrument);
    if (a.version !== 2 || !pdas.action(instrument, a.id.toString()).equals(action) || !legacy.instrument(i.mint).equals(instrument) || !a.authority.equals(i.authority)) throw new Error("Invalid canonical action contract");
    return { a, i, accounts: { authority, instrument, action }, manage: { authority, instrument, action, mint: i.mint, tokenProgram } };
  }
  const couponPeriod = (a: ProtocolAccounts["actionV2"]) => integer(a.parameters.period) > 0n ? pdas.period(a.instrument, a.parameters.period.toString()) : systemProgram;
  return {
    program, pdas,
    async create(authority: PublicKey, instrument: PublicKey, id: bigint, parameters: ParametersV2) {
      const action = pdas.action(instrument, id);
      const g=await governance.read(instrument);
      const builder=program.methods.createActionV2(u64(id),parameters).accountsStrict({authority,instrument,action,systemProgram});
      if(g)builder.remainingAccounts([{pubkey:g.address,isWritable:false,isSigner:false}]);
      const instruction=await builder.instruction();
      return { action, instruction };
    },
    async attachExternal(action:PublicKey,authority:PublicKey,source:string,eventId:string,evidence:Uint8Array) {
      const c=await context(action,authority),sourceHash=await hash([Buffer.from(source)]),eventHash=await hash([Buffer.from(eventId)]),evidenceHash=await hash([evidence]);
      const payloadHash=await hash([Buffer.from('recorda:external:parameters:v1'),c.a.instrument.toBytes(),program.coder.types.encode('actionParameters',c.a.parameters)]);
      const event=pda(text('external-v2'),c.a.instrument.toBytes(),sourceHash,eventHash);
      return program.methods.proposeExternalV2([...sourceHash],[...eventHash],[...payloadHash],[...evidenceHash]).accountsStrict({...c.accounts,event,systemProgram}).instruction();
    },
    async reserve(action: PublicKey, authority: PublicKey) { const c = await context(action, authority); return program.methods.reservePeriodV2().accountsStrict({ ...c.accounts, period: couponPeriod(c.a), systemProgram }).instruction(); },
    async releasePeriod(action: PublicKey, authority: PublicKey) { const c = await context(action, authority); return program.methods.releasePeriodV2().accountsStrict({ ...c.accounts, period: couponPeriod(c.a) }).instruction(); },
    async manage(action: PublicKey, authority: PublicKey, operation: "beginV2" | "finishSnapshotV2" | "cancelV2" | "finishVoteV2") {
      const c=await context(action,authority),builder=program.methods[operation]().accountsStrict(c.manage);
      if(operation==='beginV2'&&await governance.read(c.a.instrument)){
        const positions=await program.account.holderPosition.all([{memcmp:{offset:8,bytes:c.a.instrument.toBase58()}}]);
        builder.remainingAccounts(positions.filter(p=>p.account.approved).flatMap(p=>[p.publicKey,governance.policy(c.a.instrument,p.account.holder)].map(pubkey=>({pubkey,isSigner:false,isWritable:false}))));
      }
      return builder.instruction();
    },
    async capture(action: PublicKey, authority: PublicKey, holder: PublicKey) { const c = await context(action, authority); const builder=program.methods.captureV2().accountsStrict({ ...c.accounts, position: legacy.holder(c.a.instrument, holder), bondAccount: legacy.bondAccount(c.a.instrument, holder), right: pdas.right(action, holder), tokenProgram, systemProgram });
      if(await governance.read(c.a.instrument))builder.remainingAccounts([{pubkey:governance.policy(c.a.instrument,holder),isWritable:false,isSigner:false}]);
      return builder.instruction(); },
    async calculate(action: PublicKey, authority: PublicKey, holder: PublicKey) { const c = await context(action, authority); return program.methods.calculateV2().accountsStrict({ ...c.accounts, right: pdas.right(action, holder) }).instruction(); },
    async approve(action: PublicKey, authority: PublicKey) { const c = await context(action, authority); return program.methods.approveV2().accountsStrict({ ...c.accounts, period: couponPeriod(c.a) }).instruction(); },
    async createVault(action: PublicKey, authority: PublicKey) { const c = await context(action, authority); return program.methods.createVaultV2().accountsStrict({ ...c.accounts, paymentMint: c.i.paymentMint, vault: pdas.vault(action), tokenProgram, systemProgram }).instruction(); },
    async funded(action: PublicKey, authority: PublicKey) { const c = await context(action, authority); return program.methods.fundedV2().accountsStrict({ ...c.accounts, vault: pdas.vault(action), tokenProgram }).instruction(); },
    async settle(action: PublicKey, actor: PublicKey, holder: PublicKey, destination: PublicKey) { const c = await context(action, actor); return program.methods.settleV2().accountsStrict({ actor, instrument: c.a.instrument, action, mint: c.i.mint, position: legacy.holder(c.a.instrument, holder), bondAccount: legacy.bondAccount(c.a.instrument, holder), right: pdas.right(action, holder), paymentMint: c.i.paymentMint, vault: pdas.vault(action), destination, tokenProgram }).instruction(); },
    async vote(action: PublicKey, holder: PublicKey, choice: 0 | 1 | 2) { const c = await context(action, holder); return program.methods.voteV2(choice).accountsStrict({ holder, instrument: c.a.instrument, action, right: pdas.right(action, holder), vote: pdas.vote(action, holder), systemProgram }).instruction(); },
    async consume(action: PublicKey, authority: PublicKey) { const c = await context(action, authority); return program.methods.consumePeriodV2().accountsStrict({ ...c.accounts, period: couponPeriod(c.a) }).instruction(); },
    async finalize(action: PublicKey, authority: PublicKey) { const c = await context(action, authority); return program.methods.finalizeV2().accountsStrict({ ...c.manage, period: couponPeriod(c.a), receipt: pdas.receipt(action), systemProgram }).instruction(); },
    async read(action: PublicKey) {
      const c = await context(action, systemProgram);
      const [positions, rights, votes, mint, receiptInfo, vaultInfo, signatures] = await Promise.all([
        program.account.holderPosition.all([{ memcmp: { offset: 8, bytes: c.a.instrument.toBase58() } }]),
        program.account.rightV2.all([{ memcmp: { offset: 8, bytes: action.toBase58() } }]),
        program.account.voteV2.all([{ memcmp: { offset: 8, bytes: action.toBase58() } }]),
        getMint(rpc, c.i.mint, "confirmed", tokenProgram), rpc.getAccountInfo(pdas.receipt(action)), rpc.getAccountInfo(pdas.vault(action)),
        rpc.getSignaturesForAddress(action, { limit: 100 }, "confirmed")
      ]);
      if (mint.decimals !== 0 || !mint.mintAuthority?.equals(c.a.instrument) || !mint.freezeAuthority?.equals(c.a.instrument) || mint.supply !== integer(c.i.outstandingSupply)) throw new Error("Bond mint supply/authority mismatch");
      if (positions.length !== c.i.registeredCount || positions.filter(p => p.account.approved).length !== c.i.approvedCount) throw new Error("Registry count mismatch");
      const balances = await Promise.all(positions.map(async p => {
        if (!legacy.holder(c.a.instrument, p.account.holder).equals(p.publicKey) || !legacy.bondAccount(c.a.instrument, p.account.holder).equals(p.account.tokenAccount)) throw new Error("Invalid registry PDA");
        const token = await getAccount(rpc, p.account.tokenAccount, "confirmed", tokenProgram);
        if (!token.mint.equals(c.i.mint) || !token.owner.equals(p.account.holder) || !token.isFrozen || !token.closeAuthority?.equals(c.a.instrument)) throw new Error("Invalid holder custody");
        return { holder: p.account.holder.toBase58(), units: token.amount.toString(), approved: p.account.approved };
      }));
      if (balances.reduce((sum,b) => sum + BigInt(b.units), 0n) !== mint.supply) throw new Error("Registry supply mismatch");
      for (const r of rights) if (!r.account.action.equals(action) || !pdas.right(action,r.account.holder).equals(r.publicKey)) throw new Error("Invalid right PDA");
      for (const v of votes) if (!v.account.action.equals(action) || !pdas.vote(action,v.account.holder).equals(v.publicKey)) throw new Error("Invalid vote PDA");
      for (const {account:r} of rights.filter(r=>r.account.processed && kindV2(c.a)!=='voting')) {
        const destination=await getAccount(rpc,r.destination,"confirmed",tokenProgram);
        if(!destination.owner.equals(r.holder)||!destination.mint.equals(c.i.paymentMint))throw new Error("Settlement destination owner/mint mismatch");
      }
      const periodAddress=couponPeriod(c.a),periodInfo=periodAddress.equals(systemProgram)?null:await rpc.getAccountInfo(periodAddress);
      let period=periodInfo?await owned("periodV2",periodAddress):null;
      if(period&&(!period.action.equals(action)||!period.instrument.equals(c.a.instrument)||period.period.toString()!==c.a.parameters.period.toString())){
        if(['scheduled','cancelled'].includes(stageV2(c.a)))period=null;else throw new Error("Coupon period action mismatch");
      }
      const receipt = receiptInfo ? await owned("receiptV2", pdas.receipt(action)) : null;
      const vault = vaultInfo ? await getAccount(rpc, pdas.vault(action), "confirmed", tokenProgram) : null;
      if (kindV2(c.a) === "voting" && vault) throw new Error("Voting has a forbidden payment vault");
      if (vault && (!vault.mint.equals(c.i.paymentMint) || !vault.owner.equals(action))) throw new Error("Invalid vault authority/mint");
      return { action: c.a, instrument: c.i, rights, votes, balances, receipt, period, mintSupply: mint.supply, vault, signatures };
    }
  };
}
export type ReportV2 = Awaited<ReturnType<ReturnType<typeof createActionsV2>["read"]>>;

function le(n: bigint, bytes = 8) { const b = Buffer.alloc(bytes); if (bytes === 8) b.writeBigUInt64LE(BigInt.asUintN(64,n)); else if (bytes === 4) b.writeUInt32LE(Number(n)); else b.writeUInt16LE(Number(n)); return b; }
async function hash(parts: Uint8Array[]) { return Buffer.from(await crypto.subtle.digest("SHA-256", Uint8Array.from(Buffer.concat(parts)))); }
export async function auditActionsV2(address: PublicKey, report: ReportV2) {
  const issues: string[] = [], a = report.action, p = a.parameters, kind = kindV2(a);
  const check = (condition: boolean, message: string) => { if (!condition) issues.push(message); };
  const parameterBytes = Buffer.concat([Buffer.from([['coupon','redemption','voting','partialRedemption'].indexOf(kind)]),le(integer(p.recordAt)),le(integer(p.period)),Buffer.from([Number(p.includeCoupon)]),le(BigInt(p.retireBps),2),le(integer(p.opensAt)),le(integer(p.closesAt)),le(BigInt(p.quorumBps),2),Buffer.from(p.proposalHash)]);
  let commitment = await hash([Buffer.from('recorda:action:v2'),address.toBytes(),a.instrument.toBytes(),report.instrument.mint.toBytes(),report.instrument.paymentMint.toBytes(),parameterBytes,le(integer(a.face)),le(BigInt(a.rateBps),2),le(BigInt(a.frequency),2),le(integer(a.maturity)),Buffer.from(a.currency),a.issuer.toBytes(),le(BigInt(a.termsVersion),4),Buffer.from(a.metadataUri),Buffer.from(a.metadataHash),Buffer.from(a.termsHash)]);
  if (a.source.some(n=>n!==0)) commitment=await hash([Buffer.from('recorda:external:binding:v1'),commitment,Buffer.from(a.source),Buffer.from(a.sourceEvent),Buffer.from(a.sourcePayload),Buffer.from(a.sourceEvidence)]);
  check(commitment.equals(Buffer.from(a.commitment)),"Immutable action parameter commitment mismatch");
  check(a.version===2&&a.frequency>0&&a.rateBps<=10000&&integer(a.face)>0n,"Invalid version/financial contract");
  if(!['scheduled','cancelled'].includes(stageV2(a))) check(integer(a.recordSlot)>0n&&integer(a.capturedAt)>=integer(p.recordAt),"Missing or early record-date capture");
  const rights = [...report.rights].sort((x,y) => x.account.index-y.account.index);
  const indices = new Set<number>(), holders = new Set<string>();let allocated=0n,units=0n,principal=0n,coupon=0n,paid=0n,retired=0n,calculated=0,processed=0;
  let snapshot = await hash([Buffer.from('recorda:snapshot:v2'),address.toBytes(),commitment,le(integer(a.recordSlot)),le(integer(p.recordAt))]);
  for (const {account:r} of rights) {
    check(!indices.has(r.index) && r.index === indices.size+1 && !holders.has(r.holder.toBase58()),"Duplicate or unordered snapshot holder");indices.add(r.index);holders.add(r.holder.toBase58());
    units+=integer(r.units);snapshot=await hash([snapshot,r.holder.toBytes(),le(integer(r.units))]);
    const retirement = kind === 'redemption' || kind === 'partialRedemption';
    const expectedUnits = retirement ? integer(r.units)*BigInt(p.retireBps)/10000n : 0n;
    const expectedPrincipal=expectedUnits*integer(a.face);
    const expectedCoupon=p.includeCoupon ? (retirement?expectedUnits:integer(r.units))*integer(a.face)*BigInt(a.rateBps)/10000n/BigInt(a.frequency) : 0n;
    if(r.calculated) {
      allocated+=expectedUnits;calculated++;check(integer(r.retireUnits)===expectedUnits && integer(r.principal)===expectedPrincipal && integer(r.coupon)===expectedCoupon && integer(r.total)===expectedPrincipal+expectedCoupon,"Right formula mismatch");
      principal+=expectedPrincipal;coupon+=expectedCoupon;
    }
    if(r.processed) { processed++;if(kind!=='voting'){paid+=integer(r.total);retired+=integer(r.retireUnits);check(integer(r.settledSlot)>0n && !r.destination.equals(PublicKey.default),"Missing settlement proof");const info=report.balances.find(b=>b.holder===r.holder.toBase58());check(!!info,"Unregistered settled holder");} }
  }
  if(integer(a.recordSlot)>0n) check(snapshot.equals(Buffer.from(a.snapshotHash)),"Snapshot commitment mismatch");
  check(units===integer(a.capturedSupply) && rights.length===a.capturedHolders,"Snapshot counters mismatch");
  check(calculated===a.calculatedHolders && processed===a.processedHolders,"Progress counters mismatch");
  check(allocated===integer(a.retireUnits),"Retirement allocation mismatch");
  check(principal===integer(a.principal) && coupon===integer(a.coupon) && principal+coupon===integer(a.total) && paid===integer(a.paid) && retired===integer(a.retired),"Payment/supply totals mismatch");
  if(!['scheduled','snapshotPending','cancelled'].includes(stageV2(a))) check(units===integer(a.expectedSupply) && rights.length===a.expectedHolders,"Incomplete finalized snapshot");
  if(kind==='voting') {
    let yes=0n,no=0n,abstain=0n;const voters=new Set<string>();
    for(const {account:v} of report.votes){check(integer(v.timestamp)>=integer(p.opensAt)&&integer(v.timestamp)<integer(p.closesAt),"Vote timestamp outside window");const right=rights.find(r=>r.account.holder.equals(v.holder))?.account;check(!!right?.processed && integer(v.power)===integer(right?.units??0) && integer(v.power)>0n && !voters.has(v.holder.toBase58()),"Invalid/duplicate VoteReceipt");voters.add(v.holder.toBase58());if(v.choice===0)yes+=integer(v.power);else if(v.choice===1)no+=integer(v.power);else if(v.choice===2)abstain+=integer(v.power);else check(false,"Invalid vote choice");}
    check(yes===integer(a.yes)&&no===integer(a.no)&&abstain===integer(a.abstain)&&yes+no+abstain<=integer(a.expectedSupply)&&voters.size===processed,"Vote tally mismatch");
    if(['settled','finalized'].includes(stageV2(a))){const met=(yes+no+abstain)*10000n>=integer(a.expectedSupply)*BigInt(p.quorumBps);check(a.quorumMet===met&&a.passed===(met&&yes>no),"Vote result mismatch");}
  }
  if (integer(p.period)>0n&&['approved','funded','executing','settled','finalized'].includes(stageV2(a))) check(!!report.period,"Missing coupon period reservation");
  if(stageV2(a)==='finalized'&&integer(p.period)>0n) check(!!report.period?.consumed,"Unconsumed finalized coupon period");
  if(report.receipt) {
    const r=report.receipt;check(stageV2(a)==='finalized'&&r.action.equals(address)&&r.version===2&&Object.keys(r.kind)[0]===kind&&Buffer.from(r.commitment).equals(commitment)&&Buffer.from(r.snapshotHash).equals(snapshot),"Receipt contract mismatch");
    check(integer(r.remainingSupply)===integer(a.expectedSupply)-integer(a.retired),"Receipt remaining supply mismatch");
    for(const field of ['principal','coupon','paid','retired','processedHolders','yes','no','abstain','quorumMet','passed','finalizedSlot','finalizedAt'] as const) check(r[field].toString()===a[field].toString(),`Receipt ${field} mismatch`);
    const body=Buffer.concat([address.toBytes(),Buffer.from([2,['coupon','redemption','voting','partialRedemption'].indexOf(kind)]),commitment,snapshot,le(integer(r.principal)),le(integer(r.coupon)),le(integer(r.paid)),le(integer(r.retired)),le(integer(r.remainingSupply)),le(BigInt(r.processedHolders),4),le(integer(r.yes)),le(integer(r.no)),le(integer(r.abstain)),Buffer.from([Number(r.quorumMet),Number(r.passed)]),le(integer(r.finalizedSlot)),le(integer(r.finalizedAt))]);
    check(Buffer.from(r.summaryHash).equals(await hash([Buffer.from('recorda:receipt:v2'),body])),"Receipt outcome hash mismatch");
  } else check(stageV2(a)!=='finalized',"Missing finalized receipt");
  if(['approved','funded','executing','settled','finalized'].includes(stageV2(a))) check(a.approvedBy.equals(a.authority),"Missing authorized approval");
  return { issues, verified: issues.length===0 };
}
