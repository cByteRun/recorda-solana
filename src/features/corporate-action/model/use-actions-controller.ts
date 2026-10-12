import { useConnectedWallet } from "@/shared/solana/use-connected-wallet";
import { useBondOps } from "@/features/bondops/model/bondops-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, createMintToInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import { createGovernance } from "@/shared/solana/governance";
import { createActionsV2, auditActionsV2, kindV2, stageV2, type ReportV2, type ParametersV2, type ActionKindV2 } from "@/shared/solana/actions-v2";
import { connection } from "@/shared/solana/config";
import { getPhantom } from "@/shared/solana/phantom";
import { phantomSignAndSend } from "@/shared/solana/transactions";
import { readChainClock } from "@/shared/solana/chain-clock.mjs";
import { listActionHistory, exportActionAudit } from "@/shared/solana/audit-history";
import { u64 } from "@/shared/solana/protocol";

export function useActionsController() {
  const ops=useBondOps();
  const creating=new URLSearchParams(location.search).has("new");
  const selected=useRef(creating||new URLSearchParams(location.search).has("action")||new URLSearchParams(location.search).has("instrument"));
  const governanceClient=useMemo(()=>createGovernance(connection),[]);
  const [governance,setGovernance]=useState<Awaited<ReturnType<typeof governanceClient.read>>>(null);
  const [intentAddress,setIntentAddress]=useState(new URLSearchParams(location.search).get("intent")||""),[intent,setIntent]=useState<Awaited<ReturnType<typeof governanceClient.readIntent>>|null>(null);
  const [verifiedProposal,setVerifiedProposal]=useState("");
  const [fundingAccount,setFundingAccount]=useState("");
  const client = useMemo(() => createActionsV2(connection), []);
  const [address, setAddress] = useState(new URLSearchParams(location.search).get("action") || "");
  const [instrument, setInstrument] = useState(new URLSearchParams(location.search).get("instrument") || "");
  const [wallet, setWallet] = useConnectedWallet(), [role, setRole] = useState(ops.session?.member?.role==='investor'?"Investor":ops.session?.member?.role==='operator'?"Operator":address ? "Auditor" : "Operator");
  const [report, setReport] = useState<ReportV2 | null>(null), [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [signature, setSignature] = useState("");
  const requestedKind = new URLSearchParams(location.search).get('kind');
  const [kind, setKind] = useState<ActionKindV2>(requestedKind && ['coupon','voting','redemption','partialRedemption'].includes(requestedKind) ? requestedKind as ActionKindV2 : "coupon"), [period, setPeriod] = useState("1"), [includeCoupon, setIncludeCoupon] = useState(false);
  const [record, setRecord] = useState(""), [opens, setOpens] = useState(""), [closes, setCloses] = useState(""), [quorum, setQuorum] = useState("5000"), [fraction, setFraction] = useState("2000"), [proposal, setProposal] = useState("");
  const [historyItems,setHistoryItems]=useState<Awaited<ReturnType<typeof listActionHistory>>["entries"]>([]),[historyCursor,setHistoryCursor]=useState<string|null>(null);
  const lock = useRef(false);
  async function refresh(actionAddress = address) {
    setReport(null);setIssues([]);
    const key = new PublicKey(actionAddress), data = await client.read(key), audit = await auditActionsV2(key,data);
    const indexed=await listActionHistory(connection,data.action.instrument);setHistoryItems(indexed.entries);setHistoryCursor(indexed.cursor);
    setGovernance(await governanceClient.read(data.action.instrument));
    setReport(data);setIssues(audit.issues);setInstrument(data.action.instrument.toBase58());setAddress(actionAddress);
    const url = new URL(location.href);url.searchParams.set("action",actionAddress);history.replaceState(null,"",url);
  }
  async function run(work: () => Promise<void>) {
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try { await work(); } catch(e) { setError(e instanceof Error?e.message:String(e)); } finally {lock.current=false;setBusy(false);}
  }
  async function send(instructions: TransactionInstruction[]) {
    if(!wallet)throw new Error("Connect the signing wallet");
    const direct=async(items:TransactionInstruction[])=>phantomSignAndSend({provider:getPhantom(),operator:wallet,instructions:items,rpc:connection,label:"Recorda action",onSubmitted:setSignature});
    const g=instrument?await governanceClient.read(new PublicKey(instrument)):null;
    for(const instruction of instructions){
      if(g&&instruction.programId.equals(client.program.programId)&&instruction.keys.some(k=>k.pubkey.equals(g.data.signer)&&k.isSigner)){
        const clock=await readChainClock(connection),proposal=await governanceClient.propose(new PublicKey(instrument),wallet,instruction,BigInt(Date.now()),clock.timestamp+600n);
        await direct([proposal.instruction]);setIntentAddress(proposal.address.toBase58());const stored=await governanceClient.readIntent(proposal.address);setIntent(stored);
        const url=new URL(location.href);url.searchParams.set('intent',proposal.address.toBase58());history.replaceState(null,'',url);
        const approvals=stored.approvals.toString(2).replaceAll('0','').length;
        if(approvals<g.data.roles[stored.role].threshold)throw Error('Intent proposed on chain. A second authorized member must approve before execution; reopen this link to resume.');
        await direct([await governanceClient.execute(new PublicKey(instrument),proposal.address)]);setIntent(await governanceClient.readIntent(proposal.address));
      }else await direct([instruction]);
    }
  }
  async function mutation(work: (key: PublicKey, signer: PublicKey) => Promise<TransactionInstruction[]>) {
    if(!wallet||!report||issues.length)throw new Error("A verified action and signing wallet are required");
    await send(await work(new PublicKey(address),governance?.data.signer??wallet));await refresh();
  }
  useEffect(() => { if(address||intentAddress)void run(async()=>{if(intentAddress)setIntent(await governanceClient.readIntent(new PublicKey(intentAddress)));if(address)await refresh(address);}); }, []); // Initial URL is a chain reference, never cached state.
  useEffect(()=>{if(creating&&ops.data&&!instrument){const available=ops.data.instruments.find(i=>i.authority===ops.wallet&&BigInt(i.supply)>0n);if(available)setInstrument(available.id);}if(selected.current||!ops.data)return;const candidates=ops.data.actions.filter(a=>a.version===2&&ops.data!.instruments.some(i=>i.id===a.instrument&&i.authority===ops.wallet));const current=candidates.sort((a,b)=>b.recordAt.localeCompare(a.recordAt))[0];if(current){selected.current=true;void run(()=>refresh(current.id));}},[ops.data,ops.wallet]);
  useEffect(() => {
    let provider: ReturnType<typeof getPhantom>;try{provider=getPhantom();}catch{return;}
    const changed=(key?: PublicKey | null)=>setWallet(key ?? null);
    const disconnected=()=>setWallet(null);
    provider.on?.("accountChanged",changed);provider.on?.("disconnect",disconnected);
    return()=>{provider.removeListener?.("accountChanged",changed);provider.removeListener?.("disconnect",disconnected);};
  }, []);
  async function create() {
    if(!wallet)throw new Error("Connect Operator wallet");
    const clock=await readChainClock(connection);
    const timestamp=(value:string,fallback:bigint)=>value?BigInt(Math.floor(Date.parse(value)/1000)):fallback;
    const recordAt=timestamp(record,clock.timestamp+60n),opensAt=timestamp(opens,recordAt+60n),closesAt=timestamp(closes,opensAt+300n);
    const hash=kind==='voting'?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(proposal)))):Array(32).fill(0);
    if(kind==='voting'&&!proposal.trim())throw new Error("Proposal text is required");
    const coupon=kind==='coupon'||includeCoupon;
    const parameters:ParametersV2={kind:{[kind]:{}} as ParametersV2['kind'],recordAt:u64(recordAt),period:u64(coupon?BigInt(period):0n),includeCoupon:coupon,retireBps:kind==='redemption'?10000:kind==='partialRedemption'?Number(fraction):0,opensAt:u64(kind==='voting'?opensAt:0n),closesAt:u64(kind==='voting'?closesAt:0n),quorumBps:kind==='voting'?Number(quorum):0,proposalHash:hash};
    const g=await governanceClient.read(new PublicKey(instrument));
    const result=await client.create(g?.data.signer??wallet,new PublicKey(instrument),BigInt(Date.now()),parameters);
    setAddress(result.action.toBase58());const url=new URL(location.href);url.searchParams.set('action',result.action.toBase58());url.searchParams.set('instrument',instrument);history.replaceState(null,'',url);
    await send([result.instruction]);if(kind==='voting')setVerifiedProposal(Buffer.from(hash).toString('hex'));await refresh(result.action.toBase58());
  }
  const authorized=!!wallet&&!!report&&(wallet.equals(report.instrument.authority)||!!governance?.data.roles.some(role=>role.owners.some((owner:PublicKey)=>owner.equals(wallet))));
  const state=report?stageV2(report.action):"";const actionKind=report?kindV2(report.action):kind;
  const ownRight=report?.rights.find(r=>wallet?.equals(r.account.holder));
  const disabled=busy||issues.length>0||!authorized;
  async function captureAll() {
    if(!report||!wallet)throw new Error("No action");const key=new PublicKey(address),authority=governance?.data.signer??wallet;
    if(state==='scheduled')await send([await client.manage(key,authority,'beginV2')]);
    const latest=await client.read(key);
    for(const holder of latest.balances.filter(b=>b.approved)) if(!latest.rights.some(r=>r.account.holder.toBase58()===holder.holder))await send([await client.capture(key,authority,new PublicKey(holder.holder))]);
    await send([await client.manage(key,authority,'finishSnapshotV2')]);await refresh();
  }
  async function calculateAll() {
    if(!report||!wallet)throw new Error("No action");for(const r of report.rights.filter(r=>!r.account.calculated))await send([await client.calculate(new PublicKey(address),governance?.data.signer??wallet,r.account.holder)]);await refresh();
  }
  async function settle(holder:PublicKey) {
    await mutation(async(key,signer)=>{const destination=getAssociatedTokenAddressSync(report!.instrument.paymentMint,holder,false,TOKEN_2022_PROGRAM_ID);return [createAssociatedTokenAccountIdempotentInstruction(wallet!,destination,holder,report!.instrument.paymentMint,TOKEN_2022_PROGRAM_ID),await client.settle(key,actionKind==='coupon'||report!.rights.find(r=>r.account.holder.equals(holder))?.account.retireUnits.isZero()?signer:wallet!,holder,destination)];});
  }
  async function fund() {
    await mutation(async(key,signer)=>{
      const vault=client.pdas.vault(key);const instructions:TransactionInstruction[]=[];
      if(!report!.vault)instructions.push(await client.createVault(key,signer));
      const amount=BigInt(report!.action.total.toString())-(report!.vault?.amount??0n);
      // The demo payment rail is a mint controlled by the connected Operator. Production funding uses existing tokens.
      if(amount>0n)instructions.push(fundingAccount?createTransferCheckedInstruction(new PublicKey(fundingAccount),report!.instrument.paymentMint,vault,wallet!,amount,2,[],TOKEN_2022_PROGRAM_ID):createMintToInstruction(report!.instrument.paymentMint,vault,wallet!,amount,[],TOKEN_2022_PROGRAM_ID));
      instructions.push(await client.funded(key,signer));return instructions;
    });
  }
  return { client,governanceClient,intent,intentAddress,setIntent,governance,address,setAddress,instrument,setInstrument,wallet,setWallet,role,setRole,report,setReport,issues,setIssues,busy,error,signature,setSignature,kind,setKind,period,setPeriod,includeCoupon,setIncludeCoupon,record,setRecord,opens,setOpens,closes,setCloses,quorum,setQuorum,fraction,setFraction,proposal,setProposal,verifiedProposal,setVerifiedProposal,fundingAccount,setFundingAccount,run,refresh,create,authorized,state,actionKind,ownRight,disabled,captureAll,calculateAll,settle,fund,mutation,historyItems,setHistoryItems,historyCursor,setHistoryCursor };
}
