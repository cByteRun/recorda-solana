import { useState } from 'react';
import { ArrowUpRight, FileCheck2, Landmark, ShieldCheck, TriangleAlert, Vote } from 'lucide-react';
import { actionHref, amount, dateTime, useBondOps, type Action } from '@/features/bondops/model/bondops-context';
import { actionControl, CONTROL_LABELS, CONTROL_STAGES, type ControlStage } from '@/features/bondops/model/action-control';
import { usePreferences } from '@/shared/preferences/workspace-preferences';
import { explorerAddress } from '@/shared/solana/config';

export function ServicingControl() {
  const ops = useBondOps(), { t } = usePreferences();
  const [stage, setStage] = useState<ControlStage | 'all'>('all');
  const actions = ops.data!.actions.filter(a => a.status !== 'cancelled');
  const controls = actions.map(action => ({ action, control: actionControl(action) }));
  const rows = controls.filter(row => stage === 'all' || row.control.stage === stage);
  // Put uncertainty first, then overdue work; do not infer execution readiness from dates.
  rows.sort((a, b) => Number(b.control.stage === 'review') - Number(a.control.stage === 'review') || Number(b.action.timing === 'overdue') - Number(a.action.timing === 'overdue') || (a.action.dueAt ?? '9999').localeCompare(b.action.dueAt ?? '9999') || a.action.id.localeCompare(b.action.id));
  return <section className="card ops-control" aria-label={t('Corporate action control')}>
    <div className="ops-panel-head">
      <div><p className="eyebrow">{t('RIGHTS → AUTHORIZATION → EXECUTION → RECEIPT')}</p><h2 className="card-heading">{t('Corporate action control')}</h2><p className="card-desc">{t('All instruments and assets. Each action has its own cutoff, rights and outcome.')}</p></div>
      <button className="btn subtle" aria-pressed={stage === 'all'} onClick={() => setStage('all')}>{t('All actions')} · {actions.length}</button>
    </div>
    <div className="ops-control-stages" aria-label={t('Filter by next step')}>
      {CONTROL_STAGES.map(key => <button key={key} aria-pressed={stage === key} onClick={() => setStage(stage === key ? 'all' : key)}><span>{t(CONTROL_LABELS[key])}</span><strong>{controls.filter(row => row.control.stage === key).length}</strong></button>)}
    </div>
    <div className="ops-control-actions">
      {rows.map(({ action, control }) => <ActionControlCard key={action.id} action={action} control={control} />)}
      {!rows.length && <p className="empty">{t('No actions at this step')}</p>}
    </div>
    <p className="ops-control-note">{t('Dates indicate deadlines. Execution still requires the authorized signer and the action’s contract checks.')}</p>
  </section>;
}

function ActionControlCard({ action: a, control }: { action: Action; control: ReturnType<typeof actionControl> }) {
  const ops = useBondOps(), s = ops.data!, { t, language } = usePreferences();
  const voting = a.kind === 'voting', redemption = ['redemption', 'partialRedemption'].includes(a.kind);
  const calculated = a.rights.filter(r => r.calculated), fullyCalculated = a.rights.length > 0 && calculated.length === a.rights.length, units = a.rights.reduce((n, r) => n + BigInt(r.units), 0n);
  const component = (key: 'principalMinor' | 'couponMinor') => amount(calculated.reduce((n, r) => n + BigInt(r[key]), 0n).toString(), a.decimals);
  const cases = s.cases.filter(c => c.action === a.id && c.status !== 'resolved');
  const Icon = voting ? Vote : redemption ? Landmark : FileCheck2;
  const snapshotPresent = a.verified && !['scheduled', 'snapshotPending'].includes(a.status);
  const destination = control.stage === 'review' && cases.length ? `/settlements?case=${encodeURIComponent(cases[0].id)}` : actionHref(a);
  const kind = voting ? 'Bondholder voting' : redemption ? a.kind === 'partialRedemption' ? 'Partial redemption' : 'Bond redemption' : 'Coupon payment';
  return <article className={`ops-control-action ${control.stage === 'review' ? 'needs-review' : ''}`} aria-label={a.label}>
    <div className="card-top"><span className="ops-control-kind"><Icon size={16} />{t(kind)}</span><span className={`status ${control.stage === 'review' ? 'amber' : control.stage === 'complete' ? 'green' : 'neutral'}`}>{t(CONTROL_LABELS[control.stage])}</span></div>
    <h3>{a.label}</h3><p className="card-desc">{s.instruments.find(i => i.id === a.instrument)?.symbol ?? a.instrument} · {t(a.status)}</p>
    <dl className="ops-control-facts">
      <div><dt>{t('Record date / cutoff')}</dt><dd>{dateTime(a.recordAt, language)}</dd></div>
      <div><dt>{t(voting ? 'Voting closes' : redemption ? a.kind === 'redemption' ? 'Maturity / due' : 'Payment deadline' : 'Payment deadline')}</dt><dd>{dateTime(a.dueAt, language)}{a.timing === 'overdue' && <span className="status red">{t('Overdue')}</span>}</dd></div>
      <div><dt>{t('Deadline source')}</dt><dd>{a.dueSource ? t(a.dueSource) : t('Not scheduled')}</dd></div>
      <div><dt>{t('Record-date rights')}</dt><dd>{snapshotPresent ? `${a.rights.length} ${t('holders')} · ${units} ${t('record units')}` : t(a.verified ? 'Snapshot not finalized' : 'Evidence unavailable')}</dd></div>
    </dl>
    <div className="ops-control-checks"><span>{t('Approval')}: {t(a.verified ? a.approved ? 'Approved' : 'Required' : 'Evidence unavailable')}</span>{!voting && <span>{t('Vault funding')}: {t(a.verified ? a.funded ? 'Funded' : 'Required' : 'Evidence unavailable')}</span>}{redemption && <span>{t('Holder signature required')}</span>}</div>
    {voting ? <div className="ops-control-outcome"><strong>{t('Voting power from fixed rights')}</strong><p>{t('Quorum')}: {a.quorumBps === undefined ? '—' : `${a.quorumBps / 100}%`}</p><p>{a.verified && a.yes !== undefined && a.no !== undefined && a.abstain !== undefined ? `${t('YES')} ${a.yes} · ${t('NO')} ${a.no} · ${t('ABSTAIN')} ${a.abstain}` : t('Tally not available yet')}</p>{control.stage === 'complete' && a.passed !== undefined && <p>{t(a.passed ? 'Passed' : 'Not passed')}</p>}<small>{t('Voting has no payment vault or cash obligation.')}</small></div> : <div className="ops-control-outcome"><strong>{t(redemption ? 'Principal + final coupon' : 'Fixed coupon obligation')}</strong><p>{a.verified && fullyCalculated ? redemption ? `${t('Principal')}: ${component('principalMinor')} · ${t('Coupon component')}: ${component('couponMinor')} ${a.currency}` : `${component('couponMinor')} ${a.currency}` : t('Amounts available after verified calculation')}</p>{redemption && <small>{t('Confirm retirement and payment together; a payment reference alone does not retire bonds.')}</small>}</div>}
    <div className="ops-control-next"><strong>{control.stage === 'review' && <TriangleAlert size={14} />}{t(control.next)}</strong><p>{t(control.reason)}</p><a className="inline-link" href={destination}>{t(control.stage === 'review' && cases.length ? 'Review settlement' : control.stage === 'complete' ? 'View proof' : 'View action')}<ArrowUpRight size={14} /></a></div>
  </article>;
}

export function ServicedAssets({ asset }: { asset: string | undefined }) {
  const ops = useBondOps(), s = ops.data!, { t, language } = usePreferences();
  const instruments = s.instruments.filter(i => !asset || i.asset === asset);
  return <section className="card ops-assets" aria-label={t('Serviced assets')}>
    <div className="ops-panel-head"><div><p className="eyebrow">{t('ASSET → INSTRUMENT → HOLDER')}</p><h2 className="card-heading">{t('Serviced assets')}</h2><p className="card-desc">{t('Base bond terms and current supply for the selected settlement asset. Each action keeps its own terms; face value is not a market valuation.')}</p></div><a className="inline-link" href="/bonds">{t('Bond portfolio')}<ArrowUpRight size={14} /></a></div>
    <div className="ops-asset-list">{instruments.map(i => <details key={i.id} className="ops-asset"><summary><Landmark size={18} /><span><strong>{i.symbol}</strong><small>{i.name}</small></span><span className="ops-asset-supply"><strong>{i.supply} {t('outstanding')}</strong><small>{i.redeemedSupply} {t('retired')}</small></span><span className={`status ${ops.source === 'demo' ? 'neutral' : i.verified && !s.syncError ? 'green' : 'amber'}`}>{t(ops.source === 'demo' ? 'Illustrative' : i.verified && !s.syncError ? 'Verified on-chain' : 'Evidence unavailable')}</span></summary><div className="ops-asset-body"><dl className="ops-control-facts"><div><dt>{t('Face value')}</dt><dd>{amount(i.faceMinor, i.decimals)} {i.currency}</dd></div><div><dt>{t('Annual coupon / frequency')}</dt><dd>{i.rateBps / 100}% · {i.frequency} {t('payments per year')}</dd></div><div><dt>{t('Maturity')}</dt><dd>{dateTime(i.maturity, language)}</dd></div><div><dt>{t('Network / token standard')}</dt><dd>{ops.source === 'demo' ? t('Illustrative tokenized bond') : `${ops.rpcNetwork === 'local' ? 'Localnet' : 'Solana Devnet'} · Token-2022`}</dd></div><div><dt>{t('Instrument account')}</dt><dd className="id-text">{i.id}</dd></div><div><dt>{t('Authority')}</dt><dd className="id-text">{i.authority}</dd></div></dl><div className="head-buttons"><a className="inline-link" href="/holders">{t('Holder registry')}<ArrowUpRight size={14} /></a>{ops.source === 'live' && <a className="inline-link" href={explorerAddress(i.id)} target="_blank" rel="noreferrer">{t('Instrument account')}<ArrowUpRight size={14} /></a>}</div><p className="card-desc">{t('Transfers change holder positions; retirement reduces outstanding supply. Each action retains its own historical rights.')}</p></div></details>)}{!instruments.length && <p className="empty">{t('No serviced instruments loaded')}</p>}</div>
    <div className="ops-evidence-boundary"><ShieldCheck size={17} /><p>{t(ops.source === 'demo' ? 'This is an illustrative bond. No real asset backing or legal ownership is verified.' : 'On-chain verification covers program state and rights. External asset documents, reserves and bank confirmations are not connected.')}</p>{ops.session?.member?.role === 'operator' && <a className="inline-link" href="/infrastructure">{t('Evidence sources')}<ArrowUpRight size={14} /></a>}</div>
  </section>;
}
