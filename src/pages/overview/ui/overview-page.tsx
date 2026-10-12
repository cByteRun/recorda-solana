import { useBondOps } from '@/features/bondops/model/bondops-context';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CircleDollarSign, Layers3, Search, ShieldCheck, Users, RefreshCw, Clock3 } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useRegistryController } from './use-registry-controller';
import { connection } from '@/shared/solana/config';
import { shortAddress } from '@/shared/lib/utils';
import './holder-registry.css';

const preview = [
  { name: 'Holder A', address: '', units: 6n, snapshot: '10', entitlement: '500.00', approved: true, paid: false },
  { name: 'Holder B', address: '', units: 9n, snapshot: '5', entitlement: '250.00', approved: true, paid: false },
  { name: 'Holder C', address: '', units: 2n, snapshot: '2', entitlement: '100.00', approved: true, paid: false },
  { name: 'Holder D', address: '', units: 0n, snapshot: '0', entitlement: '0.00', approved: true, paid: false },
];
const colors = ['#c5edda', '#a2afd4', '#d9c7a3', '#777e79'];
const money = (value: { toString(): string }) => { const n = BigInt(value.toString()); return `${n / 100n}.${(n % 100n).toString().padStart(2, '0')}`; };
const stages = ['scheduled', 'snapshotPending', 'snapshotted', 'awaitingApproval', 'approved', 'funded', 'executing', 'settled', 'finalized'];

export function OverviewPage() {
  const c = useRegistryController();
  const ops=useBondOps();
  const [source] = useState<'preview' | 'chain'>('chain');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('largest');
  const holdersOnly = location.pathname === '/holders';
  const report = source === 'chain' ? c.report : null;
  const rows = source === 'preview' ? preview : report?.rows.map(row => ({...row, entitlement: row.entitlement === null ? '—' : money(row.entitlement)})) || [];
  const supply = rows.reduce((sum, row) => sum + row.units, 0n);
  const filtered = rows.filter(row => `${row.name} ${row.address}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name) : a.units === b.units ? 0 : a.units > b.units ? -1 : 1);
  const stage = source === 'preview' ? 'awaitingApproval' : c.state;
  const stageIndex = stages.indexOf(stage);
  const obligation = source === 'preview' ? '850.00' : report ? money(report.total) : '—';
  const paid = source === 'preview' ? '0.00' : report ? money(report.paid) : '—';
  const actionHref = c.instrument && source === 'chain' ? `/actions?instrument=${encodeURIComponent(c.instrument)}&new=1` : '/actions?new=1';
  const currentActionHref = source === 'chain' && report ? `/protocol?action=${encodeURIComponent(c.action)}` : actionHref;
  let validAction = false;
  try { validAction = new PublicKey(c.action).toBase58() === c.action; } catch { /* Form validation only. */ }
  const share = (units: bigint) => supply > 0n ? Number(units * 1000n / supply) / 10 : 0;
  function exportHolders() {
    const lines = [['Source', 'Holder', 'Address', 'Current units', 'Record date units', 'Entitlement Mock USD'], ...filtered.map(row => [source === 'preview' ? 'Illustrative demo' : 'Chain read', row.name, row.address, row.units.toString(), row.snapshot, row.entitlement])];
    const csv = lines.map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = `recorda-holders-${source}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <main className="asset-dashboard">
    <div className="dashboard-page-heading"><div><span className="dashboard-eyebrow">TOKENIZED DEBT · SERVICING PLATFORM</span><h1>{holdersOnly ? 'Your holder registry.' : 'Every asset. Every right.'}</h1><p>{holdersOnly ? 'Ownership, allocations and record-date rights in one place.' : 'A clear view of your instrument, its investors and what comes next.'}</p></div><a href={actionHref} className="dash-primary">Create action <ArrowUpRight size={16} /></a></div>
    <div className="dashboard-viewbar"><span className="dashboard-source-note"><i />{source === 'preview' ? 'Illustrative scenario · no live transactions' : report ? 'Loaded from configured Solana network' : 'Open a coupon action to load data'}</span></div>
    {source === 'chain' && <section className="dashboard-chain-form"><label>Portfolio coupon<select aria-label="Portfolio coupon" value={c.action} onChange={e=>c.setAction(e.target.value)}><option value="">Select a coupon</option>{ops.data?.actions.filter(a=>a.kind==='coupon').map(a=><option key={a.id} value={a.id}>{a.label} · {a.status}</option>)}</select></label><label>Coupon action address<input value={c.action} onChange={e => {c.setAction(e.target.value.trim()); c.setReport(null);}} placeholder="Paste an Action PDA" /></label><button className="dash-secondary" disabled={!validAction || c.busy} onClick={() => void c.refresh()}><RefreshCw size={14} />{c.busy ? 'Reading…' : 'Read chain'}</button><a href="/actions">Open versioned actions <ArrowUpRight size={13} /></a></section>}
    {source === 'chain' && c.error && <p role="alert" className="dashboard-error">{c.error}</p>}
    {source === 'chain' && c.audit && c.audit.issues.length > 0 && <p role="alert" className="dashboard-error">Independent verification found {c.audit.issues.length} issue(s). Review this action in Coupon servicing before execution.</p>}
    <section className="dashboard-metrics" aria-label="Asset metrics">
      <Metric label="Outstanding units" value={rows.length ? supply.toString() : '—'} detail="Current token ownership" icon={<Layers3 size={17} />} />
      <Metric label="Registered holders" value={rows.length ? String(rows.length) : '—'} detail={`${rows.filter(r => r.units > 0n).length} with an active balance`} icon={<Users size={17} />} />
      <Metric label="Coupon obligation" value={obligation} detail="Mock USD · record-date rights" icon={<CircleDollarSign size={17} />} accent />
      <Metric label="Payments settled" value={paid} detail={report?.receipt ? 'Final receipt available' : 'Explicit approval before execution'} icon={<ShieldCheck size={17} />} />
    </section>
    {!holdersOnly && <div className="dashboard-overview-grid">
      <section className="dashboard-panel instrument-panel"><div className="dash-panel-heading"><span className="dashboard-eyebrow">INSTRUMENT AT A GLANCE</span><span className="dash-tag">{source === 'preview' ? 'Demo bond' : report ? 'Loaded instrument' : 'No instrument loaded'}</span></div><div className="instrument-identity"><span className="instrument-monogram"><Layers3 size={26} strokeWidth={1.3} /></span><div><h2>{source === 'preview' ? 'KZB26' : report ? shortAddress(report.instrumentAddress) : 'Your next instrument'}</h2><p>{source === 'preview' ? 'Tokenized bond · reference scenario' : 'Coupon servicing · Token-2022'}</p></div></div><div className="instrument-terms"><div><span>Face value</span><strong>{source === 'preview' ? '1,000.00' : report ? money(report.instrument.faceValueMinor) : '—'}<small> Mock USD</small></strong></div><div><span>Annual coupon</span><strong>{source === 'preview' ? '10' : report ? report.instrument.couponBps / 100 : '—'}<small> %</small></strong></div><div><span>Frequency</span><strong>{source === 'preview' ? '2' : report?.instrument.paymentsPerYear ?? '—'}<small> / year</small></strong></div></div><div className="instrument-foot"><span><i />{source === 'preview' ? 'Preview · ownership after transfer' : 'Network state · test assets'}</span><a href="/protocol">Manage instrument <ArrowUpRight size={14} /></a></div></section>
      <section className="dashboard-panel lifecycle-panel"><div className="dash-panel-heading"><span className="dashboard-eyebrow">CURRENT CORPORATE ACTION</span><a href={currentActionHref}>Open workspace <ArrowUpRight size={13} /></a></div><div className="lifecycle-title"><h2>Coupon distribution</h2><span className="dash-tag mint-tag">{source === 'chain' && !report ? 'Awaiting action' : stage === 'awaitingApproval' ? 'Ready for approval' : stage.replace(/([A-Z])/g, ' $1')}</span></div><p className="lifecycle-description">Record the ownership. Preserve the right. Execute with proof.</p><ol className="dashboard-lifecycle">{[{label:'Record date', at:2}, {label:'Calculate', at:3}, {label:'Approve', at:4}, {label:'Settle', at:7}, {label:'Receipt', at:8}].map((step,index) => <li key={step.label} className={stageIndex >= step.at ? 'is-done' : stageIndex >= (index ? [2,3,4,7][index-1] : 0) ? 'is-next' : ''}><span>{stageIndex >= step.at ? <Check size={13} /> : String(index+1).padStart(2,'0')}</span><small>{step.label}</small></li>)}</ol><div className="lifecycle-foot"><span><Clock3 size={13} />{source === 'preview' ? 'Snapshot fixed · 17 units at record date' : report ? `${report.expectedHolders} expected holders` : 'Load an action to see progress'}</span><a href={currentActionHref}>Continue <ArrowRight size={14} /></a></div></section>
    </div>}
    <div className="dashboard-registry-grid">
      <section className="dashboard-panel registry-panel"><div className="registry-heading"><div><span className="dashboard-eyebrow">INVESTOR OVERVIEW</span><h2>Holders <span>{rows.length.toString().padStart(2,'0')}</span></h2></div><button className="dash-secondary" onClick={exportHolders} disabled={!rows.length}><ArrowDownToLine size={14} />Export</button></div><div className="registry-toolbar"><label className="dashboard-search"><Search size={15} /><input aria-label="Search holders" placeholder="Search holders or wallet address…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Sort holders" value={sort} onChange={e => setSort(e.target.value)}><option value="largest">Largest holding</option><option value="name">Holder name</option></select></div><div className="registry-table-scroll"><table className="registry-table"><thead><tr><th>Holder</th><th>Current units</th><th>Allocation</th><th>Record date</th><th>Entitlement <small>Mock USD</small></th><th>Status</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.address || row.name}><td><div className="registry-holder"><span style={{'--holder-color':colors[rows.indexOf(row)%colors.length]} as CSSProperties}>{row.name.replace('Holder ','')}</span><div><strong>{row.name}</strong>{row.address ? <a href={`https://explorer.solana.com/address/${row.address}?${connection.rpcEndpoint.includes('devnet') ? 'cluster=devnet' : `cluster=custom&customUrl=${encodeURIComponent(connection.rpcEndpoint)}`}`} target="_blank" rel="noreferrer">{shortAddress(row.address)} <ArrowUpRight size={10} /></a> : <small>Demo identity</small>}</div></div></td><td>{row.units.toString()}</td><td><span className="allocation-cell"><i><b style={{width:`${share(row.units)}%`}} /></i>{share(row.units)}%</span></td><td className="snapshot-cell">{row.snapshot}</td><td>{row.entitlement}</td><td><span className={`holder-status ${row.paid ? 'paid' : ''}`}><i />{row.paid ? 'Processed' : row.approved ? 'Registered' : 'Unapproved'}</span></td></tr>)}</tbody></table></div>{!filtered.length && <div className="dashboard-empty">{c.busy ? 'Reading holder registry…' : query ? 'No holders match your search.' : 'Read an existing coupon action from the selected workspace.'}</div>}<div className="registry-foot"><span>{filtered.length} of {rows.length} holders</span><span><ShieldCheck size={12} /> Rights follow the record date</span></div></section>
      <aside className="dashboard-panel allocation-panel"><span className="dashboard-eyebrow">OWNERSHIP DISTRIBUTION</span><h2>One asset. Many holders.</h2><div className="ownership-donut" role="img" aria-label={supply ? rows.map(r => `${r.name}: ${share(r.units)}%`).join(', ') : 'No ownership data'} style={{background: supply ? `conic-gradient(${rows.map((row,index) => { const before = rows.slice(0,index).reduce((sum,r) => sum+r.units,0n); return `${colors[index%colors.length]} ${Number(before*10000n/supply)/100}% ${Number((before+row.units)*10000n/supply)/100}%`; }).join(',')})` : '#292d2a'}}><div><strong>{supply.toString()}</strong><span>total units</span></div></div><div className="donut-legend">{rows.map((row,index) => <div key={row.address || row.name}><span><i style={{background:colors[index%colors.length]}} />{row.name}</span><strong>{share(row.units)}%</strong></div>)}</div><div className="allocation-note"><ShieldCheck size={16} /><p>Ownership can change.<br /><strong>Recorded rights stay fixed.</strong></p></div></aside>
    </div>
    {!holdersOnly && <section className="dashboard-next"><div><span className="dashboard-eyebrow">THE COMPLETE LIFECYCLE</span><h2>Keep the next chapter in view.</h2></div>{[{kind:'coupon',title:'Coupon',text:'Distribute record-date payments',icon:CircleDollarSign},{kind:'voting',title:'Voting',text:'Capture a holder decision',icon:Users},{kind:'redemption',title:'Redemption',text:'Retire units and settle principal',icon:Layers3}].map(({kind,title,text,icon:Icon}) => <a key={kind} href={`${actionHref}${actionHref.includes('?') ? '&' : '?'}kind=${kind}`}><Icon size={19} strokeWidth={1.5} /><div><strong>{title}</strong><small>{text}</small></div><ArrowUpRight size={16} /></a>)}</section>}
  </main>;
}
function Metric({label,value,detail,icon,accent=false}: {label:string;value:string;detail:string;icon:ReactNode;accent?:boolean}) { return <article className={`dashboard-metric ${accent ? 'metric-accent' : ''}`}><div><span>{label}</span>{icon}</div><strong>{value}</strong><small>{detail}</small></article>; }
