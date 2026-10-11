import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Pause, Play, RotateCcw, X } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { KaseMark, SolanaMark } from './network-marks';
import { RecordaMark } from './recorda-mark';
import { RightsLightField } from './rights-light-field';
import './welcome.css';

gsap.registerPlugin(useGSAP);
const copy = {
  en: {
    title: ['Real assets.', 'Lasting rights.'], intro: 'KASE bonds. Solana settlement. Rights that stay recorded.', start: 'Get started', idea: 'Why Recorda?',
    label: 'CORPORATE ACTIONS, IN A NEW LIGHT', cue: 'Move through the light', pause: 'Pause animation', play: 'Play animation', replay: 'Replay animation', close: 'Close explanation',
    stages: ['The instrument', 'The execution', 'The record'],
    descriptions: [ ['Tokenized KASE bonds.', 'Ownership at the record date.', 'The origin of every right.'], ['Coupon. Voting. Redemption.', 'Authorized execution.', 'Settled on Solana.'], ['Ownership can change.', 'Recorded rights remain.', 'An outcome you can verify.'] ],
    tags: ['INSTRUMENT', 'EXECUTION', 'RECORD'],
    note: 'ILLUSTRATIVE · NOT A LIVE TRANSACTION', prototype: 'HACKATHON PROTOTYPE / TEST ASSETS',
    example: 'A transfer changes the balance. It cannot rewrite the right.', now: 'Bonds held now', snapshot: 'At record date', entitlement: 'Coupon entitlement',
    dialogTitle: 'Ownership changes. Rights stay recorded.',
    dialogIntro: 'Recorda services tokenized bonds from record-date ownership to a payment, a holder decision, or redemption — with verifiable on-chain outcomes.',
    transfer: 'Change the ownership', record: 'Capture the right', promise: 'Keep the promise',
    captions: ['Investor A holds 10 bonds at the cutoff. The coupon right is fixed.', '4 bonds move to Investor B. Investor A now holds 6, but the right still comes from 10.', '500 Mock USD remain due to Investor A. A transfer cannot rewrite the right.'],
    roles: ['Operator', 'Investor', 'Auditor'],
    roleTexts: ['Review record-date rights, authorize execution and follow completion.', 'See what you hold now beside the right you earned at the cutoff.', 'Verify on-chain outcomes without connecting a wallet.'],
  },
  ru: {
    title: ['Реальные активы.', 'Неизменные права.'], intro: 'Облигации KASE. Расчёты на Solana. Права остаются в записи.', start: 'Начать', idea: 'Почему Recorda?',
    label: 'КОРПОРАТИВНЫЕ ДЕЙСТВИЯ В НОВОМ СВЕТЕ', cue: 'Проведите курсором по свету', pause: 'Остановить анимацию', play: 'Продолжить анимацию', replay: 'Повторить анимацию', close: 'Закрыть объяснение',
    stages: ['Инструмент', 'Исполнение', 'Запись'],
    descriptions: [ ['Токенизированные облигации KASE.', 'Владение на дату фиксации.', 'Начало каждого права.'], ['Купон. Голосование. Погашение.', 'Авторизованное исполнение.', 'Расчёты на Solana.'], ['Владение может меняться.', 'Зафиксированные права остаются.', 'Результат можно проверить.'] ],
    tags: ['ИНСТРУМЕНТ', 'ИСПОЛНЕНИЕ', 'ЗАПИСЬ'],
    note: 'ИЛЛЮСТРАЦИЯ · НЕ ЖИВАЯ ТРАНЗАКЦИЯ', prototype: 'ПРОТОТИП ДЛЯ ХАКАТОНА / ТЕСТОВЫЕ АКТИВЫ',
    example: 'Перевод меняет баланс. Но не переписывает право.', now: 'Облигаций сейчас', snapshot: 'На дату фиксации', entitlement: 'Право на купон',
    dialogTitle: 'Владение меняется. Права остаются в записи.',
    dialogIntro: 'Recorda связывает позиции в токенизированных облигациях на дату фиксации с выплатой, решением держателей или погашением — и проверяемым результатом в сети.',
    transfer: 'Изменить владение', record: 'Зафиксировать право', promise: 'Сохранить обязательство',
    captions: ['На дату фиксации у инвестора A — 10 облигаций. Право на купон закреплено.', '4 облигации переходят инвестору B. У инвестора A осталось 6, но право рассчитано по 10.', 'Инвестору A по-прежнему причитаются 500 Mock USD. Перевод не переписывает право.'],
    roles: ['Оператор', 'Инвестор', 'Аудитор'],
    roleTexts: ['Проверьте права на дату фиксации, одобрите исполнение и следите за результатом.', 'Сравните текущие позиции с правом, полученным на дату фиксации.', 'Проверьте результаты в сети без подключения кошелька.'],
  },
};
const names = ['KASE', 'SOLANA', 'RECORDA'];

export function WelcomePage() {
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogTrigger = useRef<HTMLButtonElement>(null);
  const explanationOrigin = useRef<HTMLElement | null>(null);
  const [language, setLanguage] = useState<'en' | 'ru'>('en');
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [replay, setReplay] = useState(0);
  const [explaining, setExplaining] = useState(false);
  const [exampleStep, setExampleStep] = useState(0);
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
    if (!playing || !motionAllowed || explaining) return;
    const timer = window.setInterval(() => { if (!document.hidden) setPhase(value => (value + 1) % 3); }, 6500);
    return () => window.clearInterval(timer);
  }, [playing, motionAllowed, explaining, replay, phase]);
  useGSAP(() => {
    if (!motionAllowed) return;
    gsap.from('.light-enter', { opacity: 0, y: 12, duration: 1.1, stagger: .1, ease: 'power3.out' });
    gsap.from('.light-wordmark .record-point', { scale: 0, transformOrigin: 'center', duration: 1, stagger: .16 });
  }, { scope: root, dependencies: [motionAllowed], revertOnUpdate: true });
  useGSAP(() => {
    if (!motionAllowed) return;
    gsap.fromTo('.light-description-line', { y: 9, opacity: 0 }, { y: 0, opacity: 1, stagger: .09, duration: .75 });
    gsap.fromTo('.light-phase-symbol', { opacity: .25, scale: .92 }, { opacity: 1, scale: 1, duration: 1 });
    gsap.fromTo('.light-track-active .network-icon', { y: 3, opacity: .4 }, { y: 0, opacity: 1, duration: .7 });
  }, { scope: root, dependencies: [phase, motionAllowed, replay], revertOnUpdate: true });
  function selectPhase(value: number) { setPhase(value); setPlaying(false); }
  function openExplanation() { explanationOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : dialogTrigger.current; setExplaining(true); dialog.current?.showModal(); }
  function closeExplanation() { dialog.current?.close(); }

  return <div ref={root} className="welcome welcome-light" lang={language} data-motion={playing && !explaining ? 'playing' : 'paused'} data-phase={phase}>
    <a className="skip-link" href="#welcome-content">{ru ? 'К содержимому' : 'Skip to content'}</a>
    <header className="light-header">
      <a className="light-wordmark" href="/" aria-label="Recorda home"><RecordaMark /><span>recorda</span><i /></a>
      <span className="light-header-context">KASE / SOLANA</span>
      <div className="light-header-actions"><button className="light-language" onClick={() => setLanguage(ru ? 'en' : 'ru')} aria-label={ru ? 'Switch to English' : 'Switch to Russian'}><span className={ru ? '' : 'is-current'}>EN</span><span className={ru ? 'is-current' : ''}>RU</span></button><a href="/dashboard" className="light-open">{ru ? 'Открыть продукт' : 'Open workspace'}<ArrowUpRight size={13} /></a></div>
    </header>
    <main className="light-main" id="welcome-content" tabIndex={-1}>
      <div className="light-kicker light-enter"><span className="light-kicker-dot" />{t.label}</div>
      <div className="light-composition">
        <div className="light-copy light-enter">
          <h1>{t.title[0]}<br /><span>{t.title[1]}</span></h1>
          <p>{t.intro}</p>
          <div className="light-cta-row"><a href="/dashboard" className="light-start">{t.start}<ArrowUpRight size={16} /></a><button className="light-why" ref={dialogTrigger} onClick={openExplanation}>{t.idea}<ArrowRight size={14} /></button></div>
        </div>
        <div className="light-sculpture" role="img" aria-label={ru ? `Световые узлы образуют ${names[phase]}. ${t.stages[phase]}.` : `Light nodes form ${names[phase]}. ${t.stages[phase]}.`}>
          <RightsLightField phase={phase} playing={playing && !explaining} motionAllowed={motionAllowed} replay={replay} />
          <div className="light-art-caption"><span className="light-art-index">0{phase + 1} / 03</span><span>{t.cue}</span></div>
        </div>
        <div className="light-right-copy light-enter">
          <div className="light-phase-symbol">{phase === 0 ? <KaseMark /> : phase === 1 ? <SolanaMark /> : <RecordaMark />}</div>
          <div className="light-phase-name"><strong>{names[phase]}</strong><span>{t.tags[phase]}</span></div>
          <div className="light-description" aria-live={playing ? 'off' : 'polite'}>{t.descriptions[phase].map(line => <p className="light-description-line" key={line}>{line}</p>)}</div>
          <button className="light-proof-link" onClick={openExplanation}><span>{ru ? 'Владение' : 'Holdings'} <b>10 → 6</b></span><span>{ru ? 'Право на купон' : 'Coupon right'} <b>500 <small>MOCK USD</small></b></span><ArrowUpRight size={13} /></button>
        </div>
      </div>
      <div className="light-bottom light-enter">
        <div className="light-quiet-note">{t.note}</div>
        <div className="light-sequence" role="group" aria-label={ru ? 'Этапы анимации' : 'Animation stages'}>
          {names.map((name, index) => <button key={name} className={`light-track ${phase === index ? 'light-track-active' : ''}`} aria-label={`${name}: ${t.stages[index]}`} aria-pressed={phase === index} onClick={() => selectPhase(index)}><span className="network-icon">{index === 0 ? <KaseMark /> : index === 1 ? <SolanaMark /> : <RecordaMark />}</span><span>{name}</span><span className="light-track-line" /></button>)}
          <button className="light-player" aria-label={playing ? t.pause : t.play} disabled={!motionAllowed} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
          <button className="light-player" aria-label={t.replay} onClick={() => { setPhase(0); setReplay(value => value + 1); setPlaying(motionAllowed); }}><RotateCcw size={13} /></button>
        </div>
        <span className="light-series">01 — RIGHTS IN MOTION</span>
      </div>
    </main>
    <footer className="light-footer"><span>{t.prototype}</span><span>{ru ? 'Фиксация → Исполнение → Проверяемый результат' : 'Record → Execute → Verifiable outcome'}</span></footer>
    <dialog ref={dialog} className="light-explanation" aria-labelledby="explanation-title" onCancel={() => closeExplanation()} onClose={() => { setExplaining(false); explanationOrigin.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeExplanation(); } }}>
      <button className="light-dialog-close" aria-label={t.close} onClick={closeExplanation}><X size={18} /></button>
      <span className="light-dialog-eyebrow">RECORDA / THE RIGHT BEHIND THE ASSET</span>
      <h2 id="explanation-title">{t.dialogTitle}</h2><p className="light-dialog-intro">{t.dialogIntro}</p>
      <div id="story" className="light-example">
        <div className="light-example-stats"><div className="holding-comparison"><span>{t.now}</span><strong>{exampleStep === 0 ? '10' : '6'}</strong></div><div className="snapshot-holding"><span>{t.snapshot}</span><strong>10</strong></div><div className="coupon-value"><span>{t.entitlement}</span><strong>500.00<small>Mock USD</small></strong></div></div>
        <p className="light-example-caption" aria-live="polite">{t.captions[exampleStep]}</p>
        <div className="light-example-steps">{[t.record, t.transfer, t.promise].map((label, index) => <button key={label} aria-label={label} aria-pressed={exampleStep === index} onClick={() => setExampleStep(index)}><span>0{index + 1}</span>{label}</button>)}</div>
        <p className="light-example-formula">10 × 1,000 × 10% ÷ 2 = 500 Mock USD</p><p className="light-example-note">{t.note}</p>
      </div>
      <div className="light-role-tabs" role="tablist" aria-label={ru ? 'Роли продукта' : 'Product perspectives'}>{t.roles.map((name, index) => <button key={name} id={`perspective-${index}`} role="tab" aria-selected={role === index} aria-controls="perspective-panel" tabIndex={role === index ? 0 : -1} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (role + (event.key === 'ArrowRight' ? 1 : 2)) % 3; setRole(next); document.getElementById(`perspective-${next}`)?.focus(); } }} onClick={() => setRole(index)}>{name}</button>)}</div>
      <p className="light-role-panel" role="tabpanel" id="perspective-panel" aria-labelledby={`perspective-${role}`}>{t.roleTexts[role]}</p>
      <a className="light-start light-dialog-start" href="/dashboard">{t.start}<ArrowUpRight size={15} /></a>
    </dialog>
  </div>;
}
