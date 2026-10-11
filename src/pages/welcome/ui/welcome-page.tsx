import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, LockKeyhole, Pause, Play, RotateCcw } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { RecordaMark } from "./recorda-mark";
import "./welcome.css";

gsap.registerPlugin(useGSAP);

const copy = {
  en: {
    first: 'Ownership changes.', roles: ['Operator', 'Investor', 'Auditor'],
    start: 'Get started', story: 'See the idea', note: 'For bond operators, issuers & paying agents', tag: 'INTERACTIVE EXAMPLE · NOT A LIVE TRANSACTION',
    stages: ['Capture the right', 'Change the ownership', 'Keep the promise'], holder: 'Investor A', current: 'Bonds held now', snapshot: 'Bonds at record date', right: 'Coupon entitlement',
    captions: ['10 bonds are held at the cutoff. The right is fixed.', '4 bonds move to Investor B. Current ownership changes.', 'The coupon stays at 500. A transfer cannot rewrite the right.'],
    formula: '10 bonds × 1,000 × 10% ÷ 2', locked: 'Fixed at record date', transfer: '4 bonds → Investor B', payment: 'Mock USD', replay: 'Replay', pause: 'Pause story', play: 'Play story',
    roleTitles: ['Who gets what — and why?', 'What am I entitled to?', 'Can I verify the outcome?'],
    roleTexts: ['Review the obligation, approve execution and follow progress. Continue unfinished work without paying twice.', 'See current holdings beside fixed record-date rights. Sign a vote or redemption when your authorization is needed.', 'Follow the calculation through to its receipt. Read on-chain evidence and export the audit without connecting a wallet.'],
  },
  ru: {
    first: 'Владение меняется.', roles: ['Оператор', 'Инвестор', 'Аудитор'],
    start: 'Начать', story: 'Понять идею', note: 'Для операторов, эмитентов и платёжных агентов', tag: 'ИНТЕРАКТИВНЫЙ ПРИМЕР · НЕ ЖИВАЯ ТРАНЗАКЦИЯ',
    stages: ['Зафиксировать право', 'Изменить владение', 'Сохранить обязательство'], holder: 'Инвестор A', current: 'Облигаций сейчас', snapshot: 'На дату фиксации', right: 'Право на купон',
    captions: ['На дату фиксации — 10 облигаций. Право закреплено.', '4 облигации переходят инвестору B. Владение меняется.', 'Купон остаётся 500. Перевод не переписывает право.'],
    formula: '10 облигаций × 1 000 × 10% ÷ 2', locked: 'Право зафиксировано', transfer: '4 облигации → Инвестор B', payment: 'Mock USD', replay: 'Повторить', pause: 'Остановить историю', play: 'Продолжить историю',
    roleTitles: ['Кому, сколько и почему?', 'На что я имею право?', 'Можно ли проверить результат?'],
    roleTexts: ['Проверьте обязательства, одобрите исполнение и следите за прогрессом. Продолжайте незавершённые операции без повторных выплат.', 'Сравните текущие позиции с правами на дату фиксации. Подпишите голос или погашение, когда нужно ваше разрешение.', 'Проследите путь от расчёта до итоговой записи. Проверьте данные в сети и выгрузите аудит без подключения кошелька.'],
  },
};

export function WelcomePage() {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const [language, setLanguage] = useState<'en' | 'ru'>('en');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [role, setRole] = useState(0);
  const t = copy[language];
  const ru = language === 'ru';
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setMotionAllowed(!preference.matches); setPlaying(!preference.matches); };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!playing || !motionAllowed) return;
    const timer = window.setInterval(() => { if (!document.hidden) setStep(value => (value + 1) % 3); }, 5500);
    return () => window.clearInterval(timer);
  }, [playing, motionAllowed]);
  useGSAP(() => {
    if (!motionAllowed) return;
    gsap.from('.wm-enter', { y: 18, opacity: 0, stagger: .09, duration: .85, ease: 'power3.out' });
    gsap.from('.welcome-wordmark .record-fold', { x: -9, opacity: 0, stagger: .12, duration: .8, ease: 'power3.out' });
  }, { scope: root, dependencies: [motionAllowed], revertOnUpdate: true });
  useGSAP(() => {
    const duration = motionAllowed ? .85 : 0;
    const tl = gsap.timeline({ defaults: { duration, ease: 'power3.inOut' } });
    timeline.current = tl;
    tl.to('.bond-moving', { x: step > 0 ? 132 : 0, y: step > 0 ? 62 : 0, opacity: step > 0 ? .45 : 1, stagger: motionAllowed ? .065 : 0 }, 0)
      .to('.record-path', { strokeDashoffset: step === 0 ? 460 : 0, duration: motionAllowed ? 1.2 : 0 }, 0)
      .to('.right-certificate', { y: step === 2 ? -8 : 0, boxShadow: step === 2 ? '0 20px 60px #bcf58422' : '0 20px 60px #00000030' }, 0)
      .fromTo('.stage-caption', { opacity: motionAllowed ? 0 : 1, y: motionAllowed ? 8 : 0 }, { opacity: 1, y: 0 }, 0)
      .to('.record-core .record-fold', { x: step === 2 ? 0 : 3, opacity: step === 2 ? 1 : .65, stagger: motionAllowed ? .1 : 0 }, 0);
    return () => { timeline.current = null; };
  }, { scope: root, dependencies: [step, motionAllowed], revertOnUpdate: true });
  function selectStep(value: number) { setStep(value); setPlaying(false); }
  return <div ref={root} className="welcome welcome-motion" lang={language} data-motion={playing ? 'playing' : 'paused'}>
    <a className="skip-link" href="#welcome-content">{ru ? 'К содержимому' : 'Skip to content'}</a>
    <div className="welcome-window">
      <header className="wm-header">
        <a href="/" className="welcome-wordmark" aria-label="Recorda home"><RecordaMark />recorda<span className="wm-brand-period">.</span></a>
        <span className="wm-edition">CORPORATE ACTIONS / REIMAGINED</span>
        <button className="wm-language" onClick={() => setLanguage(ru ? 'en' : 'ru')} aria-label={ru ? 'Switch to English' : 'Switch to Russian'}><span className={!ru ? 'selected' : ''}>EN</span><span className={ru ? 'selected' : ''}>RU</span></button>
      </header>
      <main id="welcome-content" className="wm-main" tabIndex={-1}>
        <div className="wm-copy">
          <div className="wm-eyebrow wm-enter"><span /> {ru ? 'РЕАЛЬНЫЕ АКТИВЫ. НЕИЗМЕННЫЕ ПРАВА.' : 'REAL ASSETS. LASTING RIGHTS.'}</div>
          <h1 className="wm-enter">{t.first}<br />{ru ? 'Право' : 'The right'}<br /><span>{ru ? 'остаётся.' : 'stays yours.'}<svg viewBox="0 0 330 16" fill="none" aria-hidden="true"><path d="M3 12C85 1 226 1 326 8" stroke="currentColor" strokeWidth="2" /></svg></span></h1>
          <p className="wm-intro wm-enter">{ru ? 'Облигация может сменить владельца. Право на выплату — нет. Recorda связывает каждое действие с зафиксированным правом.' : 'A bond can change hands. Its recorded rights cannot. Recorda connects every corporate action to the ownership that earned it.'}</p>
          <div className="wm-actions wm-enter"><a className="wm-start" href="/actions">{t.start}<ArrowUpRight size={20} /></a><span>{ru ? 'Купон · Голосование · Погашение' : 'Coupon · Voting · Redemption'}</span></div>
          <div className="wm-context wm-enter"><span>01 / KASE TRACK</span><span>{ru ? 'Обслуживание RWA на Solana' : 'RWA servicing on Solana'}</span></div>
        </div>
        <section className="wm-stage" id="story" aria-label={ru ? 'Права в движении: интерактивный пример' : 'Rights in motion: interactive example'}>
          <div className="wm-stage-title"><span>RIGHTS IN MOTION</span><span className="wm-live-dot">{ru ? 'ИЛЛЮСТРАЦИЯ' : 'ILLUSTRATIVE'}</span></div>
          <div className={`rights-theatre stage-${step}`}>
            <svg className="rights-routing" viewBox="0 0 540 420" fill="none" aria-hidden="true"><defs><linearGradient id="rights-line"><stop stopColor="#9dd7bd" /><stop offset="1" stopColor="#c5a9f8" /></linearGradient></defs><ellipse cx="270" cy="217" rx="226" ry="164" stroke="#ffffff0c" /><ellipse cx="270" cy="217" rx="175" ry="117" stroke="#ffffff0c" /><path d="M93 108H193Q223 108 223 138V192Q223 217 253 217H365Q400 217 400 252V306" stroke="#ffffff18" /><path className="record-path" d="M93 108H193Q223 108 223 138V192Q223 217 253 217H365Q400 217 400 252V306" stroke="url(#rights-line)" strokeWidth="2" strokeDasharray="460" strokeDashoffset="460" /><path d="M125 210V330H210" stroke="#ffffff12" strokeDasharray="3 5" /></svg>
            <div className="kase-origin"><img src="/brand/kase.svg" alt="KASE" /><span>{ru ? 'ИНСТРУМЕНТ' : 'INSTRUMENT'}</span></div>
            <div className="bond-stack" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <div key={i} className={`bond-unit ${i > 5 ? 'bond-moving' : ''}`} style={{ left: (i % 5) * 19, top: Math.floor(i / 5) * 27 }}><span /><i /></div>)}</div>
            <div className="ownership-label holding-comparison"><span>{t.current}</span><strong>{step === 0 ? '10' : '6'} <small>{ru ? 'облигаций' : 'bonds'}</small></strong></div>
            <div className="record-core"><RecordaMark /><span>RECORDA</span></div>
            <div className={`recipient ${step > 0 ? 'is-visible' : ''}`}><span>B</span><div>{ru ? 'Новый владелец' : 'New owner'}<strong>+4 {ru ? 'облигации' : 'bonds'}</strong></div></div>
            <div className="right-certificate">
              <div className="certificate-top"><span><LockKeyhole size={12} />{ru ? 'ПРАВО ЗАФИКСИРОВАНО' : 'RIGHT RECORDED'}</span><span>R / 001</span></div>
              <div className="certificate-holder"><span>{t.holder}</span><span className="snapshot-holding">10 {ru ? 'на дату фиксации' : 'at record date'}</span></div>
              <div className="coupon-value"><span>{t.right}</span><strong>500<span>.00</span><small>MOCK USD</small></strong></div>
              <div className="certificate-bottom"><span>{t.formula}</span><Check size={15} /></div>
            </div>
            <div className="solana-outcome"><img src="/brand/solana.svg" alt="Solana" /><div><span>{ru ? 'СЕТЬ ИСПОЛНЕНИЯ' : 'EXECUTION NETWORK'}</span><strong>Solana</strong></div></div>
            <span className="theatre-coordinate">RECORD DATE → RIGHT → OUTCOME</span>
          </div>
          <div className="stage-caption" aria-live={playing ? 'off' : 'polite'}><span>0{step + 1}</span><p>{t.captions[step]}</p></div>
          <div className="wm-story-controls"><div className="wm-step-buttons">{t.stages.map((label, index) => <button key={label} aria-label={label} aria-pressed={step === index} onClick={() => selectStep(index)}><span>0{index + 1}</span>{ru ? ['Фиксация', 'Перевод', 'Право'][index] : ['Record', 'Transfer', 'Right'][index]}</button>)}</div><button className="wm-play" aria-label={playing ? t.pause : t.play} onClick={() => { if (playing) timeline.current?.pause(); else timeline.current?.resume(); setPlaying(value => !value); }} disabled={!motionAllowed}>{playing ? <Pause size={14} /> : <Play size={14} />}</button><button className="wm-play" aria-label={t.replay} onClick={() => { setStep(0); setPlaying(motionAllowed); }}><RotateCcw size={14} /></button></div>
          <p className="wm-disclosure">{t.tag}</p>
        </section>
      </main>
      <aside className="wm-perspectives"><div className="wm-role-tabs" role="tablist" aria-label={ru ? 'Роли продукта' : 'Product perspectives'}>{t.roles.map((name, index) => <button key={name} id={`perspective-${index}`} role="tab" aria-selected={role === index} aria-controls="perspective-panel" tabIndex={role === index ? 0 : -1} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (role + (event.key === 'ArrowRight' ? 1 : 2)) % 3; setRole(next); document.getElementById(`perspective-${next}`)?.focus(); } }} onClick={() => setRole(index)}>{name}</button>)}</div><div role="tabpanel" id="perspective-panel" aria-labelledby={`perspective-${role}`}><strong>{t.roleTitles[role]}</strong><p>{t.roleTexts[role]}</p></div><ArrowRight size={20} aria-hidden="true" /></aside>
      <footer className="wm-footer"><span>{ru ? 'ПРОТОТИП ДЛЯ ХАКАТОНА · ТЕСТОВЫЕ АКТИВЫ' : 'HACKATHON PROTOTYPE · TEST ASSETS'}</span><span>{ru ? 'Фиксировать. Исполнять. Проверять.' : 'Record. Execute. Verify.'}</span></footer>
    </div>
  </div>;
}
