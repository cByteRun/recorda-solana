import test from 'node:test';
import assert from 'node:assert/strict';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { airdrop, DEVNET_GENESIS } from './devnet.mjs';
import { createDevnetRpcFetch } from './devnet-rpc-fetch.mjs';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Devnet env loader honors shell > .env.local > .env without evaluating shell syntax', () => {
  const directory = mkdtempSync(join(tmpdir(), 'recorda-env-'));
  try {
    writeFileSync(join(directory, '.env'), 'RECORDA_ENV_PRIORITY=base\nRECORDA_ENV_BASE=base\n');
    writeFileSync(join(directory, '.env.local'), 'RECORDA_ENV_PRIORITY=local\nRECORDA_ENV_LOCAL="quoted value"\nRECORDA_ENV_LITERAL="$(echo unsafe)"\nRECORDA_ENV_SHELL=file\n');
    const loader = new URL('./load-devnet-env.mjs', import.meta.url).href;
    const env = { ...process.env, RECORDA_ENV_SHELL: 'shell' };
    delete env.NODE_TEST_CONTEXT; // Child is a normal CLI process, not a nested test worker.
    for (const key of ['RECORDA_ENV_PRIORITY', 'RECORDA_ENV_BASE', 'RECORDA_ENV_LOCAL', 'RECORDA_ENV_LITERAL']) delete env[key];
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import {writeFileSync} from 'node:fs'; import {loadDevnetEnv} from ${JSON.stringify(loader)}; loadDevnetEnv(); writeFileSync('observed.json', JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith('RECORDA_ENV_')))));`], { cwd: directory, env, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'observed.json'), 'utf8')), { RECORDA_ENV_SHELL: 'shell', RECORDA_ENV_PRIORITY: 'local', RECORDA_ENV_LOCAL: 'quoted value', RECORDA_ENV_LITERAL: '$(echo unsafe)', RECORDA_ENV_BASE: 'base' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Devnet env files are optional for existing shell-based invocations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'recorda-env-'));
  try {
    const loader = new URL('./load-devnet-env.mjs', import.meta.url).href;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import {loadDevnetEnv} from ${JSON.stringify(loader)}; loadDevnetEnv();`], { cwd: directory, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('web3 account read survives fetch failed through configured transport', async () => {
  let calls = 0;
  const rpc = new Connection('http://localhost:8899', { commitment: 'confirmed', disableRetryOnRateLimit: true,
    fetch: createDevnetRpcFetch({ wait: async () => {}, onRetry: () => {}, fetcher: async (_input, init) => {
      const request = JSON.parse(init.body);
      if (++calls === 1) throw new TypeError('fetch failed');
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { context: { slot: 1 }, value: null } }), { headers: { 'content-type': 'application/json' } });
    } }) });
  assert.equal(await rpc.getAccountInfo(Keypair.generate().publicKey), null);
  assert.equal(calls, 2);
});
test('RPC retries transient account reads and serializes concurrent requests', async () => {
  let calls = 0, active = 0, peak = 0;
  const fetch = createDevnetRpcFetch({ wait: async () => {}, onRetry: () => {}, fetcher: async () => {
    peak = Math.max(peak, ++active);
    await Promise.resolve(); active--;
    if (++calls === 1) throw new TypeError('fetch failed');
    if (calls === 2) return new Response('', { status: 503 });
    return new Response('{}');
  } });
  await Promise.all([1, 2].map(() => fetch('http://rpc', { body: JSON.stringify({ method: 'getAccountInfo' }) })));
  assert.equal(calls, 4); assert.equal(peak, 1);
});
test('RPC bounds retries and never retries sendTransaction or requestAirdrop', async () => {
  for (const [method, expected] of [['getAccountInfo', 4], ['sendTransaction', 1], ['requestAirdrop', 1]]) {
    let calls = 0;
    const fetch = createDevnetRpcFetch({ wait: async () => {}, onRetry: () => {}, fetcher: async () => { calls++; throw new TypeError('fetch failed'); } });
    await assert.rejects(fetch('http://rpc', { body: JSON.stringify({ method }) }), /fetch failed/);
    assert.equal(calls, expected);
  }
});
const address = Keypair.generate().publicKey;
test('airdrop refuses a non-Devnet network before requesting funds', async () => {
  await assert.rejects(airdrop({ getGenesisHash: async () => 'mainnet', requestAirdrop: () => assert.fail('must not send') }, address), /Expected Solana Devnet/);
});
test('airdrop checks confirmed faucet signature and returns public balance', async () => {
  const result = await airdrop({
    getGenesisHash: async () => DEVNET_GENESIS,
    requestAirdrop: async (key, amount) => { assert.ok(key.equals(address)); assert.equal(amount, LAMPORTS_PER_SOL); return 'faucet-signature'; },
    getSignatureStatuses: async (signatures, options) => { assert.deepEqual(signatures, ['faucet-signature']); assert.equal(options.searchTransactionHistory, true); return { value: [{ err: null, confirmationStatus: 'confirmed' }] }; },
    getBalance: async () => LAMPORTS_PER_SOL
  }, address);
  assert.deepEqual(result, { signature: 'faucet-signature', address: address.toBase58(), balanceLamports: LAMPORTS_PER_SOL });
});
test('failed faucet transaction is not accepted as funding', async () => {
  await assert.rejects(airdrop({ getGenesisHash: async () => DEVNET_GENESIS, requestAirdrop: async () => 'failed', getSignatureStatuses: async () => ({ value: [{ err: 'failure', confirmationStatus: 'confirmed' }] }), getBalance: () => assert.fail('must not report success') }, address), /Airdrop failed/);
});
