import type { ReactNode } from "react";
import { ArrowUpRight, Layers3, MoveUpRight } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return <a className={`recorda-brand ${light ? 'brand-light' : ''}`} href="/" aria-label="Recorda home"><span className="brand-mark"><Layers3 size={22} strokeWidth={1.7} /></span>recorda<span className="brand-dot">.</span></a>;
}

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = location.pathname;
  return <div className="product-shell">
    <a className="skip-link" href="#product-content">Skip to content</a>
    <header className="product-nav"><Brand /><nav aria-label="Product navigation">
      {[['/protocol', 'Instrument setup'], ['/actions', 'Corporate actions'], ['/claims', 'Holder claims']].map(([href, label]) => <a key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</a>)}
    </nav><a className="nav-story" href="/">The idea <ArrowUpRight size={14} /></a></header>
    <div id="product-content" tabIndex={-1}>{children}</div>
    <footer className="product-footer"><span>Recorda · Rights, carried forward.</span><span>Solana prototype · Test assets only <MoveUpRight size={13} /></span></footer>
  </div>;
}
