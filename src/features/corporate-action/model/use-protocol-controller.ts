import { useEffect, useMemo, useRef, useState } from "react";
import { Keypair, PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, MINT_SIZE, createInitializeMint2Instruction, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, createTransferCheckedInstruction, getAccount } from "@solana/spl-token";
import { createProtocol, RECORDA_PROGRAM_ID, type ProtocolReport } from "@/shared/solana/protocol";
import { auditProtocol, type ProtocolAudit } from "@/shared/solana/protocol-audit";
import { connection } from "@/shared/solana/config";
import { getPhantom } from "@/shared/solana/phantom";
import { phantomSignAndSend } from "@/shared/solana/transactions";
import { readChainClock, waitForRecordDate, type ChainClock } from "@/shared/solana/chain-clock.mjs";

const CACHE_KEY = "recorda:protocol:addresses:v1";
const HOLDER_KEY = "recorda:protocol:disposable-holders:v1";
interface Reference { instrument?: string; action?: string; id?: string; rpc?: string; program?: string }
function readReference(): Reference {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    if (!value || typeof value !== "object" || (value.rpc && value.rpc !== connection.rpcEndpoint) || (value.program && value.program !== RECORDA_PROGRAM_ID.toBase58())) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, val]) => ["instrument", "action", "id", "rpc", "program"].includes(key) && typeof val === "string"));
  } catch { return {}; }
}
function stage(report: ProtocolReport | null) { return report ? Object.keys(report.action.status)[0] : "notCreated"; }
function demoHolders(): Keypair[] {
  const stored = localStorage.getItem(HOLDER_KEY);
  if (stored) {
    const secrets = JSON.parse(stored) as number[][];
    if (secrets.length !== 4) throw new Error("Invalid disposable holder cache");
    return secrets.map(secret => Keypair.fromSecretKey(Uint8Array.from(secret)));
  }
  const holders = Array.from({ length: 4 }, () => Keypair.generate());
  localStorage.setItem(HOLDER_KEY, JSON.stringify(holders.map(h => [...h.secretKey])));
  return holders;
}

export function useProtocolController() {
  const protocol = useMemo(() => createProtocol(connection), []);
  const references = useMemo(readReference, []);
  const [operator, setOperator] = useState<PublicKey | null>(null);
  const [instrument, setInstrument] = useState(references.instrument || "");
  const [action, setAction] = useState(new URLSearchParams(location.search).get("action") || references.action || "");
  const [report, setReport] = useState<ProtocolReport | null>(null);
  const [audit, setAudit] = useState<ProtocolAudit | null>(null);
  const [progress, setProgress] = useState("");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [recordDate, setRecordDateValue] = useState(new Date(Date.now() + 60_000).toISOString().slice(0, 19) + "Z");
  const recordDateEdited = useRef(false);
  function setRecordDate(value: string) { recordDateEdited.current = true; setRecordDateValue(value); }
  const [chainClock, setChainClock] = useState<ChainClock | null>(null);
  const [clockError, setClockError] = useState("");
  const [holderWallet, setHolderWallet] = useState(""), [holderUnits, setHolderUnits] = useState("0");
  const [setupMaturity,setSetupMaturity]=useState("");
  const [setupHolders,setSetupHolders]=useState(["","","",""]);
  const [setupId, setSetupId] = useState(references.id || String(Date.now()));
  const lock = useRef(false);
  const state = stage(report);
  const authorized = !!operator && !!report && report.instrument.authority.equals(operator);
  const pending = busy || !authorized || !audit || audit.issues.length > 0;
  const snapshotReady = state === "snapshotPending" || (state === "scheduled" && !!chainClock && !!report && chainClock.timestamp >= BigInt(report.action.recordTimestamp.toString()));
  const expectedUnits = [10n, 5n, 2n, 0n];

  function save(next: { instrument?: string; action?: string; id?: string }) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readReference(), ...next, rpc: connection.rpcEndpoint, program: protocol.program.programId.toBase58() }));
  }
  async function refresh(address = action) {
    setProgress("Reading and independently verifying chain state…");
    setAudit(null);
    setReport(null); // Failed reads must never leave a previous action's entitlement visible.
    if (!address) return;
    const loaded = await protocol.read(new PublicKey(address));
    const checked = await auditProtocol(new PublicKey(address), loaded);
    setAction(address); setAudit(checked); setReport(loaded); setInstrument(loaded.action.instrument.toBase58());
    save({ instrument: loaded.action.instrument.toBase58(), action: address });
    const url = new URL(location.href); url.searchParams.set("action", address); history.replaceState(null, "", url);
  }
  async function run(work: () => Promise<void>, recover = true) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSignature(""); setProgress("Preparing operation…");
    try { await work(); } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // A confirmed or ambiguous partial batch is recovered from PDAs, never a cached status.
      const saved = readReference().action;
      if (recover && saved) { try { await refresh(saved); } catch { setReport(null); } }
      setError(message);
    }
    finally { lock.current = false; setBusy(false); setProgress(""); }
  }
  async function send(instructions: TransactionInstruction[], signers: Keypair[] = [], minContextSlot = 0) {
    if (!operator) throw new Error("Connect the authorized Operator wallet");
    setSignature("");
    return phantomSignAndSend({ provider: getPhantom(), operator, instructions, partialSigners: signers, minContextSlot, rpc: connection, label: "Recorda protocol",
      onSubmitted: setSignature,
      onProgress: stage => setProgress({ simulating: "Checking transaction before signing…", wallet: "Waiting for your signature in Phantom…", submitted: "Transaction submitted. Waiting for confirmation…", confirmed: "Transaction confirmed. Continuing operation…" }[stage]) });
  }
  async function connect() {
    setProgress("Waiting for Phantom connection…");
    const wallet = await getPhantom().connect(); setOperator(wallet.publicKey);
    if (!recordDateEdited.current) {
      const clock = await readChainClock(connection);
      setRecordDateValue(new Date(Number(clock.timestamp + 60n) * 1000).toISOString());
    }
  }
  async function setup() {
    if (!operator) throw new Error("Connect Phantom");
    const fallback = demoHolders();
    const holderKeys = setupHolders.map((value,index)=>value.trim()?new PublicKey(value.trim()):fallback[index].publicKey);
    if(new Set(holderKeys.map(key=>key.toBase58())).size!==4)throw new Error("A/B/C/D must be distinct holder addresses");
    const executable = await connection.getAccountInfo(protocol.program.programId);
    if (!executable?.executable) throw new Error(`Recorda program ${protocol.program.programId.toBase58()} is not deployed on this RPC. Start the local validator with recorda.so or configure the deployed Devnet program address.`);
    const id = BigInt(setupId), mint = protocol.pdas.mint(operator, id), address = protocol.pdas.instrument(mint);
    // PDAs restore partially completed setup; no existing position is reissued.
    if (!(await connection.getAccountInfo(address))) {
      const payment = Keypair.generate();
      const create = await protocol.createInstrument(operator, payment.publicKey, id, setupMaturity?BigInt(Math.floor(Date.parse(setupMaturity)/1000)):(await readChainClock(connection)).timestamp+86400n*180n);
      await send([
        SystemProgram.createAccount({ fromPubkey: operator, newAccountPubkey: payment.publicKey, space: MINT_SIZE,
          lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE), programId: TOKEN_2022_PROGRAM_ID }),
        createInitializeMint2Instruction(payment.publicKey, 2, operator, null, TOKEN_2022_PROGRAM_ID), create.instruction
      ], [payment]);
    }
    setInstrument(address.toBase58()); save({ instrument: address.toBase58(), id: setupId });
    for (let index = 0; index < holderKeys.length; index++) {
      const holder = holderKeys[index];
      if (!(await connection.getAccountInfo(protocol.pdas.holder(address, holder)))) await send([await protocol.registerHolder(operator, address, holder, expectedUnits[index])]);
    }
  }
  async function createAction() {
    if (!operator) throw new Error("Connect Phantom");
    const record = Date.parse(recordDate);
    if (!Number.isFinite(record)) throw new Error("Invalid record timestamp");
    const next = await protocol.createCoupon(operator, new PublicKey(instrument), BigInt(Date.now()), BigInt(Math.floor(record / 1000)));
    // Save address before broadcast; recovery reads chain state rather than repeating creation.
    setAction(next.action.toBase58()); save({ action: next.action.toBase58() });
    await send([next.instruction]); await refresh(next.action.toBase58());
  }
  async function snapshot() {
    if (!operator || !report) return;
    const address = new PublicKey(action);
    const live = await protocol.read(address);
    if (stage(live) === "scheduled") {
      const clock = await waitForRecordDate(connection, live.action.recordTimestamp.toString());
      await send([await protocol.manage(address, operator, "beginSnapshot")], [], clock.contextSlot);
    }
    for (const { account: p } of live.positions) if (p.approved && !(await connection.getAccountInfo(protocol.pdas.entitlement(address, p.holder)))) {
      await send([await protocol.snapshotHolder(address, operator, p.holder)]);
    }
    await send([await protocol.manage(address, operator, "finalizeSnapshot")]); await refresh();
  }
  async function calculate() {
    if (!operator || !report) return;
    const live = await protocol.read(new PublicKey(action));
    for (const { account: e } of live.rights) if (!e.calculated) await send([await protocol.calculate(new PublicKey(action), operator, e.holder)]);
    await refresh();
  }
  async function fund() {
    if (!operator || !report) return;
    const address = new PublicKey(action), mint = report.instrument.paymentMint;
    const treasury = getAssociatedTokenAddressSync(mint, operator, false, TOKEN_2022_PROGRAM_ID);
    const vault = await getAccount(connection, protocol.pdas.vault(address), "confirmed", TOKEN_2022_PROGRAM_ID);
    const missing = BigInt(report.action.totalObligationMinor.toString()) - vault.amount;
    const instructions: TransactionInstruction[] = [];
    if (missing > 0n) instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(operator, treasury, operator, mint, TOKEN_2022_PROGRAM_ID),
      createMintToInstruction(mint, treasury, operator, missing, [], TOKEN_2022_PROGRAM_ID),
      createTransferCheckedInstruction(treasury, mint, vault.address, operator, missing, 2, [], TOKEN_2022_PROGRAM_ID)
    );
    instructions.push(await protocol.markFunded(address, operator));
    await send(instructions); await refresh();
  }
  async function settle() {
    if (!operator) return;
    const address = new PublicKey(action), live = await protocol.read(address);
    for (const { account: e } of live.rights) if (!e.settled) {
      const destination = getAssociatedTokenAddressSync(live.instrument.paymentMint, e.holder, false, TOKEN_2022_PROGRAM_ID);
      await send([createAssociatedTokenAccountIdempotentInstruction(operator, destination, e.holder, live.instrument.paymentMint, TOKEN_2022_PROGRAM_ID),
        await protocol.settle(address, operator, e.holder, destination)]);
    }
    await refresh();
  }
  async function transferDemo() {
    if (!operator || !report) return;
    const [a, b] = demoHolders();
    await send([await protocol.transfer(report.action.instrument, a.publicKey, b.publicKey, 4n)], [a]);
    await refresh();
  }
  useEffect(() => { if (action) void run(() => refresh(action), false); /* explicit subsequent refresh */ }, []);

  useEffect(() => {
    setChainClock(null); setClockError("");
    if (state !== "scheduled") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const clock = await readChainClock(connection);
        if (active) { setChainClock(clock); setClockError(""); }
      } catch (e) {
        if (active) { setChainClock(null); setClockError(e instanceof Error ? e.message : String(e)); }
      }
      if (active) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [action, state]);

  useEffect(() => {
    let provider;
    try { provider = getPhantom(); } catch { return; }
    const changed = (publicKey?: PublicKey | null) => setOperator(publicKey ?? null);
    const disconnected = () => setOperator(null);
    provider.on?.("accountChanged", changed);
    provider.on?.("disconnect", disconnected);
    return () => {
      provider.removeListener?.("accountChanged", changed);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, [operator]);

  const demoAddresses = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HOLDER_KEY) || "[]") as number[][];
      return stored.length === 4 ? stored.map(secret => Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey.toBase58()) : [];
    } catch { return []; }
  }, [report]);

  return { progress, signature, authorized, demoAddresses, protocol, operator, instrument, setInstrument, action, setAction, report, setReport,
    busy, error, audit, recordDate, setRecordDate, holderWallet, setHolderWallet, holderUnits, setHolderUnits,
    setupHolders,setSetupHolders,setupMaturity,setSetupMaturity,setupId, setSetupId, state, pending, run, send, connect, setup, createAction, refresh,
    snapshot, snapshotReady, chainClock, clockError, calculate, fund, settle, transferDemo };
}
