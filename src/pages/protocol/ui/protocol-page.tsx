import { PublicKey } from "@solana/web3.js";
import { useProtocolController } from "@/features/corporate-action/model/use-protocol-controller";
import { connection } from "@/shared/solana/config";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
function minor(value: { toString(): string }) {
  const raw = BigInt(value.toString()); return `${raw / 100n}.${(raw % 100n).toString().padStart(2, "0")}`;
}
function explorer(path: string) {
  const rpc = connection.rpcEndpoint;
  const cluster = rpc.includes("devnet") ? "cluster=devnet" : `cluster=custom&customUrl=${encodeURIComponent(rpc)}`;
  return `https://explorer.solana.com/${path}?${cluster}`;
}

export function ProtocolPage() {
  const { protocol, operator, instrument, setInstrument, action, setAction, report, setReport,
    busy, error, audit, recordDate, setRecordDate, holderWallet, setHolderWallet, holderUnits, setHolderUnits,
    setupId, setSetupId, state, pending, run, send, connect, setup, createAction, refresh,
    snapshot, snapshotReady, chainClock, clockError, calculate, fund, settle, transferDemo } = useProtocolController();
  return <main data-testid="protocol-root" data-busy={busy} className="mx-auto max-w-7xl px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><a href="/" className="text-sm text-blue-700">React bridge reference</a><h1 className="mt-2 text-3xl font-semibold">Coupon Core · Record Date → Right → Execution → Proof</h1></div>
      <Button disabled={busy} onClick={() => void run(connect)}>{operator ? operator.toBase58().slice(0, 12) : "Connect Phantom"}</Button>
    </div>
    <p className="mt-4 text-sm" data-testid="protocol-boundary">IMPLEMENTED: Anchor PDA state and Token-2022 settlement. Mock USD is a test payment asset. Local Validator / Devnet only.</p>
    <p className="mt-2 break-all text-xs text-zinc-500">Program: {protocol.program.programId.toBase58()} · RPC: {connection.rpcEndpoint}</p>
    {error && <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</div>}
    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      <Card><CardContent><h2 className="text-lg font-semibold">1. Instrument + eligible holders</h2>
        <p className="mt-2 text-sm text-zinc-600">Demo: 1 bond = 1 unit; face value 1000 Mock USD; coupon 10% / 2. A/B/C/D = 10/5/2/0. Disposable holder keys stay in this browser.</p>
        <label className="mt-3 block text-sm">Demo instrument ID<input className="mt-1 w-full rounded border p-2" value={setupId} onChange={e => setSetupId(e.target.value)} /></label>
        <Button className="mt-3" disabled={busy || !operator} onClick={() => void run(setup)}>Create / resume demo instrument</Button>
        <label className="mt-3 block text-sm">Instrument PDA<input className="mt-1 w-full rounded border p-2" value={instrument} onChange={e => setInstrument(e.target.value)} /></label>
      </CardContent></Card>
      <Card><CardContent><h2 className="text-lg font-semibold">2. Schedule coupon / open existing action</h2>
        <label className="mt-3 block text-sm">Record timestamp (ISO UTC)<input className="mt-1 w-full rounded border p-2" value={recordDate} onChange={e => setRecordDate(e.target.value)} /></label>
        <Button className="mt-3" disabled={busy || !operator || !instrument} onClick={() => void run(createAction)}>Schedule coupon</Button>
        <label className="mt-3 block text-sm">Action PDA<input data-testid="protocol-action-input" disabled={busy} className="mt-1 w-full rounded border p-2" value={action} onChange={e => { setAction(e.target.value); setReport(null); }} /></label>
        <Button className="mt-3" disabled={busy || !action} onClick={() => void run(() => refresh())}>Read chain / refresh</Button>
        <p className="mt-3 text-sm text-zinc-500">Auditor: open an action without connecting a wallet. The URL restores rights and receipts from chain state.</p>
      </CardContent></Card>
    </section>
    {report && <>
      <section className="mt-6 rounded-2xl bg-zinc-950 p-5 text-white" data-testid="protocol-summary" data-state={state}>
        <h2 className="text-xl font-semibold">{state.toUpperCase()} · {minor(report.action.totalObligationMinor)} Mock USD due</h2>
        <p className="mt-2">Record date: {new Date(Number(report.action.recordTimestamp.toString()) * 1000).toISOString()} · Record slot: {report.action.recordSlot.toString()}</p>
        <p className="mt-2">Captured at: {report.action.snapshotTimestamp.isZero() ? "Pending" : new Date(Number(report.action.snapshotTimestamp.toString()) * 1000).toISOString()} · Transfers stop at the scheduled record date until snapshot finalization.</p>
        <p className="mt-2">Outstanding: {report.instrument.outstandingSupply.toString()} · Redeemed: {report.instrument.redeemedSupply.toString()} · Snapshot: {report.action.snapshotUnits.toString()} units</p>
        <p className="mt-2">Processed: {report.action.processedHolders}/{report.action.expectedHolders} · Settled: {minor(report.action.settledTotalMinor)} · Vault: {minor(report.vaultBalance)}</p>
        <p className="mt-2">Formula: snapshot units × {minor(report.instrument.faceValueMinor)} × {report.instrument.couponBps}/10000 ÷ {report.instrument.paymentsPerYear}. Floor once per holder in minor units.</p>
        <p className="mt-2 break-all text-xs">Snapshot hash: {Buffer.from(report.action.snapshotHash).toString("hex")}</p>
      </section>
      {state === "scheduled" && <p className="mt-3 text-sm" data-testid="protocol-record-time">
        {clockError ? `Cannot verify Solana record time: ${clockError}` : !chainClock ? "Checking record date against Solana time…" : snapshotReady ? "Record date reached on Solana. Snapshot is ready." : `Waiting for record date on Solana: ${new Date(Number(chainClock.timestamp) * 1000).toISOString()} · approximately ${BigInt(report.action.recordTimestamp.toString()) - chainClock.timestamp} seconds remaining.`}
      </p>}
      <section className="mt-5 flex flex-wrap gap-3" aria-label="Operator actions">
        <Button disabled={pending || !snapshotReady} onClick={() => void run(snapshot)}>Begin / resume snapshot → finalize</Button>
        <Button disabled={pending || state !== "scheduled"} onClick={() => void run(async () => { await send([await protocol.manage(new PublicKey(action), operator!, "cancelAction")]); await refresh(); })}>Cancel scheduled coupon</Button>
        <Button disabled={pending || state !== "snapshotted"} onClick={() => void run(calculate)}>Calculate protocol rights</Button>
        <Button disabled={pending || state !== "awaitingApproval"} onClick={() => void run(async () => { await send([await protocol.manage(new PublicKey(action), operator!, "approveAction")]); await refresh(); })}>Approve in Phantom</Button>
        <Button disabled={pending || state !== "approved"} onClick={() => void run(fund)}>Fund vault with mock USD</Button>
        <Button disabled={pending || !["funded", "executing"].includes(state)} onClick={() => void run(settle)}>Settle / resume unpaid holders</Button>
        <Button disabled={pending || state !== "settled"} onClick={() => void run(async () => { await send([await protocol.finalize(new PublicKey(action), operator!)]); await refresh(); })}>Finalize on-chain receipt</Button>
      </section>
      <section className="mt-6 overflow-x-auto"><h2 className="text-xl font-semibold">Holder rights / read-only verification</h2>
        <table className="mt-3 w-full text-left text-sm" data-testid="protocol-rights"><thead><tr>{["Holder", "Approved", "Current units", "Record-date units", "Entitlement", "Outcome / destination"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{report.positions.map(({ publicKey, account: p }) => {
            const e = report.rights.find(r => r.account.holder.equals(p.holder))?.account;
            return <tr key={publicKey.toBase58()} className="border-t"><td className="p-3"><a href={explorer(`address/${p.holder.toBase58()}`)}>{p.holder.toBase58().slice(0, 12)}</a></td><td className="p-3">{String(p.approved)}</td><td className="p-3">{report.balances.find(b => b.holder === p.holder.toBase58())?.units ?? "Unknown"}</td><td className="p-3">{e?.snapshotUnits.toString() ?? "Pending"}</td><td className="p-3">{e?.calculated ? `${minor(e.amountMinor)} Mock USD` : "Pending"}</td><td className="p-3">{e?.settled ? <><span>PAID {minor(e.settledAmountMinor)} · slot {e.settledSlot.toString()}</span><br /><a className="text-blue-700 underline" href={explorer(`address/${e.destination.toBase58()}`)}>Payment token account</a></> : "UNPAID"}</td></tr>;
          })}</tbody>
        </table>
      </section>
      <section className="mt-6"><h2 className="text-xl font-semibold">Registry controls</h2>
        <p className="mt-2 text-sm text-zinc-600">Approval changes require a zero balance and are blocked from the record timestamp through snapshot finalization. Registration and issuance finish before the first snapshot.</p>
        <div className="mt-3 flex flex-wrap gap-3"><input aria-label="Holder wallet" placeholder="Holder public key" className="min-w-64 rounded border p-2" value={holderWallet} onChange={e => setHolderWallet(e.target.value)} /><input aria-label="Units to issue" className="w-24 rounded border p-2" value={holderUnits} onChange={e => setHolderUnits(e.target.value)} />
          <Button disabled={pending || report.instrument.sealed} onClick={() => void run(async () => { await send([await protocol.registerHolder(operator!, report.action.instrument, new PublicKey(holderWallet), BigInt(holderUnits))]); await refresh(); })}>Register + issue</Button>
          {[true, false].map(approved => <Button key={String(approved)} disabled={pending || report.instrument.snapshotPending} onClick={() => void run(async () => { await send([await protocol.setApproved(operator!, report.action.instrument, new PublicKey(holderWallet), approved)]); await refresh(); })}>{approved ? "Approve holder" : "Revoke holder"}</Button>)}
          <Button disabled={pending || ["scheduled", "snapshotPending"].includes(state)} onClick={() => void run(transferDemo)}>Demo: A transfers 4 → B</Button>
        </div>
      </section>
      <section className="mt-6 rounded-2xl border p-5" data-testid="protocol-audit"><h2 className="text-xl font-semibold">Audit / proof</h2>
        {audit ? <>
          <p className="mt-3">Calculated sum: {minor(audit.calculatedTotal)} · Paid sum: {minor(audit.settledTotal)}</p>
          <p className="mt-2">Mismatches: {audit.issues.length === 0 ? "0" : `${audit.issues.length} · RECONCILIATION REQUIRED`}</p>
          <p className="mt-2">Snapshot hash: {audit.snapshotHashVerified ? "VERIFIED" : "Pending"} · Receipt hash: {audit.receiptHashVerified ? "VERIFIED" : "Pending"}</p>
          {audit.issues.length > 0 && <ul className="mt-2 text-rose-700" role="alert">{audit.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
        </> : <p>Verification pending</p>}
        {report.receipt ? <p className="mt-2 break-all">FINALIZED · <a className="text-blue-700 underline" href={explorer(`address/${protocol.pdas.receipt(new PublicKey(action))}`)}>ActionReceipt PDA</a> · Summary hash: {Buffer.from(report.receipt.summaryHash).toString("hex")}</p> : <p className="mt-2">Receipt pending; action has not been finalized.</p>}
        <ul className="mt-3 space-y-2">{report.signatures.filter(s => !s.err).map(s => <li key={s.signature}><a className="break-all text-sm text-blue-700 underline" href={explorer(`tx/${s.signature}`)} target="_blank" rel="noreferrer">Slot {s.slot} · {s.signature}</a></li>)}</ul>
      </section>
      <section className="mt-6" data-testid="protocol-history"><h2 className="text-xl font-semibold">Instrument coupon history</h2>
        <p className="mt-2 text-sm text-zinc-600">Historical rights and payments belong to each action; current ownership is shown separately.</p>
        <ul className="mt-3 space-y-2">{[...report.history].sort((a, b) => a.account.recordTimestamp.cmp(b.account.recordTimestamp)).map(({ publicKey, account: past }) => <li key={publicKey.toBase58()}>
          <a className="text-blue-700 underline" href={`/protocol?action=${publicKey.toBase58()}`}>Coupon #{past.id.toString()} · {Object.keys(past.status)[0].toUpperCase()} · {minor(past.totalObligationMinor)} Mock USD</a>
        </li>)}</ul>
      </section>
    </>}
  </main>;
}
