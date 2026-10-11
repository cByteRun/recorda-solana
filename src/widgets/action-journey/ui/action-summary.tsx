import { Check, Clock3, ShieldCheck } from "lucide-react";
import { type ReportV2, kindV2, stageV2 } from "@/shared/solana/actions-v2";
import { mockMoney, percentBps } from "@/shared/lib/display";

const phaseNames: Record<string, string> = { scheduled: 'Waiting for record date', snapshotPending: 'Capturing holders', snapshotted: 'Ready to calculate', awaitingApproval: 'Ready for approval', approved: 'Approved', funded: 'Ready to execute', executing: 'Execution in progress', settled: 'Ready to finalize receipt', finalized: 'Completed', cancelled: 'Cancelled' };
export function ActionSummary({ report, issues }: { report: ReportV2; issues: string[] }) {
  const kind = kindV2(report.action), state = stageV2(report.action);
  const voting = kind === 'voting';
  const calculated = !['scheduled', 'snapshotPending', 'snapshotted', 'cancelled'].includes(state);
  const stages = voting ? ['Record date', 'Rights', 'Approval', 'Votes', 'Receipt'] : ['Record date', 'Rights', 'Approval', 'Payment', 'Receipt'];
  const current = ['scheduled', 'snapshotPending'].includes(state) ? 0 : state === 'snapshotted' ? 1 : state === 'awaitingApproval' ? 2 : state === 'finalized' ? 5 : state === 'settled' ? 4 : 3;
  const cutoff = new Date(Number(report.action.parameters.recordAt.toString()) * 1000);
  return <section className="action-summary"><div className="summary-heading"><div><span className="eyebrow">{kind === 'partialRedemption' ? 'PARTIAL REDEMPTION' : kind.toUpperCase()} / ON-CHAIN ACTION</span><h2>{phaseNames[state] || state}</h2></div><span className={`verification-badge ${issues.length ? 'verification-failed' : ''}`}><ShieldCheck size={15} />Audit: {issues.length ? 'FAILED' : 'Verified'}</span></div>
    <div className="summary-metrics"><div><span>{voting ? 'Record-date voting units' : 'Total obligation'}</span><strong>{!calculated ? 'Not calculated' : voting ? report.rights.reduce((total, right) => total + BigInt(right.account.units.toString()), 0n).toString() : mockMoney(report.action.total)}</strong></div><div><span>{voting ? 'Required quorum' : 'Principal'}</span><strong>{voting ? percentBps(report.action.parameters.quorumBps) : calculated ? mockMoney(report.action.principal) : 'Not calculated'}</strong></div><div><span>{voting ? 'Votes cast' : 'Coupon component'}</span><strong>{voting ? (BigInt(report.action.yes.toString()) + BigInt(report.action.no.toString()) + BigInt(report.action.abstain.toString())).toString() : calculated ? mockMoney(report.action.coupon) : 'Not calculated'}</strong></div></div>
    <ol className="execution-progress" aria-label="Action progress">{stages.map((label, index) => <li key={label} className={state === 'cancelled' ? '' : index < current ? 'progress-done' : index === current ? 'progress-current' : ''}><span>{state !== 'cancelled' && index < current ? <Check size={13} /> : index + 1}</span>{label}</li>)}</ol>
    <p className="summary-cutoff"><Clock3 size={14} />Record date: {cutoff.toLocaleString()} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    {!voting && <p className="summary-disclosure">Paid: {mockMoney(report.action.paid)} · Retired: {report.action.retired.toString()} bonds · Outstanding: {report.instrument.outstandingSupply.toString()} bonds{report.instrument.redeemed ? ' · Instrument redeemed' : ''}</p>}
    <p className="summary-disclosure">{voting ? 'Voting records a decision; changing bond terms is a separate approved action.' : 'Mock USD is an on-chain test asset with no real fiat value. Coupon and principal are shown separately.'}</p>
  </section>;
}

export function HolderRightCard({ report, holder }: { report: ReportV2; holder: string }) {
  const right = report.rights.find(item => item.account.holder.toBase58() === holder)?.account;
  if (!right) return null;
  const current = report.balances.find(item => item.holder === holder)?.units;
  const voting = kindV2(report.action) === 'voting';
  const couponUnits = ['redemption', 'partialRedemption'].includes(kindV2(report.action)) ? right.retireUnits : right.units;
  return <div className="holder-right-card"><div className="holder-right-heading"><span className="eyebrow">YOUR RIGHT / RECORD-DATE UNITS</span><ShieldCheck size={19} /></div><div className="holder-right-values"><div><span>Current units: {current ?? 'Unavailable'}</span><strong>{current ?? '—'}</strong></div><div><span>Snapshot units: {right.units.toString()}</span><strong>{right.units.toString()}</strong></div><div className="holder-entitlement"><span>{voting ? 'Voting power' : 'Your entitlement'}</span><strong>{!right.calculated ? 'Not calculated' : voting ? `${right.units.toString()} votes` : mockMoney(right.total)}</strong></div></div><p>Current ownership can change. Once finalized, this action uses your fixed record-date units.</p><p className="right-breakdown">{voting ? 'Your signature is required to vote.' : right.calculated ? `Principal: ${mockMoney(right.principal)} · Coupon: ${mockMoney(right.coupon)}` : 'Calculation pending'} · {right.processed ? 'Processed' : 'Unprocessed'}</p>{!voting && report.action.parameters.includeCoupon && <p className="right-breakdown">Coupon formula: {couponUnits.toString()} units × {mockMoney(report.action.face)} × {percentBps(report.action.rateBps)} ÷ {report.action.frequency}. Rounded down to cents per holder.</p>}</div>;
}
