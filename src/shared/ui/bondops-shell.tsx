import { useEffect, useState, type ReactNode } from 'react';
import { LayoutDashboard, Landmark, Workflow, UsersRound, ArrowLeftRight, ShieldCheck, Network, Settings2, Palette, UserRound, ChevronRight, CalendarDays, Bell, Vote, FileText, Receipt, TriangleAlert, WalletCards, Menu, X } from 'lucide-react';
import '@/app/styles/bondops.css';
import { PreferencesProvider, usePreferences } from '@/shared/preferences/workspace-preferences';
import { WorkspaceProfile, type ProfileTab } from './workspace-profile';
import { WORKSPACE_LABELS, type WorkspaceMode } from '@/shared/solana/workspaces';
import { BondOpsProvider, useBondOps } from '@/features/bondops/model/bondops-context';
import { useSignInGuard } from '@/features/bondops/model/use-sign-in-guard';
import { ROLE_LABELS, canVisit } from '@/features/bondops/model/rbac';
const operatorPrimary = [
  {href:'/dashboard',label:'Overview',icon:LayoutDashboard},
  {href:'/bonds',label:'Bonds',icon:Landmark},
  {href:'/actions',label:'Corporate actions',icon:Workflow},
  {href:'/holders',label:'Holder registry',icon:UsersRound},
  {href:'/settlements',label:'Settlements',icon:ArrowLeftRight},
  {href:'/calendar',label:'Deadline calendar',icon:CalendarDays},
  {href:'/claims',label:'Holder claims',icon:WalletCards},
];
const operatorSecondary = [{href:'/notifications',label:'Notifications',icon:Bell},{href:'/audit',label:'Audit & proof',icon:ShieldCheck},{href:'/infrastructure',label:'Infrastructure',icon:Network},{href:'/settings',label:'Settings',icon:Settings2}];
export function BondOpsShell({children}:{children:ReactNode}) { return <PreferencesProvider><BondOpsProvider><ShellContent>{children}</ShellContent></BondOpsProvider></PreferencesProvider>; }
function ShellContent({children}:{children:ReactNode}) {
 const ops=useBondOps();
 const {blocked,loginHref}=useSignInGuard();
 const role=ops.session?.member?.role??(ops.source==='demo'?'operator':'auditor');
 const primary=role==='investor'?[{href:'/dashboard',label:'My overview',icon:LayoutDashboard},{href:'/holdings',label:'My holdings',icon:Landmark},{href:'/entitlements',label:'My entitlements',icon:FileText},{href:'/voting',label:'Voting',icon:Vote},{href:'/history',label:'Payment history',icon:Receipt}]:role==='auditor'?[{href:'/dashboard',label:'Audit overview',icon:LayoutDashboard},{href:'/proofs',label:'Proof explorer',icon:ShieldCheck},{href:'/exceptions',label:'Exceptions',icon:TriangleAlert},{href:'/register',label:'Action register',icon:Workflow},{href:'/audit',label:'Event trail',icon:Receipt},{href:'/reports',label:'Proof reports',icon:FileText}]:operatorPrimary;
 const secondary=operatorSecondary.filter(n=>canVisit(role,n.href)&&!primary.some(p=>p.href===n.href));
 const prefs=usePreferences(),{t}=prefs;
 const [profile,setProfile]=useState<ProfileTab|null>(null);
 const [menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>setMenuOpen(false),[location.pathname]);
 const current=[...primary,...secondary].find(n=>n.href===location.pathname)?.label ?? 'Instrument workspace';
 return <div className="bondops" data-theme={prefs.theme} data-language={prefs.language} style={prefs.style}><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"/><a className="skip-link" href="#product-content">{t("Skip to content")}</a><div className="app-shell">
 <aside className="rail" aria-label={t("Quick navigation")}><a href="/" className="brand-mark" aria-label={t("Back to welcome")}>R</a>{[...primary,...secondary].map(({href,label,icon:Icon})=><a key={href} href={loginHref(href)} title={t(label)} aria-label={t(label)} className={`rail-ico ${location.pathname===href?'active':''}`} aria-current={location.pathname===href?'page':undefined}><Icon/><span className="rail-label">{t(label)}</span></a>)}<div className="rail-grow"/><button className="rail-profile" aria-label={t('Open profile')} title={t('Profile')} onClick={()=>setProfile('account')}><UserRound size={19}/></button></aside>
 <aside className="sidebar"><div className="sidebar-brand"><a href="/" className="brand-mark" aria-label={t("Back to welcome")}>R</a><span>Recorda</span></div><div className="workspace-title"><div className="micro muted">{prefs.language==='ru'?'Рабочий кабинет':'Enterprise workspace'}</div><h3>{!ops.session?.member&&ops.source==='live'?'Recorda workspace':role==='investor'?t('My investments'):role==='auditor'?t('Verification'):t('Operations')} <span style={{color:'var(--brand)'}}>↗</span></h3><div className="tiny muted">Recorda / {t(WORKSPACE_LABELS[ops.workspace])}</div></div><nav className="sidebar-navigation" aria-label={t("All workspace pages")}>{[primary,secondary].map((group,i)=><div className="side-group" key={i}><div className="side-title">{t(i?'Control & infrastructure':role==='investor'?'My investments':role==='auditor'?'Verification':'Operations')}</div>{group.map(({href,label,icon:Icon})=><a key={href} href={loginHref(href)} className={`nav-item ${location.pathname===href?'active':''}`} aria-current={location.pathname===href?'page':undefined}><Icon/><span>{t(label)}</span>{href==='/settlements'&&<span className="nav-count">{ops.data?.cases.filter(c=>c.status!=='resolved').length??'—'}</span>}</a>)}</div>)}</nav><div className="sidebar-footer"><span className="tiny muted">{t('Workspace')}</span><strong>{t(ops.workspace==='demo'?'Demo Workspace':ops.workspace==='test'?'Localnet Workspace':'Devnet Workspace')}</strong><span className="tiny muted">{ops.source==='demo'?t('Demo data'):ops.rpcNetwork==='local'?t('Local RPC'):'Devnet RPC'}</span><button className="sidebar-profile" aria-label={t('Open profile')} onClick={()=>setProfile('account')}><span className="profile-trigger-avatar"><UserRound size={18}/></span><span><strong>{ops.session?.member?t(ops.session.member.name):t('Profile')}</strong><small>{ops.session?.member?t(ROLE_LABELS[role]):t('Sign in')}</small></span><ChevronRight size={16}/></button></div></aside>
 <div className="main"><header className="topbar"><div className="crumbs">Recorda <ChevronRight size={14}/><b>{t(current)}</b></div><div className="top-actions">
 <select className="role-select" aria-label={t('Workspace')} disabled={ops.busy} value={ops.workspace} onChange={e=>ops.changeWorkspace(e.target.value as WorkspaceMode)}><option value="demo">{t('Demo Workspace')}</option><option value="test">{t('Localnet Workspace')}</option><option value="devnet">{t('Devnet Workspace')}</option></select>
 <button className="ico-btn" aria-label={t('Appearance')} title={t('Appearance')} onClick={()=>setProfile('appearance')}><Palette/></button>
 <select className="language-select" aria-label={t('Language')} value={prefs.language} onChange={e=>prefs.setLanguage(e.target.value as 'en'|'ru')}><option value="en">EN</option><option value="ru">RU</option></select>
 {ops.session?.member?<button className="profile-trigger" aria-label={t('Open profile')} onClick={()=>setProfile('account')}><span className="profile-trigger-avatar"><UserRound size={16}/></span><span><strong>{t(ops.session.member.name)}</strong><small>{" · "}{t(ROLE_LABELS[role])}</small></span></button>:<a className="pill" href="/login">{t(ops.source==='demo'?'Choose role':'Sign in')}</a>}
 <button className="ico-btn compact-menu-button" aria-label={t(menuOpen?'Close navigation':'Open navigation')} aria-controls="compact-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X/>:<Menu/>}</button>
 </div></header>{menuOpen&&<nav className="compact-navigation" id="compact-navigation" aria-label={t("All workspace pages")}>{[...primary,...secondary].map(({href,label,icon:Icon})=><a className="nav-item" key={href} href={loginHref(href)} aria-current={location.pathname===href?'page':undefined}><Icon/>{t(label)}</a>)}</nav>}<div id="product-content" tabIndex={-1}>{blocked?<main className="content"><p role="status">{t("Opening sign-in…")}</p></main>:ops.session?.member&&!canVisit(role,location.pathname)?<main className="content"><section className="card pad"><h1 className="page-title">{t("Your role workspace")}</h1><p className="page-sub">{prefs.language==='ru'?'Этот раздел недоступен для роли':'This section is unavailable for'} {t(ROLE_LABELS[role])}.</p><a className="btn primary" href="/dashboard">{t("Open my dashboard")}</a></section></main>:children}</div></div>
 {profile&&<WorkspaceProfile tab={profile} onClose={()=>setProfile(null)}/> }
 </div></div>;
}
