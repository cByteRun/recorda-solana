import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Connection } from '@solana/web3.js';
const idl = JSON.parse(readFileSync('src/shared/solana/idl/recorda.json'));
if (!existsSync('target/deploy/recorda.so')) throw new Error('Run npm run protocol:build first');
// A failed new run must not leave previous success evidence looking current.
for (const name of ['coupon.json', 'coupon-ui.json', 'coupon-ui.png']) rmSync(`target/protocol-evidence/${name}`, { force: true });
const ledger = mkdtempSync(join(tmpdir(), 'recorda-phase1-'));
const rpcUrl = 'http://127.0.0.1:18899';
const validator = spawn('solana-test-validator', ['--ledger', ledger, '--bpf-program', idl.address, 'target/deploy/recorda.so', '--rpc-port', '18899', '--faucet-port', '19900', '--bind-address', '127.0.0.1', '--quiet'], { stdio: 'inherit' });
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
  let code = await command(process.execPath, ['--test', 'protocol-tests/coupon.test.mjs']);
  if (code === 0 && process.argv.includes('--ui')) code = await command('npx', ['playwright', 'test', '--config', 'playwright.protocol.config.ts'], { CI: '1' });
  process.exitCode = code;
} finally { stop(); console.log(`Local validator ledger retained at ${ledger}`); }
