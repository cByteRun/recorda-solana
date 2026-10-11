import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Connection } from '@solana/web3.js';
import {solanaTool} from './solana-tools.mjs';
const idl = JSON.parse(readFileSync('src/shared/solana/idl/recorda.json'));
if (!existsSync('target/deploy/recorda.so')) throw new Error('Run npm run protocol:build first');
const suites = { full: ['coupon', 'actions-v2', 'post-mvp', 'bondops'], coupon: ['coupon'], actions: ['actions-v2'], 'post-mvp': ['post-mvp'], bondops: ['bondops'] };
const suite = process.argv.find(arg => arg.startsWith('--suite='))?.slice(8) || 'full';
if (!suites[suite]) throw new Error(`Unknown suite ${suite}`);
if (!['full','bondops'].includes(suite) && process.argv.includes('--ui')) throw new Error('Browser verification requires the full fixture suite');
const browserLedger = process.argv.find(arg => arg.startsWith('--browser-ledger='))?.slice(17);
if (browserLedger && (!/^\/tmp\/recorda-phase1-[A-Za-z0-9]+$/.test(browserLedger) || !existsSync(browserLedger) || !process.argv.includes('--ui'))) throw new Error('Browser-only replay requires an existing local test ledger and --ui');
// A failed new run must not leave previous success evidence looking current.
for (const name of (browserLedger ? [] : suites[suite]).flatMap(name => [`${name}.json`, `${name}-ui.json`, `${name}-ui.png`])) rmSync(`target/protocol-evidence/${name}`, { force: true });
const ledger = browserLedger || mkdtempSync(join(tmpdir(), 'recorda-phase1-'));
const rpcUrl = 'http://127.0.0.1:18899';
const validator = spawn(solanaTool('solana-test-validator'), ['--ledger', ledger, '--bpf-program', idl.address, 'target/deploy/recorda.so', '--rpc-port', '18899', '--faucet-port', '19900', '--gossip-port', '18000', '--dynamic-port-range', '18001-18030', '--bind-address', '127.0.0.1', '--quiet'], { stdio: 'inherit' });
let startupError;
validator.on('error', e => { startupError = e; });
const rpc = new Connection(rpcUrl, 'confirmed');
const stop = () => validator.kill('SIGINT');
process.on('SIGINT', stop); process.on('SIGTERM', stop);
async function command(bin, args, env = {}) {
  const child = spawn(bin, args, { stdio: 'inherit', env: { ...process.env, ...env, RECORDA_TEST_RPC: rpcUrl } });
  return await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startupError) throw startupError;
    if (validator.exitCode !== null) throw new Error(`Validator exited ${validator.exitCode}`);
    try { await rpc.getLatestBlockhash(); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  if (!ready) throw new Error('Validator did not become ready within 60 seconds');
  let code = browserLedger ? 0 : await command(process.execPath, ['--test', '--test-concurrency=1', ...suites[suite].map(name => `protocol-tests/${name}.test.mjs`)]);
  if (code === 0 && suite === 'full' && !browserLedger) code = await command(process.execPath, ['scripts/measure-protocol.mjs']);
  if (code === 0 && suite==='bondops' && process.argv.includes('--ui')) code = await command('npx', ['playwright', 'test', '--config', 'playwright.bondops-live.config.ts'], { CI:'1' });
  if (code === 0 && suite==='full' && process.argv.includes('--ui')) code = await command('npx', ['playwright', 'test', '--config', 'playwright.protocol.config.ts'], { CI: '1' });
  if (code === 0 && suite==='full' && process.argv.includes('--ui')) {
    code = await command('npm', ['run', 'build:next'], { NEXT_PUBLIC_SOLANA_RPC_URL: rpcUrl, NEXT_TELEMETRY_DISABLED: '1' });
    if (code === 0) code = await command('npx', ['playwright', 'test', '--config', 'playwright.next.config.ts'], { CI: '1' });
  }
  process.exitCode = code;
} finally { stop(); console.log(`Local validator ledger retained at ${ledger}`); }
