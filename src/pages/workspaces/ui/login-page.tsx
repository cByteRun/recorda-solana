import { useEffect, useState } from 'react';
import { ArrowRight, Check, Database, LayoutDashboard, ShieldCheck, Wallet } from 'lucide-react';
import { useBondOps } from '@/features/bondops/model/bondops-context';
import { canVisit, PERSONAS, ROLE_LABELS, type Role } from '@/features/bondops/model/rbac';

export function LoginPage() {
  const ops=useBondOps(),[role,setRole]=useState<Role>('operator'),[released,setReleased]=useState(0),[opening,setOpening]=useState(false);
  const idle=!opening&&!ops.session?.member;
  const waiting=ops.busy||ops.connecting||(!idle&&ops.loading);
  useEffect(()=>{
    setReleased(0);
    if(waiting)return;
    const timers=[1,2,3,4,5].map((n)=>setTimeout(()=>setReleased(n),180+n*90));
    return()=>timers.forEach(clearTimeout);
  },[waiting]);
  useEffect(()=>{
    if(!opening||waiting||released<5)return;
    if(ops.error||!ops.data||!ops.session?.member){setOpening(false);return;}
    const next=new URLSearchParams(location.search).get('next');
    const target=next?.startsWith('/')&&!next.startsWith('//')?new URL(next,location.origin):null;
    const destination=target&&target.origin===location.origin&&target.pathname!=='/login'&&canVisit(ops.session.member.role,target.pathname)?target.pathname+target.search:'/dashboard';
    history.pushState(null,'',destination);window.dispatchEvent(new PopStateEvent('popstate'));
  },[opening,waiting,released,ops.error,ops.data,ops.session?.member]);
  async function enter(persona?:string){setOpening(true);await ops.signIn(persona,false);}
  const phase=idle&&!ops.connecting?'idle':ops.error&&!waiting?'error':ops.connecting||!ops.session?'identity':ops.loading?'data':waiting||released<5?'layout':'ready';
  const status=phase==='idle'?'Ожидаем входа':phase==='error'?'Не удалось загрузить кабинет':phase==='identity'?'Проверяем подключение':phase==='data'?'Загружаем операционные данные':phase==='layout'?'Подготавливаем ваш дашборд':'Кабинет готов';
  const detail=phase==='idle'?(ops.source==='demo'?'Выберите роль и откройте демонстрационный кабинет.':'Подключите Phantom для входа участником или откройте публичный аудит без кошелька.'):phase==='error'?'Повторите загрузку данных или проверьте подключение.':phase==='identity'?'Определяем доступ и выбранное окружение.':phase==='data'?(ops.source==='demo'?'Читаем данные демонстрационного портфеля.':'Читаем выпуски, позиции и права из выбранного RPC.'):phase==='layout'?'Готовим навигацию и разделы для вашей роли.':ops.session?.member?`${ops.session.member.name} · ${ROLE_LABELS[ops.session.member.role]}`:'Выберите роль или подключите Phantom для входа.';
  return <main className="content login-content"><div className="page-head"><div><p className="eyebrow">RECORDA / WORKSPACE ACCESS</p><h1 className="page-title">Your workspace. Your role.</h1><p className="page-sub">{ops.source==='demo'?'Выберите кабинет для просмотра заполненного примера.':'Подключите Phantom: кабинет определяется публичным адресом вашего кошелька.'}</p></div></div>
    {ops.error&&<p className="notice" role="alert">{ops.error}</p>}
    <section className={`login-progress ${phase}`} aria-busy={!idle&&(waiting||released<5)}>
      <div className="login-orbit" aria-hidden="true"><span/><span/><LayoutDashboard/></div>
      <div className="login-progress-copy"><p className="eyebrow">WORKSPACE / {ops.workspace.toUpperCase()}</p><h2 role="status" aria-live="polite">{status}</h2><p>{detail}</p>
        <ol className="login-stages">{[{label:'Доступ',icon:ShieldCheck,done:!!ops.session?.member&&!ops.connecting,active:phase==='identity'},{label:'Данные',icon:Database,done:!idle&&!!ops.data&&!ops.loading,active:phase==='data'},{label:'Дашборд',icon:LayoutDashboard,done:phase==='ready',active:phase==='layout'}].map(({label,icon:Icon,done,active})=><li key={label} className={done?'done':active?'active':''}>{done?<Check size={14}/>:<Icon size={14}/>}<span>{label}</span></li>)}</ol>
      </div>
      {phase==='error'&&<button className="btn" disabled={ops.busy} onClick={()=>void ops.reload()}>Повторить загрузку</button>}
    </section>
    <div className="login-roles">{(['operator','investor','auditor','reviewer'] as Role[]).map((r,index)=><button key={r} className={`login-role ${role===r?'selected':''}`} disabled={ops.source!=='demo'||waiting||released<=index} aria-pressed={role===r} onClick={()=>setRole(r)}><ShieldCheck/><strong>{ROLE_LABELS[r]}</strong><span>{PERSONAS.find(p=>p.role===r)?.description}</span></button>)}</div>
    <section className="card pad login-connect"><h2 className="card-heading">{ops.source==='demo'?`${ROLE_LABELS[role]} workspace`:ops.session?.member?`${ROLE_LABELS[ops.session.member.role]} workspace`:'Phantom sign in'}</h2><p className="page-sub">{ops.source==='demo'?'Иллюстративные данные доступны без кошелька. Выбор сохраняется только в текущей вкладке.':'Роль определяется адресом Phantom автоматически. Выбор карточек доступен только в Demo Workspace.'}</p>
      <div className="head-buttons" style={{marginTop:20}}>{ops.source==='demo'?PERSONAS.filter(p=>p.role===role).map(p=><button key={p.id} className="btn primary" disabled={waiting||released<5} onClick={()=>void enter(p.id)}>Open {p.name}<ArrowRight/></button>):<button className="btn primary" disabled={waiting||released<5} onClick={()=>void enter()}><Wallet/>{ops.connecting?'Connecting…':ops.session?.member?'Open my dashboard':'Connect Phantom & identify me'}</button>}</div>
      {ops.source==='live'&&<div className="head-buttons" style={{marginTop:16}}><button className="btn" disabled={waiting||released<5} onClick={()=>{setOpening(true);void ops.enterAudit();}}><ShieldCheck/>Открыть аудит без кошелька<ArrowRight/></button><p className="card-desc">Публичные данные и доказательства. Только чтение, без подписей и операций с кошельком.</p></div>}
      {ops.session?.member&&<p className="page-sub">Current identity: {ops.session.member.name} · {ROLE_LABELS[ops.session.member.role]} <span className="id-text">{ops.session.member.wallet}</span></p>}
    </section></main>;
}
