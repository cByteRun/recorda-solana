import { useState } from 'react';
import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react';
import { useBondOps } from '@/features/bondops/model/bondops-context';
import { PERSONAS, ROLE_LABELS, type Role } from '@/features/bondops/model/rbac';

export function LoginPage() {
  const ops=useBondOps(),[role,setRole]=useState<Role>('operator');
  return <main className="content login-content"><div className="page-head"><div><p className="eyebrow">RECORDA / WORKSPACE ACCESS</p><h1 className="page-title">Your workspace. Your role.</h1><p className="page-sub">{ops.source==='demo'?'Выберите кабинет для просмотра заполненного примера.':'Подключите Phantom: кабинет определяется публичным адресом вашего кошелька.'}</p></div></div>
    {ops.error&&<p className="notice" role="alert">{ops.error}</p>}
    <div className="login-roles">{(['operator','investor','auditor','reviewer'] as Role[]).map(r=><button key={r} className={`login-role ${role===r?'selected':''}`} aria-pressed={role===r} onClick={()=>setRole(r)}><ShieldCheck/><strong>{ROLE_LABELS[r]}</strong><span>{PERSONAS.find(p=>p.role===r)?.description}</span></button>)}</div>
    <section className="card pad login-connect"><h2 className="card-heading">{ROLE_LABELS[role]} workspace</h2><p className="page-sub">{ops.source==='demo'?'Иллюстративные данные доступны без кошелька. Выбор сохраняется только в текущей вкладке.':'Выбор карточки объясняет роль. Доступ выдаётся по совпадению адреса Phantom с конфигурацией или участником on-chain workspace.'}</p>
      <div className="head-buttons" style={{marginTop:20}}>{ops.source==='demo'?PERSONAS.filter(p=>p.role===role).map(p=><button key={p.id} className="btn primary" disabled={ops.busy} onClick={()=>void ops.signIn(p.id,true)}>Open {p.name}<ArrowRight/></button>):<button className="btn primary" disabled={ops.busy||ops.connecting} onClick={()=>void ops.signIn(undefined,true)}><Wallet/>{ops.connecting?'Connecting…':ops.session?.member?'Open my dashboard':'Connect Phantom & identify me'}</button>}</div>
      {ops.session?.member&&<p className="page-sub">Current identity: {ops.session.member.name} · {ROLE_LABELS[ops.session.member.role]} <span className="id-text">{ops.session.member.wallet}</span></p>}
    </section></main>;
}
