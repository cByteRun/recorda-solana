import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Fingerprint, LockKeyhole, Pause, Play, ShieldCheck } from "lucide-react";
import { Brand } from "@/shared/ui/product-shell";

const copy = {
  en: {
    nav: 'How it works', open: 'Open workspace', eyebrow: 'THE LIFE AFTER ISSUANCE', first: 'Ownership changes.', second: 'Rights stay', accent: 'recorded.',
    intro: 'Service tokenized bonds with clarity. Turn ownership at a record date into a payment, a vote, or a completed redemption — with a trail anyone can verify.',
    start: 'Get started', story: 'See the idea', note: 'For bond operators, issuers & paying agents', tag: 'INTERACTIVE EXAMPLE · NOT A LIVE TRANSACTION',
    stages: ['Capture the right', 'Change the ownership', 'Keep the promise'], holder: 'Investor A', current: 'Bonds held now', snapshot: 'Bonds at record date', right: 'Coupon entitlement',
    captions: ['10 bonds are held at the cutoff. The right is fixed.', '4 bonds move to Investor B. Current ownership changes.', 'The coupon stays at 500. A transfer cannot rewrite the right.'],
    formula: '10 bonds × 1,000 × 10% ÷ 2', locked: 'Fixed at record date', transfer: '4 bonds → Investor B', payment: 'Mock USD', replay: 'Replay', pause: 'Pause story', play: 'Play story',
    sectionLabel: 'ONE INSTRUMENT. ITS ENTIRE LIFECYCLE.', sectionTitle: 'Issued is just the beginning.', sectionText: 'The work starts when holders expect a payment, a say, and their principal back. Recorda keeps each action connected to the right that created it.',
    actions: [['01', 'Coupon', 'Pay the right holder.', 'Calculate from fixed record-date holdings. Approve, fund, pay and reconcile.'], ['02', 'Voting', 'Give ownership a voice.', 'Let holders sign their decision with fixed voting power. Record quorum and the outcome.'], ['03', 'Redemption', 'Close the loop.', 'Return principal and any final coupon. Retire the bonds with a holder-signed payment.']],
    rolesLabel: 'THREE PERSPECTIVES. ONE SHARED RECORD.', rolesTitle: 'A clear answer for everyone.', roles: ['Operator', 'Investor', 'Auditor'],
    roleTitles: ['Who gets what — and why?', 'What am I entitled to?', 'Can I verify the outcome?'],
    roleTexts: ['Review the obligation, approve execution and follow progress. Continue unfinished work without paying twice.', 'See current holdings beside fixed record-date rights. Sign a vote or redemption when your authorization is needed.', 'Follow the calculation through to its receipt. Read on-chain evidence and export the audit without connecting a wallet.'],
    roleFacts: [['Review rights', 'Approve execution', 'Track completion'], ['See your right', 'Sign your decision', 'Check the result'], ['Read without a wallet', 'Verify the receipt', 'Export evidence']],
    endTitle: 'From ownership to outcome.', endText: 'Start with an instrument. Follow its rights all the way through.', footer: 'Solana · Token-2022 · Hackathon prototype', disclosure: 'Illustrative story above. Workspace operations use real on-chain test tokens; no real fiat value. Eligibility is simulated.',
  },
  ru: {
    nav: 'Как это работает', open: 'Открыть продукт', eyebrow: 'ЖИЗНЬ ОБЛИГАЦИИ ПОСЛЕ ВЫПУСКА', first: 'Владение меняется.', second: 'Права остаются', accent: 'в записи.',
    intro: 'Обслуживайте токенизированные облигации прозрачно. Превратите владение на дату фиксации в выплату, голос или погашение — с результатом, который можно проверить.',
    start: 'Начать', story: 'Понять идею', note: 'Для операторов, эмитентов и платёжных агентов', tag: 'ИНТЕРАКТИВНЫЙ ПРИМЕР · НЕ ЖИВАЯ ТРАНЗАКЦИЯ',
    stages: ['Зафиксировать право', 'Изменить владение', 'Сохранить обязательство'], holder: 'Инвестор A', current: 'Облигаций сейчас', snapshot: 'На дату фиксации', right: 'Право на купон',
    captions: ['На дату фиксации — 10 облигаций. Право закреплено.', '4 облигации переходят инвестору B. Владение меняется.', 'Купон остаётся 500. Перевод не переписывает право.'],
    formula: '10 облигаций × 1 000 × 10% ÷ 2', locked: 'Право зафиксировано', transfer: '4 облигации → Инвестор B', payment: 'Mock USD', replay: 'Повторить', pause: 'Остановить историю', play: 'Продолжить историю',
    sectionLabel: 'ОДИН ИНСТРУМЕНТ. ВЕСЬ ЖИЗНЕННЫЙ ЦИКЛ.', sectionTitle: 'Выпуск — только начало.', sectionText: 'Держатели ждут выплат, права голоса и возврата номинала. Recorda связывает каждое действие с правом, на основании которого оно исполняется.',
    actions: [['01', 'Coupon', 'Выплата тому, кому причитается.', 'Расчёт по позициям на дату фиксации. Одобрение, финансирование, выплата и сверка.'], ['02', 'Voting', 'У владения есть голос.', 'Подпись держателя и фиксированный вес голоса. Проверяемый кворум и итог.'], ['03', 'Redemption', 'Завершённый цикл.', 'Возврат номинала и финального купона. Погашение облигаций и выплата с подписью держателя.']],
    rolesLabel: 'ТРИ ВЗГЛЯДА. ОДНА ОБЩАЯ ЗАПИСЬ.', rolesTitle: 'Понятный ответ для каждого.', roles: ['Оператор', 'Инвестор', 'Аудитор'],
    roleTitles: ['Кому, сколько и почему?', 'На что я имею право?', 'Можно ли проверить результат?'],
    roleTexts: ['Проверьте обязательства, одобрите исполнение и следите за прогрессом. Продолжайте незавершённые операции без повторных выплат.', 'Сравните текущие позиции с правами на дату фиксации. Подпишите голос или погашение, когда нужно ваше разрешение.', 'Проследите путь от расчёта до итоговой записи. Проверьте данные в сети и выгрузите аудит без подключения кошелька.'],
    roleFacts: [['Проверить права', 'Одобрить исполнение', 'Увидеть результат'], ['Увидеть своё право', 'Подписать решение', 'Проверить итог'], ['Открыть без кошелька', 'Проверить запись', 'Выгрузить доказательства']],
    endTitle: 'От владения — к результату.', endText: 'Начните с инструмента. Проследите весь путь его прав.', footer: 'Solana · Token-2022 · Прототип для хакатона', disclosure: 'Выше — иллюстрация. В продукте операции идут в сети с тестовыми токенами без реальной фиатной стоимости. Допуск держателей симулируется.',
  },
};

export function WelcomePage() {
  const [language, setLanguage] = useState<'en' | 'ru'>('en');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [role, setRole] = useState(0);
  const t = copy[language];
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setMotionAllowed(!preference.matches); setPlaying(!preference.matches); };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!playing || !motionAllowed) return;
    const timer = window.setInterval(() => { if (!document.hidden) setStep(value => (value + 1) % 3); }, 5000);
    return () => window.clearInterval(timer);
  }, [playing, motionAllowed]);
  function selectStep(value: number) { setStep(value); setPlaying(false); }
  return <div className="welcome" lang={language} data-motion={playing ? 'playing' : 'paused'}>
    <a className="skip-link" href="#welcome-content">{language === 'en' ? 'Skip to content' : 'К содержимому'}</a>
    <header className="welcome-nav"><Brand light /><nav><a href="#lifecycle">{t.nav}</a><button className="language-switch" onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')} aria-label={language === 'en' ? 'Switch to Russian' : 'Switch to English'}>{language === 'en' ? 'RU' : 'EN'}</button><a className="welcome-open" href="/actions">{t.open} <ArrowUpRight size={15} /></a></nav></header>
    <main id="welcome-content" tabIndex={-1}>
      <section className="welcome-hero">
        <div className="orbital-background" aria-hidden="true"><div className="orbit-system"><i /><i /><i /><i /><span /></div></div>
        <div className="hero-copy"><div className="eyebrow"><span className="status-dot" /> {t.eyebrow}</div><h1>{t.first}<br />{t.second}<br /><em>{t.accent}</em></h1><p className="hero-intro">{t.intro}</p><div className="hero-buttons"><a className="lime-button" href="/actions">{t.start} <ArrowRight size={18} /></a><a className="text-button" href="#story">{t.story} <ArrowDown size={16} /></a></div><p className="hero-audience">{t.note}</p></div>
        <div className="story-scene" id="story">
          <div className="scene-topline"><span className="scene-index">FIG. 01 / RECORD-DATE RIGHTS</span><Fingerprint size={23} /></div>
          <div className="security-ticket"><span>DEMO BOND</span><span>1,000 <small>MOCK USD</small></span><div className="ticket-bars" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div></div>
          <div className={`rights-card scene-step-${step}`}>
            <div className="rights-card-heading"><span className="avatar">A</span><div><strong>{t.holder}</strong><small>{t.locked}</small></div><LockKeyhole size={18} /></div>
            <div className="holding-comparison"><div><span>{t.current}</span><strong key={step === 0 ? '10' : '6'} className="number-change">{step === 0 ? '10' : '6'}<small> units</small></strong></div><div className="snapshot-holding"><span>{t.snapshot}</span><strong>10<small> units</small></strong></div></div>
            <div className="coupon-value"><div><span>{t.right}</span><strong>500<span>.00</span><small>{t.payment}</small></strong></div><span className="entitlement-seal"><Check size={23} /></span></div>
            <div className="coupon-formula">{t.formula}</div>
          </div>
          <div className={`transfer-pill ${step > 0 ? 'transfer-visible' : ''}`}><ArrowUpRight size={16} />{t.transfer}</div>
          <div className="scene-caption" aria-live={playing ? 'off' : 'polite'}><span>0{step + 1}</span><p>{t.captions[step]}</p></div>
          <div className="scene-controls"><div className="story-steps" aria-label={language === 'en' ? 'Story steps' : 'Этапы истории'}>{t.stages.map((label, index) => <button key={label} aria-label={label} aria-pressed={step === index} onClick={() => selectStep(index)}><span /></button>)}</div><button className="story-play" aria-label={playing ? t.pause : t.play} onClick={() => setPlaying(value => !value)} disabled={!motionAllowed}>{playing ? <Pause size={15} /> : <Play size={15} />}</button></div>
          <p className="scene-disclosure">{t.tag}</p>
        </div>
        <div className="hero-baseline"><span>01 — OWNERSHIP</span><span>02 — RIGHTS</span><span>03 — OUTCOME <ArrowUpRight size={14} /></span></div>
      </section>
      <section className="lifecycle-section" id="lifecycle"><div className="section-heading"><div><p className="eyebrow">{t.sectionLabel}</p><h2>{t.sectionTitle}</h2></div><p>{t.sectionText}</p></div><div className="lifecycle-grid">{t.actions.map(([number, name, title, text]) => <article key={name}><div className="action-card-top"><span>{number}</span><ArrowUpRight size={22} /></div><p className="action-name">{name}</p><h3>{title}</h3><p>{text}</p><span className="action-card-footer"><ShieldCheck size={15} /> RECORD → AUTHORIZE → VERIFY</span></article>)}</div></section>
      <section className="perspectives-section"><div className="perspectives-heading"><p className="eyebrow">{t.rolesLabel}</p><h2>{t.rolesTitle}</h2><div className="perspective-tabs" role="tablist" aria-label={language === 'en' ? 'Product perspectives' : 'Роли продукта'}>{t.roles.map((name, index) => <button key={name} id={`perspective-${index}`} role="tab" aria-selected={role === index} aria-controls="perspective-panel" tabIndex={role === index ? 0 : -1} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (role + (event.key === 'ArrowRight' ? 1 : 2)) % 3; setRole(next); document.getElementById(`perspective-${next}`)?.focus(); } }} onClick={() => setRole(index)}>{name}</button>)}</div></div><div className="perspective-panel" role="tabpanel" id="perspective-panel" aria-labelledby={`perspective-${role}`}><span className="perspective-icon"><ShieldCheck size={32} strokeWidth={1.2} /></span><h3>{t.roleTitles[role]}</h3><p>{t.roleTexts[role]}</p><div>{t.roleFacts[role].map(fact => <span key={fact}><Check size={14} />{fact}</span>)}</div></div></section>
      <section className="welcome-close"><div><h2>{t.endTitle}</h2><p>{t.endText}</p></div><a className="ink-button" href="/actions">{t.start} <ArrowRight size={19} /></a></section>
    </main>
    <footer className="welcome-footer"><Brand /><p>{t.disclosure}</p><span>{t.footer}</span></footer>
  </div>;
}
