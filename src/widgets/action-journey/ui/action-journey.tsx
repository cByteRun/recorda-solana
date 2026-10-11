import { ArrowRight, Check, Circle, LockKeyhole } from "lucide-react";

type ActionHistory = { address: string; kind: string; status: string; version: number };
const actions = [
  { kind: 'coupon', title: 'Coupon', description: 'Pay record-date holders' },
  { kind: 'voting', title: 'Voting', description: 'Record a holder decision' },
  { kind: 'redemption', title: 'Redemption', description: 'Return principal & retire bonds' },
];

export function ActionJourney({ instrument, currentKind, currentAction, history = [], redeemed = false, busy = false }: { instrument: string; currentKind?: string; currentAction?: string; history?: ActionHistory[]; redeemed?: boolean; busy?: boolean }) {
  return <section className="action-journey" aria-label="Instrument lifecycle"><div className="journey-intro"><span className="eyebrow">INSTRUMENT LIFECYCLE</span><p>One bond. Three moments that matter.</p></div><ol>{actions.map((item, index) => {
    const matches = history.filter(action => action.kind.toLowerCase() === item.kind);
    const existing = matches.find(action => action.address === currentAction) || matches.find(action => action.status === 'finalized') || matches.find(action => action.status !== 'cancelled') || matches[0];
    const active = currentKind === item.kind;
    const status = existing?.status || (active ? 'In progress' : redeemed ? 'Instrument redeemed' : 'No action loaded');
    const href = existing ? `${existing.version === 2 ? '/actions' : '/protocol'}?action=${existing.address}` : instrument && !redeemed ? `/actions?instrument=${encodeURIComponent(instrument)}&kind=${item.kind}` : null;
    const content = <><span className="journey-number">{existing?.status === 'finalized' ? <Check size={15} /> : redeemed && !existing ? <LockKeyhole size={14} /> : `0${index + 1}`}</span><div><strong>{item.title}</strong><small>{item.description}</small><span className="journey-status">{status}</span></div>{href ? <ArrowRight size={16} /> : <Circle size={10} />}</>;
    return <li key={item.kind} className={active ? 'journey-active' : ''} aria-current={active ? 'step' : undefined}>{href && !busy ? <a href={href} aria-label={`${item.title}: ${item.description}. ${status}`}>{content}</a> : <div>{content}</div>}</li>;
  })}</ol><p className="journey-note">Coupon → Voting → Full Redemption. Each action fixes its own record-date rights. Status reflects loaded actions only.</p></section>;
}
