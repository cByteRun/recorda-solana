import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Layers, Network, FlaskConical } from 'lucide-react';
import { enterWorkspace, type WorkspaceMode } from '@/shared/solana/workspaces';
import { DEVNET_RPC, LOCAL_RPC } from '@/shared/solana/config';
import './workspaces.css';
const copy = {
 ru: {
  back: 'На главную', eyebrow: 'RECORDA / ВЫБОР РАБОЧЕГО ПРОСТРАНСТВА', title: 'Выберите среду',
  intro: 'Контролируйте процесс от фиксации прав инвесторов до исполнения и проверки выплат.',
  mock: 'Пример данных · без блокчейна',
  localSetup: 'Из папки проекта: сборка → запуск валидатора.',
  localApp: 'В другом терминале:',
  localWallet: 'В Phantom выберите Solana Localnet.',
  note: 'Localnet подключается к валидатору на компьютере посетителя. Транзакции Localnet не появляются в Devnet. При смене рабочего пространства подключение и выбранные аккаунты сбрасываются.',
  environments: [
 {mode:'demo',title:'Demo Workspace',badge:'Обзор',icon:Layers,description:'Готовый пример KZB26: права инвесторов, купоны, сроки, выплаты и разбор исключений.',details:'Иллюстративные данные. Без RPC, кошелька и исполнения Rust-программы.',action:'Открыть Demo'},
 {mode:'test',title:'Localnet Workspace',badge:'Localnet',icon:FlaskConical,description:'Настоящие Solana-транзакции и Rust-программа в локальной инженерной песочнице.',details:'Нужен запущенный локальный валидатор. Ledger и тестовые токены независимы от Devnet.',action:'Открыть Localnet'},
 {mode:'devnet',title:'Devnet Workspace',badge:'Публичная Devnet',icon:Network,description:'Публичная тестовая сеть: права, исполнение и подтверждения из Solana program.',details:'Для изменений нужен кошелёк и отдельно развёрнутая в Devnet программа. Просмотр доступен без подписи.',action:'Открыть Devnet'},
  ],
 },
 en: {
  back: 'Welcome', eyebrow: 'RECORDA / WORKSPACE SELECTOR', title: 'Choose your environment',
  intro: 'Control bond servicing from fixed investor rights to payment execution and verification.',
  mock: 'Mock data · no blockchain',
  localSetup: 'From the project folder: build → start the validator.',
  localApp: 'In another terminal:',
  localWallet: 'Select Solana Localnet in Phantom.',
  note: 'Localnet connects to a validator on your computer. Localnet transactions do not appear on Devnet. Switching workspaces resets the connection and selected accounts.',
  environments: [
   {mode:'demo',title:'Demo Workspace',badge:'Preview',icon:Layers,description:'A ready-made KZB26 example: investor rights, coupons, deadlines, payments and exceptions.',details:'Illustrative data. No RPC, wallet or Rust program execution.',action:'Open Demo'},
   {mode:'test',title:'Localnet Workspace',badge:'Localnet',icon:FlaskConical,description:'Real Solana transactions and a Rust program in a local sandbox.',details:'Requires a running local validator. Its ledger and test tokens are independent of Devnet.',action:'Open Localnet'},
   {mode:'devnet',title:'Devnet Workspace',badge:'Public Devnet',icon:Network,description:'The public test network: rights, execution and confirmations from the Solana program.',details:'Changes require a wallet and a program deployed separately on Devnet. Viewing requires no signature.',action:'Open Devnet'},
  ],
 },
} satisfies Record<'en'|'ru', {back:string;eyebrow:string;title:string;intro:string;mock:string;localSetup:string;localApp:string;localWallet:string;note:string;environments:{mode:WorkspaceMode;title:string;badge:string;icon:typeof Layers;description:string;details:string;action:string}[]}>;

export function WorkspacesPage(){
 const [language,setLanguage]=useState<'en'|'ru'>('ru');
 const t=copy[language];
 return <div className="workspace-entry" lang={language}>
  <header><a href="/">recorda<span>BondOps</span></a><div className="entry-header-actions"><div className="entry-language" role="group" aria-label={language==='ru'?'Язык':'Language'}>{(['en','ru'] as const).map(value=><button key={value} type="button" aria-pressed={language===value} onClick={()=>setLanguage(value)}>{value.toUpperCase()}</button>)}</div><a href="/" className="entry-back"><ArrowLeft size={16}/>{t.back}</a></div></header>
  <main><p className="entry-eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="entry-intro">{t.intro}</p><div className="entry-grid">{t.environments.map(({mode,title,badge,icon:Icon,description,details,action})=><section className="entry-card" key={mode}><div className="entry-card-top"><Icon size={24}/><span>{badge}</span></div><h2>{title}</h2><p>{description}</p><p className="entry-details">{details}</p>{mode==='test' && <div className="entry-local-setup"><p>{t.localSetup}</p><pre><code>{'npm run protocol:build\nnpm run bondops:local'}</code></pre><p>{t.localApp}</p><pre><code>npm run dev</code></pre><p>{t.localWallet}</p></div>}<code>{mode==='demo'?t.mock:mode==='test'?LOCAL_RPC:DEVNET_RPC}</code><button onClick={()=>enterWorkspace(mode)}>{action}<ArrowUpRight size={17}/></button></section>)}</div><p className="entry-note">{t.note}</p></main>
 </div>;
}
