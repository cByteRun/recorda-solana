import { useState, type ReactNode } from "react";
import { ArrowUpRight, Layers3, LayoutGrid, Users, ListChecks, Wallet, Plus, PanelLeft, ArrowLeft, ShieldCheck } from "lucide-react";
import { RecordaMark } from "@/pages/welcome/ui/recorda-mark";
import "@/app/styles/dashboard.css";

export function Brand({ light = false }: { light?: boolean }) {
  return <a className={`recorda-brand ${light ? 'brand-light' : ''}`} href="/" aria-label="Recorda home"><span className="brand-mark"><Layers3 size={22} strokeWidth={1.7} /></span>recorda<span className="brand-dot">.</span></a>;
}

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = location.pathname;
  const [pinned, setPinned] = useState(false);
  const links = [
    { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
    { href: '/protocol', label: 'Instrument setup', icon: Layers3 },
    { href: '/holders', label: 'Holders', icon: Users },
    { href: '/actions', label: 'Corporate actions', icon: ListChecks },
    { href: '/claims', label: 'Holder claims', icon: Wallet },
  ];
  const current = links.find(link => link.href === pathname)?.label || 'Workspace';
  return <div className="product-shell">
    <a className="skip-link" href="#product-content">Skip to content</a>
    <aside className={`dashboard-rail ${pinned ? 'rail-pinned' : ''}`} aria-label="Workspace sidebar">
      <a className="rail-brand" href="/" aria-label="Recorda home"><span className="rail-logo"><RecordaMark /></span><span className="rail-label">recorda<span className="mint-dot">.</span></span></a>
      <a className="rail-create" href="/actions" aria-label="Create corporate action"><Plus size={19} /><span className="rail-label">Create action</span></a>
      <span className="rail-section rail-label">WORKSPACE</span>
      <nav aria-label="Product navigation">{links.map(({href, label, icon: Icon}) => <a key={href} href={href} aria-label={label} title={label} aria-current={pathname === href ? 'page' : undefined}><Icon size={19} strokeWidth={1.6} /><span className="rail-label">{label}</span>{pathname === href && <span className="rail-active-dot" />}</a>)}</nav>
      <div className="rail-bottom"><button onClick={() => setPinned(value => !value)} aria-label={pinned ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={pinned}><PanelLeft size={19} /><span className="rail-label">{pinned ? 'Collapse menu' : 'Keep menu open'}</span></button><a href="/" aria-label="Back to welcome"><ArrowLeft size={19} /><span className="rail-label">Back to welcome</span></a><div className="rail-profile"><span>R</span><div className="rail-label">Recorda workspace<small>Asset servicing</small></div></div></div>
    </aside>
    <div className="dashboard-body">
      <header className="dashboard-topbar"><div className="dashboard-breadcrumb">Workspace <span>/</span> <strong>{current}</strong></div><div className="dashboard-top-actions"><span className="dashboard-network"><i /> Test environment</span><a href="/" className="dashboard-about">The idea <ArrowUpRight size={13} /></a><span className="dashboard-avatar" title="Recorda workspace">R</span></div></header>
      <div id="product-content" tabIndex={-1}>{children}</div>
      <footer className="product-footer"><span>Recorda · Rights, carried forward.</span><span><ShieldCheck size={12} /> Test assets only · Solana</span></footer>
    </div>
  </div>;
}
