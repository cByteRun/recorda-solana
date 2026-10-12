// Human Phantom acceptance: no injected provider, exported keys, or automatic signing.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect as baseExpect } from '@playwright/test';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getMint, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { devnetConnection } from './devnet.mjs';
import { readChainClock, waitForRecordDate } from '../src/shared/solana/chain-clock.mjs';
import { protocolStage } from './protocol-stage.mjs';
import { actionsStage } from './actions-stage.mjs';
import { waitForDevnetWallet } from './devnet-wallet.mjs';
const args = process.argv.slice(2);
const local = args[0] === '--local';
if (local) args.shift();
const workspace = local ? 'test' : 'devnet';

const holders = ['A', 'B', 'C'].map(name => {
  const value = process.env[`RECORDA_HOLDER_${name}`];
  assert.ok(value, `Set RECORDA_HOLDER_${name} in .env.local to a real Phantom holder public address`);
  return new PublicKey(value).toBase58();
});
assert.equal(new Set(holders).size, 3, 'Holder addresses must be distinct');
assert.ok(process.env.VITE_RECORDA_PROGRAM_ID, 'Set VITE_RECORDA_PROGRAM_ID in .env.local to the deployed current program');
const programId = new PublicKey(process.env.VITE_RECORDA_PROGRAM_ID);
assert.equal(programId.toBase58(), JSON.parse(readFileSync('src/shared/solana/idl/recorda.json', 'utf8')).address);
let rpc;
if (local) {
  const endpoint = process.env.VITE_LOCAL_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
  const url = new URL(endpoint);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.protocol === 'http:', 'Local runner requires a loopback HTTP RPC');
  rpc = new Connection(endpoint, 'confirmed');
  assert.ok(!['EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'].includes(await rpc.getGenesisHash()), 'Local RPC must not proxy Devnet or Mainnet');
} else rpc = await devnetConnection(); // Refuses mainnet even if an RPC variable is wrong.
assert.ok((await rpc.getAccountInfo(programId))?.executable, 'Program not deployed');
async function ensureLocalFees(key) {
  if (!local || await rpc.getBalance(key) >= 100_000_000) return;
  const signature = await rpc.requestAirdrop(key, 2_000_000_000);
  for (let attempt = 0; attempt < 40; attempt++) {
    const {value:[status]} = await rpc.getSignatureStatuses([signature]);
    assert.ok(!status?.err, `Local airdrop failed: ${signature}`);
    if (['confirmed','finalized'].includes(status?.confirmationStatus)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error(`Local airdrop confirmation unknown; inspect ${signature} before retrying`);
}
for (const holder of holders) {
  await ensureLocalFees(new PublicKey(holder));
  assert.ok(await rpc.getBalance(new PublicKey(holder)) > 0, `Fund holder ${holder} with test SOL`);
}
const voteSeconds = Number(process.env.RECORDA_VOTE_SECONDS || 900);
assert.ok(Number.isInteger(voteSeconds) && voteSeconds >= 300 && voteSeconds <= 3600, 'RECORDA_VOTE_SECONDS must be 300..3600');
const origin = process.env.RECORDA_APP_URL || 'http://localhost:4444';
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--resume'), 'Usage: npm run test:e2e:actions:devnet (or :local) -- [--resume path/to/run.json]');
const resume = args.length ? JSON.parse(readFileSync(args[1], 'utf8')) : null;
const completedCoupon = resume?.actions?.length === 1;
if (resume) {
  assert.equal(resume.passed, false, 'Do not resume a successful run');
  assert.ok(Array.isArray(resume.actions) && resume.actions.length <= 1, 'Resume supports pre-payment Coupon or a finalized Coupon before Voting');
  if (completedCoupon) {
    assert.equal(resume.actions[0].kind, 'coupon');
    assert.equal(resume.actions[0].state, 'finalized');
    assert.equal(resume.actions[0].address, resume.currentAction);
  }
  assert.equal(resume.program, programId.toBase58());
  assert.deepEqual(resume.holders, holders);
  assert.equal(resume.genesis, await rpc.getGenesisHash());
  for (const field of ['operator', 'instrument', 'currentAction']) new PublicKey(resume[field]);
}
const runId = String(Date.now());
const output = `target/${local ? 'local' : 'devnet'}-evidence/actions-${runId}`;
mkdirSync(output, { recursive: true });
const evidence = { passed: false, workspace, scope: 'Real Phantom Coupon → Voting → Full Redemption; 10/5/2/0, no post-record transfers; not Post-MVP acceptance', program: programId.toBase58(), holders, actions: [], startedAt: new Date().toISOString() };
if (resume) evidence.resumedFrom = args[1];
const save = () => writeFileSync(`${output}/run.json`, JSON.stringify(evidence, null, 2) + '\n');
save();
const browser = await chromium.connectOverCDP(process.env.RECORDA_BROWSER_CDP || 'http://127.0.0.1:9222');
const page = (resume && browser.contexts()[0].pages().find(page => page.url().includes(resume.currentAction))) || await browser.contexts()[0].newPage();
await page.addInitScript(mode => sessionStorage.setItem('recorda-workspace', mode), workspace);
page.setDefaultTimeout(600_000);
const expect = baseExpect.configure({ timeout: 600_000 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function idle() {
  // A fresh actions route renders idle before its initial effect starts reading.
  // Do not let Connect run first and consume the controller's operation lock.
  if (new URL(page.url()).searchParams.has('action')) {
    await expect(page.getByTestId('actions-root')).toHaveAttribute('data-state', /^(scheduled|snapshotPending|snapshotted|awaitingApproval|approved|funded|executing|settled|finalized|cancelled)$/);
  }
  await expect(page.getByTestId('actions-root')).toHaveAttribute('data-busy', 'false');
  const alerts = await page.getByRole('alert').allTextContents();
  assert.deepEqual(alerts, [], 'UI reported an error; inspect chain before retrying');
}
async function click(name, target) {
  console.log(`Stage: ${name} — confirm all Phantom prompts`);
  await actionsStage(page, name, target);
}
async function wallet(address) {
  console.log(`Switch Phantom to ${address}, unlock it. Waiting for that exact account…`);
  // Display instructions before awaiting extension authorization.
  await waitForDevnetWallet(page, address);
  // Synchronize React even when the extension did not emit accountChanged.
  await page.getByRole('button', { name: /^(Connect Phantom|Reconnect Phantom|Wallet )/ }).click();
  await idle();
  await expect(page.getByRole('button', { name: `Wallet ${address}`, exact: true })).toBeVisible();
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
      kind: Object.keys(r.action.parameters.kind)[0], recordAt: r.action.parameters.recordAt.toString(), maturity: r.instrument.maturityTimestamp.toString(), paid: r.action.paid.toString(),
      address: address.toBase58(), instrument: r.action.instrument.toBase58(), mint: r.instrument.mint.toBase58(),
      paymentMint: r.instrument.paymentMint.toBase58(), state: stageV2(r.action), issues: audit.issues,
      supply: r.mintSupply.toString(), outstanding: r.instrument.outstandingSupply.toString(), redeemed: r.instrument.redeemed,
      total: r.action.total.toString(), yes: r.action.yes.toString(), no: r.action.no.toString(), abstain: r.action.abstain.toString(),
      passed: r.action.passed, quorumMet: r.action.quorumMet, vault: r.vault?.amount.toString() ?? null, periodReserved: !!r.period,
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
    const value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    // Chromium normalizes zero seconds away; Playwright requires that exact value.
    return value.endsWith(':00') ? value.slice(0, 16) : value;
  }, Number(seconds));
}
async function finalized(kind) {
  const r = await report();
  assertRights(r, kind);
  assert.equal(r.state, 'finalized');
  assert.ok(r.receipt);
  // New page/controller without connection state: chain recovery and wallet-free audit.
  const audit = await browser.contexts()[0].newPage();
  await audit.addInitScript(mode => sessionStorage.setItem('recorda-workspace', mode), workspace);
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
  await page.goto(resume ? `${origin}/actions?action=${resume.currentAction}` : `${origin}/protocol`);
  const config = await page.evaluate(async () => {
    const { connection } = await import('/src/shared/solana/config.ts');
    const { RECORDA_PROGRAM_ID } = await import('/src/shared/solana/protocol.ts');
    return { rpc: connection.rpcEndpoint, program: RECORDA_PROGRAM_ID.toBase58() };
  });
  assert.equal(config.rpc, rpc.rpcEndpoint); assert.equal(config.program, programId.toBase58());
  console.log(resume ? 'Reconciling existing Coupon. Only pre-payment or fully finalized Coupon may resume; no payment retries.' : `Connect OPERATOR in Phantom on ${local ? 'Localnet' : 'Devnet'}. This run creates a NEW instrument; no automatic payment retries.`);
  if (resume) await idle();
  await page.getByRole('button', { name: /^(Connect Phantom|Reconnect Phantom|Wallet )/ }).click();
  const operator = await page.evaluate(() => (window.phantom?.solana ?? window.solana).publicKey.toBase58());
  if (process.env.RECORDA_OPERATOR) assert.equal(operator, new PublicKey(process.env.RECORDA_OPERATOR).toBase58(), 'Select the RECORDA_OPERATOR account from .env.local in Phantom');
  assert.ok(!holders.includes(operator), 'Use a separate Operator wallet');
  evidence.operator = operator; evidence.genesis = await rpc.getGenesisHash(); save();
  await ensureLocalFees(new PublicKey(operator));
  assert.ok(await rpc.getBalance(new PublicKey(operator)) > 0, 'Fund Operator with Devnet SOL');
  let instrument, maturity;
  if (resume) {
    assert.equal(operator, resume.operator);
    await idle();
    const r = await report();
    assert.equal(r.address, resume.currentAction); assert.equal(r.instrument, resume.instrument);
    assert.equal(r.kind, 'coupon'); assert.deepEqual(r.issues, []);
    if (completedCoupon) {
      assert.equal(r.state, 'finalized'); assertRights(r, 'coupon');
      assert.equal(r.paid, '85000'); assert.equal(r.total, '85000');
      assert.ok(r.receipt); assert.ok(r.rights.every(right => right.processed));
      evidence.actions.push(r); evidence.paymentDeltas = resume.paymentDeltas;
    } else {
      assert.ok(['scheduled','snapshotPending','snapshotted','awaitingApproval','approved'].includes(r.state), 'Resume refuses payment/execution stages');
      assert.equal(r.vault, null, 'Resume refuses an existing vault; reconcile funding/payments manually');
      assert.equal(r.paid, '0'); assert.ok(r.rights.every(right => !right.processed));
    }
    assert.equal(r.supply, '17'); assert.equal(r.outstanding, '17'); assert.equal(r.redeemed, false);
    if (['snapshotted','awaitingApproval','approved'].includes(r.state)) {
      assert.equal(r.rights.length, 4);
      holders.forEach((holder,i) => assert.equal(r.rights.find(right => right.holder === holder)?.units, String([10,5,2][i])));
      assert.equal(r.rights.filter(right => !holders.includes(right.holder)).length, 1);
      assert.equal(r.rights.find(right => !holders.includes(right.holder)).units, '0');
    }
    instrument = r.instrument; maturity = BigInt(r.maturity);
    evidence.resumeCheckpoint = r; evidence.currentAction = r.address;
  } else {
    await expect(page.getByRole('button', { name: 'Create / resume demo instrument' })).toBeEnabled();
    const setupDisclosure = page.getByLabel('Demo instrument ID', { exact: true }).locator('xpath=ancestor::details[1]');
    if (await setupDisclosure.count() && await setupDisclosure.getAttribute('open') === null) await setupDisclosure.locator('summary').first().click();
    maturity = (await readChainClock(rpc)).timestamp + 180n;
    await page.getByLabel('Demo instrument ID', { exact: true }).fill(runId);
    await page.getByLabel('Optional demo maturity (ISO UTC)', { exact: true }).fill(new Date(Number(maturity) * 1000).toISOString());
    for (const [i, name] of ['A', 'B', 'C'].entries()) await page.getByLabel(`Optional holder ${name} public address`, { exact: true }).fill(holders[i]);
    await protocolStage(page, 'Create / resume demo instrument', undefined, { timeout: 600_000 });
    instrument = await page.getByLabel('Instrument PDA', { exact: true }).inputValue();
  }
  evidence.instrument = instrument; save();
  const proposal = `Recorda ${local ? 'Localnet' : 'Devnet'} acceptance: keep maturity unchanged.`;
  for (const kind of completedCoupon ? ['voting', 'redemption'] : ['coupon', 'voting', 'redemption']) {
    if (kind === 'redemption') await waitForRecordDate(rpc, maturity);
    const continuing = !!resume && kind === 'coupon';
    await page.goto(continuing ? `${origin}/actions?action=${resume.currentAction}` : `${origin}/actions?instrument=${instrument}`);
    await idle(); await wallet(operator);
    await page.getByLabel('Role', { exact: true }).selectOption('Operator');
    // Leave time for public RPC throttling and Phantom's confirmation screens.
    const recordAt = (await readChainClock(rpc)).timestamp + (local ? 60n : 240n);
    const opens = recordAt + 60n, closes = opens + BigInt(voteSeconds);
    if (!continuing) {
      await page.getByLabel('Action kind', { exact: true }).selectOption(kind);
      await page.getByLabel('Record date', { exact: true }).fill(await localDate(recordAt));
      if (kind === 'voting') {
        await page.getByLabel('Proposal', { exact: true }).fill(proposal);
        await page.getByLabel('Opens', { exact: true }).fill(await localDate(opens));
        await page.getByLabel('Closes', { exact: true }).fill(await localDate(closes));
        await page.getByLabel('Quorum percent', { exact: true }).fill('50');
      } else {
        await page.getByLabel('Coupon period', { exact: true }).fill(kind === 'coupon' ? '1' : '2');
        if (kind === 'redemption') await page.getByRole('checkbox', { name: 'Include separate final coupon' }).check();
      }
      await click('Create action', 'scheduled');
    }
    evidence.currentAction = await page.getByLabel('Action PDA', { exact: true }).inputValue(); save();
    let checkpoint = await report();
    if (checkpoint.state === 'scheduled' && kind !== 'voting' && !checkpoint.periodReserved) await click('Reserve coupon period', 'scheduled');
    if (['scheduled','snapshotPending'].includes(checkpoint.state)) {
      await waitForRecordDate(rpc, BigInt(checkpoint.recordAt));
      await click('Capture snapshot / resume', 'snapshotted');
    }
    checkpoint = await report();
    if (checkpoint.state === 'snapshotted') await click('Calculate rights / resume', 'awaitingApproval');
    let r = await report(); assertRights(r, kind);
    if (r.state === 'awaitingApproval') await click('Approve action', 'approved');
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
  console.log(`PASS: all three actions on one ${local ? 'Localnet' : 'Devnet'} instrument. Evidence: ${output}/run.json`);
} catch (error) {
  evidence.error = error.message; evidence.failedAt = new Date().toISOString(); evidence.url = page.url();
  evidence.browser = await page.evaluate(() => ({ state: document.querySelector('[data-testid="actions-root"]')?.getAttribute('data-state'), busy: document.querySelector('[data-testid="actions-root"]')?.getAttribute('data-busy'), role: document.querySelector('[aria-label="Role"]')?.value, alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent), wallet: (window.phantom?.solana ?? window.solana)?.publicKey?.toBase58() ?? null })).catch(() => null);
  evidence.chain = await report().catch(error => ({ error: error.message })); save();
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  console.error(`FAIL: inspect ${output}/run.json and current Action URL. A rerun creates a new instrument; reconcile this run before retrying. No automatic resume.`);
  throw error;
} finally { await browser.close(); }
