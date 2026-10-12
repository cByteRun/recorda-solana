import { useEffect, useRef, useState } from 'react';
import { Check, Copy, LogIn, LogOut, Moon, Palette, ShieldCheck, Sun, UserRound, X } from 'lucide-react';
import { useBondOps } from '@/features/bondops/model/bondops-context';
import { ROLE_LABELS } from '@/features/bondops/model/rbac';
import { PALETTES, usePreferences } from '@/shared/preferences/workspace-preferences';
export type ProfileTab='account'|'appearance';
export function WorkspaceProfile({tab,onClose}:{tab:ProfileTab;onClose():void}){
 const ops=useBondOps(),prefs=usePreferences(),{t}=prefs;
 const [selected,setSelected]=useState(tab),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current!;if(!node.open)node.showModal();},[]);
 const member=ops.session?.member;
 async function copy(){try{await navigator.clipboard.writeText(member!.wallet!);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}
 return <dialog ref={dialog} className="workspace-profile-dialog" onKeyDown={e=>{if(e.key!=='Tab')return;const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled), textarea:not(:disabled)')).filter(n=>n.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}} aria-labelledby="profile-title" onClose={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();}}}>
  <header className="profile-heading"><div><p className="eyebrow">RECORDA / {t('Profile')}</p><h2 id="profile-title">{t(selected==='account'?'Account':'Appearance')}</h2></div><button autoFocus className="ico-btn" aria-label={t('Close profile')} onClick={()=>dialog.current?.close()}><X/></button></header>
  <div className="profile-tabs" aria-label={t('Profile')}><button className={selected==='account'?'selected':''} aria-pressed={selected==='account'} onClick={()=>setSelected('account')}><UserRound size={16}/>{t('Account')}</button><button className={selected==='appearance'?'selected':''} aria-pressed={selected==='appearance'} onClick={()=>setSelected('appearance')}><Palette size={16}/>{t('Appearance')}</button></div>
  {selected==='account'?<section className="profile-account">
   <div className="profile-identity"><span className="profile-avatar"><UserRound/></span><div><h3>{t(member?.name??'Sign in')}</h3><p>{member?t(ROLE_LABELS[member.role]):t('Choose role')}</p></div></div>
   <dl className="profile-facts"><div><dt>{t('Workspace')}</dt><dd>{t(ops.workspace==='demo'?'Demo Workspace':ops.workspace==='test'?'Test Workspace · Localnet':'Devnet Workspace')}</dd></div><div><dt>{t('Access')}</dt><dd>{ops.source==='demo'?t('Demo data'):!member?t('Sign in'):member.wallet?'Phantom':t('Public read-only access')}</dd></div></dl>
   {member?.wallet&&<div className="profile-wallet"><span>{t('Wallet address')}</span><code>{member.wallet}</code><button className="btn" onClick={()=>void copy()}>{copied?<Check size={15}/>:<Copy size={15}/>} {t(copied?'Copied':'Copy address')}</button>{copyError&&<p role="status">{prefs.language==='ru'?'Выделите адрес и скопируйте вручную.':'Select the address and copy it manually.'}</p>}</div>}
   {ops.readOnly&&<p className="notice info"><ShieldCheck/><span>{t(ops.source==='demo'?'Demo data':'Public read-only access')}</span></p>}
   <div className="profile-language"><label htmlFor="profile-language">{t('Language')}</label><select id="profile-language" value={prefs.language} onChange={e=>prefs.setLanguage(e.target.value as 'en'|'ru')}><option value="en">English · EN</option><option value="ru">Русский · RU</option></select></div>
   {member?<button className="btn profile-signout" disabled={ops.busy} onClick={()=>{void ops.logout();onClose();}}><LogOut size={17}/>{t('Sign out')}</button>:<a className="btn primary" href="/login" onClick={onClose}><LogIn size={17}/>{t('Sign in')}</a>}
  </section>:<section className="profile-appearance">
   <div className="theme-options">{(['light','dark'] as const).map(theme=><button key={theme} aria-pressed={prefs.theme===theme} className={prefs.theme===theme?'selected':''} onClick={()=>prefs.setTheme(theme)}>{theme==='light'?<Sun/>:<Moon/>}{t(theme==='light'?'Light':'Dark')}</button>)}</div>
   <div className="palette-heading"><h3>{t('Color palette')}</h3><span>20</span></div>
   <div className="palette-grid">{PALETTES.map(p=><button key={p.name} className={prefs.palette===p.name?'selected':''} aria-pressed={prefs.palette===p.name} aria-label={`${p.name} ${p.hex}`} onClick={()=>prefs.setPalette(p.name)}><span className="palette-swatch" style={{background:p.hex}}/><span><strong>{p.name}</strong><code>{p.hex}</code></span>{prefs.palette===p.name&&<Check size={15}/>}</button>)}</div>
  </section>}
 </dialog>;
}
