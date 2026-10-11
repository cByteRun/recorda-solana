import { useState, type ReactNode } from 'react';
import { LayoutDashboard, Landmark, Workflow, UsersRound, ArrowLeftRight, ShieldCheck, Network, Settings2, Moon, Sun, Sparkles, ChevronRight } from 'lucide-react';
import '@/app/styles/bondops.css';
const primary = [
  {href:'/dashboard',label:'Overview',icon:LayoutDashboard},
  {href:'/bonds',label:'Bonds',icon:Landmark},
  {href:'/actions',label:'Corporate actions',icon:Workflow},
  {href:'/holders',label:'Holder registry',icon:UsersRound},
  {href:'/settlements',label:'Settlements',icon:ArrowLeftRight},
];
const secondary = [{href:'/audit',label:'Audit & proof',icon:ShieldCheck},{href:'/infrastructure',label:'Infrastructure',icon:Network},{href:'/settings',label:'Settings',icon:Settings2}];
export function BondOpsShell({children}:{children:ReactNode}) {
 const [dark,setDark]=useState(false);
 const current=[...primary,...secondary].find(n=>n.href===location.pathname)?.label ?? 'Instrument workspace';
 return <div className="bondops" data-theme={dark?'dark':'light'}><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"/><a className="skip-link" href="#product-content">Skip to content</a><div className="app-shell">
 <aside className="rail" aria-label="Quick navigation"><a href="/" className="brand-mark" aria-label="Back to welcome">R</a>{[...primary,...secondary].map(({href,label,icon:Icon})=><a key={href} href={href} title={label} aria-label={label} className={`rail-ico ${location.pathname===href?'active':''} ${secondary.some(n=>n.href===href)?'hide-on-mobile':''}`}><Icon/></a>)}<div className="rail-grow"/><span className="rail-profile" style={{display:'grid',placeItems:'center'}} title="Operator workspace">O</span></aside>
 <aside className="sidebar"><div className="workspace-title"><div className="micro muted">Enterprise workspace</div><h3>Bond operations <span style={{color:'var(--brand)'}}>↗</span></h3><div className="tiny muted">Recorda / Test environment</div></div>{[primary,secondary].map((group,i)=><div className="side-group" key={i}><div className="side-title">{i?'CONTROL & INFRASTRUCTURE':'WORKSPACE'}</div>{group.map(({href,label,icon:Icon})=><a key={href} href={href} className={`nav-item ${location.pathname===href?'active':''}`} aria-current={location.pathname===href?'page':undefined}><Icon/><span>{label}</span>{href==='/settlements'&&<span className="nav-count">Demo</span>}</a>)}</div>)}<div className="sidebar-footer"><div style={{fontWeight:800,fontSize:12}}><span className="pulse"/>Test workspace</div><div className="tiny muted" style={{lineHeight:1.5}}>Обзор — демонстрационный сценарий. Рабочие операции доступны в Corporate actions с подписью оператора.</div><a className="inline-link" href="/infrastructure">View architecture ↗</a></div></aside>
 <div className="main"><header className="topbar"><div className="crumbs">Recorda <ChevronRight size={14}/><b>{current}</b></div><div className="top-actions"><span className="pill demo hide-mobile">● TEST ENVIRONMENT</span><span className="pill">Operator</span><button className="ico-btn" aria-label="Toggle theme" onClick={()=>setDark(v=>!v)}>{dark?<Sun/>:<Moon/>}</button><a className="ico-btn hide-mobile" href="/" aria-label="Welcome"><Sparkles/></a></div></header><div id="product-content" tabIndex={-1}>{children}</div></div>
 </div></div>;
}
