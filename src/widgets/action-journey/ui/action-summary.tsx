import { usePreferences } from '@/shared/preferences/workspace-preferences';
import { Check, Clock3, ShieldCheck } from "lucide-react";
import { type ReportV2, kindV2, stageV2 } from "@/shared/solana/actions-v2";
import { mockMoney, percentBps } from "@/shared/lib/display";

const phaseNames: Record<string, string> = { scheduled: 'Waiting for record date', snapshotPending: 'Capturing holders', snapshotted: 'Ready to calculate', awaitingApproval: 'Ready for approval', approved: 'Approved', funded: 'Ready to execute', executing: 'Execution in progress', settled: 'Ready to finalize receipt', finalized: 'Completed', cancelled: 'Cancelled' };
export function ActionSummary({ report, issues }: { report: ReportV2; issues: string[] }) {
 const {t,language}=usePreferences();
  const kind = kindV2(report.action), state = stageV2(report.action);
  const voting = kind === 'voting';
  const calculated = !['scheduled', 'snapshotPending', 'snapshotted', 'cancelled'].includes(state);
  const stages = voting ? ['Record date', 'Rights', 'Approval', 'Votes', 'Receipt'] : ['Record date', 'Rights', 'Approval', 'Payment', 'Receipt'];
  const current = ['scheduled', 'snapshotPending'].includes(state) ? 0 : state === 'snapshotted' ? 1 : state === 'awaitingApproval' ? 2 : state === 'finalized' ? 5 : state === 'settled' ? 4 : 3;
  const cutoff = new Date(Number(report.action.parameters.recordAt.toString()) * 1000);
  return <section className="action-summary"><div className="summary-heading"><div><span className="eyebrow">{kind === 'partialRedemption' ? t('Partial Redemption').toUpperCase() : t(kind).toUpperCase()} {t("/ ON-CHAIN ACTION")}</span><h2>{t(phaseNames[state] || state)}</h2></div><span className={`verification-badge ${issues.length ? 'verification-failed' : ''}`}><ShieldCheck size={15} />{t("Audit:")} {issues.length ? t('FAILED') : t('Verified')}</span></div>
    <div className="summary-metrics"><div><span>{voting ? t('Record-date voting units') : t('Total obligation')}</span><strong>{!calculated ? t('Not calculated') : voting ? report.rights.reduce((total, right) => total + BigInt(right.account.units.toString()), 0n).toString() : mockMoney(report.action.total)}</strong></div><div><span>{voting ? t('Required quorum') : t('Principal')}</span><strong>{voting ? percentBps(report.action.parameters.quorumBps) : calculated ? mockMoney(report.action.principal) : t('Not calculated')}</strong></div><div><span>{voting ? t('Votes cast') : t('Coupon component')}</span><strong>{voting ? (BigInt(report.action.yes.toString()) + BigInt(report.action.no.toString()) + BigInt(report.action.abstain.toString())).toString() : calculated ? mockMoney(report.action.coupon) : t('Not calculated')}</strong></div></div>
    <ol className="execution-progress" aria-label={t("Action progress")}>{stages.map((label, index) => <li key={label} className={state === 'cancelled' ? '' : index < current ? 'progress-done' : index === current ? 'progress-current' : ''}><span>{state !== 'cancelled' && index < current ? <Check size={13} /> : index + 1}</span>{t(label)}</li>)}</ol>
    <p className="summary-cutoff"><Clock3 size={14} />{t("Record date:")} {cutoff.toLocaleString(language==='ru'?'ru-RU':'en-US')} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    {!voting && <p className="summary-disclosure">{t("Paid:")} {mockMoney(report.action.paid)} {t("· Retired:")} {report.action.retired.toString()} {t("bonds · Outstanding:")} {report.instrument.outstandingSupply.toString()} {t("bonds")}{report.instrument.redeemed ? t(' · Instrument redeemed') : ''}</p>}
    <p className="summary-disclosure">{voting ? t('Voting records a decision; changing bond terms is a separate approved action.') : t('Mock USD is an on-chain test asset with no real fiat value. Coupon and principal are shown separately.')}</p>
  </section>;
}

export function HolderRightCard({ report, holder }: { report: ReportV2; holder: string }) {
 const {t}=usePreferences();
  const right = report.rights.find(item => item.account.holder.toBase58() === holder)?.account;
  if (!right) return null;
  const current = report.balances.find(item => item.holder === holder)?.units;
  const voting = kindV2(report.action) === 'voting';
  const couponUnits = ['redemption', 'partialRedemption'].includes(kindV2(report.action)) ? right.retireUnits : right.units;
  return <div className="holder-right-card"><div className="holder-right-heading"><span className="eyebrow">{t("YOUR RIGHT / RECORD-DATE UNITS")}</span><ShieldCheck size={19} /></div><div className="holder-right-values"><div><span>{t("Current units:")} {current ?? t('Unavailable')}</span><strong>{current ?? '—'}</strong></div><div><span>{t("Snapshot units:")} {right.units.toString()}</span><strong>{right.units.toString()}</strong></div><div className="holder-entitlement"><span>{voting ? t('Voting power') : t('Your entitlement')}</span><strong>{!right.calculated ? t('Not calculated') : voting ? `${right.units.toString()} ${t("Votes")}` : mockMoney(right.total)}</strong></div></div><p>{t("Current ownership can change. Once finalized, this action uses your fixed record-date units.")}</p><p className="right-breakdown">{voting ? t('Your signature is required to vote.') : right.calculated ? `${t("Principal")}: ${mockMoney(right.principal)} · ${t("Coupon")}: ${mockMoney(right.coupon)}` : t('Calculation pending')} · {right.processed ? t('Processed') : t('Unprocessed')}</p>{!voting && report.action.parameters.includeCoupon && <p className="right-breakdown">{t("Coupon formula:")} {couponUnits.toString()} {t("units ×")} {mockMoney(report.action.face)} × {percentBps(report.action.rateBps)} ÷ {report.action.frequency}{t(". Rounded down to cents per holder.")}</p>}</div>;
}
