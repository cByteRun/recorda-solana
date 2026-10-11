// Human Phantom acceptance: no injected provider, exported keys, or automatic signing.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect as baseExpect } from '@playwright/test';
import { PublicKey } from '@solana/web3.js';
import { getAccount, getMint, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { devnetConnection } from './devnet.mjs';
import { readChainClock, waitForRecordDate } from '../src/shared/solana/chain-clock.mjs';
import { protocolStage } from './protocol-stage.mjs';

const holders = ['A', 'B', 'C'].map(name => {
  const value = process.env[`RECORDA_HOLDER_${name}`];
  assert.ok(value, `Set RECORDA_HOLDER_${name} to a real Phantom holder public address`);
  return new PublicKey(value).toBase58();
});
assert.equal(new Set(holders).size, 3, 'Holder addresses must be distinct');
assert.ok(process.env.VITE_RECORDA_PROGRAM_ID, 'Set VITE_RECORDA_PROGRAM_ID to the deployed current program');
const programId = new PublicKey(process.env.VITE_RECORDA_PROGRAM_ID);
assert.equal(programId.toBase58(), JSON.parse(readFileSync('src/shared/solana/idl/recorda.json', 'utf8')).address);
const rpc = await devnetConnection(); // Refuses mainnet even if an RPC variable is wrong.
assert.ok((await rpc.getAccountInfo(programId))?.executable, 'Program not deployed');
for (const holder of holders) assert.ok(await rpc.getBalance(new PublicKey(holder)) > 0, `Fund holder ${holder} with Devnet SOL`);
const voteSeconds = Number(process.env.RECORDA_VOTE_SECONDS || 900);
assert.ok(Number.isInteger(voteSeconds) && voteSeconds >= 300 && voteSeconds <= 3600, 'RECORDA_VOTE_SECONDS must be 300..3600');
const origin = process.env.RECORDA_APP_URL || 'http://localhost:4444';
const runId = String(Date.now());
const output = `target/devnet-evidence/actions-${runId}`;
mkdirSync(output, { recursive: true });
const evidence = { passed: false, scope: 'Human Phantom Coupon → Voting → Full Redemption; 10/5/2/0, no post-record transfers; not Post-MVP acceptance', program: programId.toBase58(), holders, actions: [], startedAt: new Date().toISOString() };
const save = () => writeFileSync(`${output}/run.json`, JSON.stringify(evidence, null, 2) + '\n');
save();
const browser = await chromium.connectOverCDP(process.env.RECORDA_BROWSER_CDP || 'http://127.0.0.1:9222');
const page = await browser.contexts()[0].newPage();
page.setDefaultTimeout(600_000);
const expect = baseExpect.configure({ timeout: 600_000 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function idle() {
  await expect(page.getByTestId('actions-root')).toHaveAttribute('data-busy', 'false');
  const alerts = await page.getByRole('alert').allTextContents();
  assert.deepEqual(alerts, [], 'UI reported an error; inspect chain before retrying');
}
async function click(name, target) {
  console.log(`Stage: ${name} — confirm all Phantom prompts`);
  await page.getByRole('button', { name, exact: true }).click();
  await idle();
  if (target) await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state', target);
}
async function wallet(address) {
  console.log(`Switch Phantom to ${address}, unlock it. Waiting for that exact account…`);
  // A navigation creates a new provider which may not expose publicKey until connect().
  await page.getByRole('button', { name: /^(Connect Phantom|Wallet )/ }).click();
  await idle();
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    const active = await page.evaluate(() => (window.phantom?.solana ?? window.solana)?.publicKey?.toBase58());
    if (active === address) {
      await page.getByRole('button', { name: /^(Connect Phantom|Wallet )/ }).click();
      await idle();
      await expect(page.getByRole('button', { name: `Wallet ${address}`, exact: true })).toBeVisible();
      return;
    }
    await sleep(1000);
  }
  throw Error(`Timed out waiting for holder ${address}`);
}
async function report() {
  return page.evaluate(async () => {
    const { connection } = await import('/src/shared/solana/config.ts');
    const { createActionsV2, auditActionsV2, stageV2 } = await import('/src/shared/solana/actions-v2.ts');
    const { RECORDA_PROGRAM_ID } = await import('/src/shared/solana/protocol.ts');
    const Key = RECORDA_PROGRAM_ID.constructor;
    const address = new Key(document.querySelector('[aria-label="Action PDA"]').value);
    const client = createActionsV2(connection), r = await client.read(address);
    const audit = await auditActionsV2(address, r);
    return {
      address: address.toBase58(), instrument: r.action.instrument.toBase58(), mint: r.instrument.mint.toBase58(),
      paymentMint: r.instrument.paymentMint.toBase58(), state: stageV2(r.action), issues: audit.issues,
      supply: r.mintSupply.toString(), outstanding: r.instrument.outstandingSupply.toString(), redeemed: r.instrument.redeemed,
      total: r.action.total.toString(), yes: r.action.yes.toString(), no: r.action.no.toString(), abstain: r.action.abstain.toString(),
      passed: r.action.passed, quorumMet: r.action.quorumMet, vault: r.vault?.amount.toString() ?? null,
      receipt: r.receipt ? client.pdas.receipt(address).toBase58() : null,
      rights: r.rights.map(({ account: a }) => ({ holder: a.holder.toBase58(), units: a.units.toString(), retire: a.retireUnits.toString(), principal: a.principal.toString(), coupon: a.coupon.toString(), total: a.total.toString(), processed: a.processed, destination: a.destination.toBase58() })),
      signatures: r.signatures
    };
  });
}
async function balances(paymentMint) {
  const result = [];
  for (const holder of holders) {
    const ata = getAssociatedTokenAddressSync(new PublicKey(paymentMint), new PublicKey(holder), false, TOKEN_2022_PROGRAM_ID);
    result.push((await rpc.getAccountInfo(ata)) ? (await getAccount(rpc, ata, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount : 0n);
  }
  return result;
}
function assertRights(r, kind) {
  assert.deepEqual(r.issues, []);
  assert.equal(r.rights.length, 4);
  holders.forEach((holder, i) => {
    const right = r.rights.find(a => a.holder === holder), units = [10, 5, 2][i];
    assert.ok(right);
    assert.equal(right.units, String(units));
    assert.equal(right.retire, String(kind === 'redemption' ? units : 0));
    assert.equal(right.principal, String(kind === 'redemption' ? units * 100000 : 0));
    assert.equal(right.coupon, String(kind === 'voting' ? 0 : units * 5000));
    assert.equal(right.total, String(kind === 'redemption' ? units * 105000 : kind === 'coupon' ? units * 5000 : 0));
  });
  const zero = r.rights.filter(a => !holders.includes(a.holder));
  assert.equal(zero.length, 1);
  assert.equal(zero[0].units, '0');
  assert.equal(zero[0].total, '0');
}
function localDate(seconds) {
  // datetime-local is interpreted in the browser's timezone, not the Node timezone.
  return page.evaluate(seconds => {
    const d = new Date(seconds * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  }, Number(seconds));
}
async function finalized(kind) {
  const r = await report();
  assertRights(r, kind);
  assert.equal(r.state, 'finalized');
  assert.ok(r.receipt);
  // New page/controller without connection state: chain recovery and wallet-free audit.
  const audit = await browser.contexts()[0].newPage();
  try {
    await audit.goto(`${origin}/actions?action=${r.address}`);
    await expect(audit.getByTestId('actions-root')).toHaveAttribute('data-busy', 'false');
    await expect(audit.getByText('Audit: Verified', { exact: true })).toBeVisible();
    await expect(audit.getByTestId('actions-root')).toHaveAttribute('data-state', 'finalized');
    await expect(audit.getByRole('button', { name: 'Sign atomic burn and payment' })).toHaveCount(0);
    await audit.screenshot({ path: `${output}/${kind}.png`, fullPage: true });
  } finally { await audit.close(); }
  evidence.actions.push(r); save();
  return r;
}

try {
  await page.goto(`${origin}/protocol`);
  const config = await page.evaluate(async () => {
    const { connection } = await import('/src/shared/solana/config.ts');
    const { RECORDA_PROGRAM_ID } = await import('/src/shared/solana/protocol.ts');
    return { rpc: connection.rpcEndpoint, program: RECORDA_PROGRAM_ID.toBase58() };
  });
  assert.equal(config.rpc, rpc.rpcEndpoint); assert.equal(config.program, programId.toBase58());
  console.log('Connect OPERATOR in Phantom on Devnet. This run creates a NEW instrument; no automatic payment retries.');
  await page.getByRole('button', { name: 'Connect Phantom', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create / resume demo instrument' })).toBeEnabled();
  const operator = await page.evaluate(() => (window.phantom?.solana ?? window.solana).publicKey.toBase58());
  assert.ok(!holders.includes(operator), 'Use a separate Operator wallet');
  evidence.operator = operator; evidence.genesis = await rpc.getGenesisHash(); save();
  assert.ok(await rpc.getBalance(new PublicKey(operator)) > 0, 'Fund Operator with Devnet SOL');
  const maturity = (await readChainClock(rpc)).timestamp + 180n;
  await page.getByLabel('Demo instrument ID', { exact: true }).fill(runId);
  await page.getByLabel('Optional demo maturity (ISO UTC)', { exact: true }).fill(new Date(Number(maturity) * 1000).toISOString());
  for (const [i, name] of ['A', 'B', 'C'].entries()) await page.getByLabel(`Optional holder ${name} public address`, { exact: true }).fill(holders[i]);
  await protocolStage(page, 'Create / resume demo instrument', undefined, { timeout: 600_000 });
  const instrument = await page.getByLabel('Instrument PDA', { exact: true }).inputValue();
  evidence.instrument = instrument; save();
  const proposal = 'Recorda Devnet acceptance: keep maturity unchanged.';
  for (const kind of ['coupon', 'voting', 'redemption']) {
    if (kind === 'redemption') await waitForRecordDate(rpc, maturity);
    await page.goto(`${origin}/actions?instrument=${instrument}`);
    await idle(); await wallet(operator);
    await page.getByLabel('Role', { exact: true }).selectOption('Operator');
    await page.getByLabel('Action kind', { exact: true }).selectOption(kind);
    const recordAt = (await readChainClock(rpc)).timestamp + 60n;
    await page.getByLabel('Record date', { exact: true }).fill(await localDate(recordAt));
    const opens = recordAt + 60n, closes = opens + BigInt(voteSeconds);
    if (kind === 'voting') {
      await page.getByLabel('Proposal', { exact: true }).fill(proposal);
      await page.getByLabel('Opens', { exact: true }).fill(await localDate(opens));
      await page.getByLabel('Closes', { exact: true }).fill(await localDate(closes));
      await page.getByLabel('Quorum bps', { exact: true }).fill('5000');
    } else {
      await page.getByLabel('Coupon period', { exact: true }).fill(kind === 'coupon' ? '1' : '2');
      if (kind === 'redemption') await page.getByRole('checkbox', { name: 'Include separate final coupon' }).check();
    }
    await click('Create action', 'scheduled');
    evidence.currentAction = await page.getByLabel('Action PDA', { exact: true }).inputValue(); save();
    if (kind !== 'voting') await click('Reserve coupon period', 'scheduled');
    await waitForRecordDate(rpc, recordAt);
    await click('Capture snapshot / resume', 'snapshotted');
    await click('Calculate rights / resume', 'awaitingApproval');
    let r = await report(); assertRights(r, kind);
    await click('Approve action', 'approved');
    if (kind === 'voting') {
      await waitForRecordDate(rpc, opens);
      await page.getByLabel('Role', { exact: true }).selectOption('Investor');
      for (const [i, choice] of ['YES', 'NO', 'ABSTAIN'].entries()) {
        await wallet(holders[i]);
        await page.getByLabel('Proposal document to verify', { exact: true }).fill(proposal);
        await click('Verify proposal document');
        await click(choice, 'approved');
        r = await report();
        assert.equal(r[['yes', 'no', 'abstain'][i]], String([10, 5, 2][i]));
        await expect(page.getByRole('button', { name: choice, exact: true })).toHaveCount(0);
      }
      await wallet(operator); await page.getByLabel('Role', { exact: true }).selectOption('Operator');
      console.log(`Waiting for voting close at ${new Date(Number(closes) * 1000).toISOString()}`);
      await waitForRecordDate(rpc, closes, { timeoutMs: (voteSeconds + 120) * 1000 });
      await click('Finalize vote tally', 'settled');
    } else {
      const before = await balances(r.paymentMint);
      await click('Fund mock payment vault', 'funded');
      if (kind === 'coupon') {
        for (const right of r.rights) await click(`Settle ${right.holder}`);
      } else {
        await page.getByLabel('Role', { exact: true }).selectOption('Investor');
        for (const [i, holder] of holders.entries()) {
          await wallet(holder); await click('Sign atomic burn and payment');
          const progress = await report();
          assert.equal(progress.supply, String([7, 2, 0][i]));
          assert.equal((await getMint(rpc, new PublicKey(r.mint), 'confirmed', TOKEN_2022_PROGRAM_ID)).supply, BigInt([7, 2, 0][i]));
        }
        await wallet(operator); await page.getByLabel('Role', { exact: true }).selectOption('Operator');
        const zero = r.rights.find(a => !holders.includes(a.holder));
        await click(`Complete zero allocation ${zero.holder}`);
      }
      const after = await balances(r.paymentMint);
      assert.deepEqual(after.map((amount, i) => String(amount - before[i])), kind === 'coupon' ? ['50000', '25000', '10000'] : ['1050000', '525000', '210000']);
      evidence.paymentDeltas = { ...(evidence.paymentDeltas || {}), [kind]: after.map((amount, i) => String(amount - before[i])) }; save();
      await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state', 'settled');
    }
    await click('Finalize receipt', 'finalized');
    r = await finalized(kind);
    assert.equal(r.supply, kind === 'redemption' ? '0' : '17');
    assert.equal(r.outstanding, r.supply); assert.equal(r.redeemed, kind === 'redemption');
    if (kind === 'voting') { assert.equal(r.passed, true); assert.equal(r.quorumMet, true); assert.equal(r.vault, null); }
    else { assert.equal(r.total, kind === 'coupon' ? '85000' : '1785000'); assert.ok(r.rights.every(a => a.processed)); }
  }
  assert.deepEqual(errors, []);
  evidence.passed = true; evidence.finishedAt = new Date().toISOString(); save();
  console.log(`PASS: all three actions on one Devnet instrument. Evidence: ${output}/run.json`);
} catch (error) {
  evidence.error = error.message; evidence.failedAt = new Date().toISOString(); evidence.url = page.url(); save();
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  console.error(`FAIL: inspect ${output}/run.json and current Action URL. A rerun creates a new instrument; reconcile this run before retrying. No automatic resume.`);
  throw error;
} finally { await browser.close(); }
