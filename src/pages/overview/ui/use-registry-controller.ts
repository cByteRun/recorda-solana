import { useBondOps } from '@/features/bondops/model/bondops-context';
import { useEffect, useRef, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { connection } from '@/shared/solana/config';
import { createProtocol, RECORDA_PROGRAM_ID } from '@/shared/solana/protocol';
import { auditProtocol } from '@/shared/solana/protocol-audit';
import { createActionsV2, auditActionsV2, stageV2 } from '@/shared/solana/actions-v2';

// The registry reads both the original coupon and the current versioned actions.
async function readRegistry(address: string) {
  const key = new PublicKey(address), protocol = createProtocol(connection);
  const info = await connection.getAccountInfo(key);
  if (!info?.owner.equals(RECORDA_PROGRAM_ID)) throw new Error('Action is missing or belongs to another program on this network');
  const discriminator = protocol.program.idl.accounts?.find(a => a.name === 'actionV2')?.discriminator;
  if (discriminator?.every((byte, index) => info.data[index] === byte)) {
    const r = await createActionsV2(connection).read(key);
    if (!('coupon' in r.action.parameters.kind)) throw new Error('Select a coupon action to inspect coupon entitlements');
    const audit = await auditActionsV2(key, r);
    return { audit, state: stageV2(r.action), instrument: r.instrument,
      receipt: r.receipt, instrumentAddress: r.action.instrument.toBase58(),
      total: r.action.total.toString(), paid: r.action.paid.toString(), expectedHolders: r.balances.length,
      rows: r.balances.map((b, index) => {
        const right = r.rights.find(x => x.account.holder.toBase58() === b.holder)?.account;
        return { name: `Holder ${index + 1}`, address: b.holder, units: BigInt(b.units),
          snapshot: right?.units.toString() ?? '—', entitlement: right?.calculated ? right.total.toString() : null,
          approved: b.approved, paid: !!right?.processed };
      }) };
  }
  const r = await protocol.read(key), audit = await auditProtocol(key, r);
  return { audit, state: Object.keys(r.action.status)[0], instrument: r.instrument,
    receipt: r.receipt, instrumentAddress: r.action.instrument.toBase58(),
    total: r.action.totalObligationMinor.toString(), paid: r.action.settledTotalMinor.toString(), expectedHolders: r.action.expectedHolders,
    rows: r.positions.map(({account}, index) => {
      const address = account.holder.toBase58(), right = r.rights.find(x => x.account.holder.toBase58() === address)?.account;
      return { name: `Holder ${index + 1}`, address, units: BigInt(r.balances.find(b => b.holder === address)?.units ?? '0'),
        snapshot: right?.snapshotUnits.toString() ?? '—', entitlement: right?.calculated ? right.amountMinor.toString() : null,
        approved: account.approved, paid: !!right?.settled };
    }) };
}
export function useRegistryController() {
  const ops=useBondOps();
  const selected=useRef(new URLSearchParams(location.search).has("action"));
  const [action, updateAction] = useState(new URLSearchParams(location.search).get('action') ?? '');
  const [report, setReport] = useState<Awaited<ReturnType<typeof readRegistry>> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef(0);
  function setAction(value: string) { selected.current=true; request.current++; setReport(null); setError(''); setBusy(false); updateAction(value); }
  useEffect(()=>{if(selected.current||!ops.data)return;const candidates=ops.data.actions.filter(a=>a.kind==='coupon'&&ops.data!.instruments.some(i=>i.id===a.instrument&&i.authority===ops.wallet));const current=candidates.sort((a,b)=>b.recordAt.localeCompare(a.recordAt))[0];if(current){selected.current=true;updateAction(current.id);}},[ops.data,ops.wallet]);
  // Editing the address clears old evidence; an in-flight read cannot replace it.
  useEffect(() => {
    if (!action) return;
    try { new PublicKey(action); } catch { return; }
    let active = true;
    const id = ++request.current;
    setBusy(true); setError(''); setReport(null);
    void readRegistry(action).then(r => { if (active && id === request.current) setReport(r); }).catch(e => { if (active && id === request.current) setError(String(e.message ?? e)); }).finally(() => { if (active && id === request.current) setBusy(false); });
    return () => { active = false; };
  }, [action]);
  async function refresh() {
    const id = ++request.current;
    setBusy(true); setError(''); setReport(null);
    try { const r = await readRegistry(action); if (id === request.current) setReport(r); }
    catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (id === request.current) setBusy(false); }
  }
  return { action, setAction, report, setReport, busy, error, refresh, audit:report?.audit,
    state:report?.state ?? 'notCreated', instrument:report?.instrumentAddress ?? '' };
}
