// Human-signed Phase 1 acceptance. No injected provider, private key or RPC interception.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium, expect as baseExpect } from '@playwright/test';
import { PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { TOKEN_2022_PROGRAM_ID, getAccount, getMint, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { devnetConnection } from './devnet.mjs';

const output = 'target/devnet-evidence';
mkdirSync(output, { recursive: true });
rmSync(`${output}/coupon.json`, { force: true });
rmSync(`${output}/coupon.png`, { force: true });
if (!process.env.VITE_RECORDA_PROGRAM_ID) throw new Error('Set VITE_RECORDA_PROGRAM_ID to the deployed Devnet program');
const programId = new PublicKey(process.env.VITE_RECORDA_PROGRAM_ID);
const idl = JSON.parse(readFileSync('src/shared/solana/idl/recorda.json', 'utf8'));
assert.equal(programId.toBase58(), idl.address, 'Expected the Recorda program ID from the synchronized generated IDL; ComputeBudget/Associated Token addresses and token mint addresses are not Recorda');
const rpc = await devnetConnection();
assert.ok((await rpc.getAccountInfo(programId))?.executable, 'Recorda program is not deployed on Devnet');
const program = new Program({ ...idl, address: programId.toBase58() }, { connection: rpc });
const fixture = JSON.parse(readFileSync('golden/coupon-tz-section-22.json', 'utf8'));
const browser = await chromium.connectOverCDP(process.env.RECORDA_BROWSER_CDP || 'http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const expect = baseExpect.configure({ timeout: 300_000 });
const origin = process.env.RECORDA_APP_URL || 'http://localhost:4444';
try {
  await page.goto(`${origin}/protocol`);
  // Vite development modules expose only public runtime configuration.
  const config = await page.evaluate(async () => {
    const { connection } = await import('/src/shared/solana/config.ts');
    const { RECORDA_PROGRAM_ID } = await import('/src/shared/solana/protocol.ts');
    return { rpc: connection.rpcEndpoint, program: RECORDA_PROGRAM_ID.toBase58() };
  });
  assert.equal(config.rpc, rpc.rpcEndpoint, 'Browser and verifier RPC must match');
  assert.equal(config.program, programId.toBase58(), 'Browser and verifier program must match');
  console.log('Connect/unlock Phantom on Devnet. Review and confirm each transaction prompt; allow up to 5 minutes per stage.');
  await page.getByRole('button', { name: 'Connect Phantom', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create / resume demo instrument' })).toBeEnabled();
  const operator = await page.evaluate(() => window.phantom.solana.publicKey.toBase58());
  const operatorBalanceLamports = await rpc.getBalance(new PublicKey(operator));
  assert.ok(operatorBalanceLamports > 0, 'Operator wallet has no Devnet SOL for fees/account rent. Fund the wallet before replay.');
  console.log(`Operator Devnet balance: ${operatorBalanceLamports} lamports. No faucet request is made.`);
  // Each replay uses new PDAs and disposable demo holders, preserving prior evidence/cache.
  await page.getByLabel('Demo instrument ID', { exact: true }).fill(String(Date.now()));
  async function click(name, state) {
    console.log(`Stage: ${name} — confirm Phantom prompts`);
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(button).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    if (state) await expect(page.getByTestId('protocol-summary')).toContainText(state);
  }
  // Stage buttons usually become disabled after a transition, so await next state instead.
  async function transition(name, state) {
    console.log(`Stage: ${name} — confirm Phantom prompts`);
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByTestId('protocol-summary')).toContainText(state);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await click('Create / resume demo instrument');
  // Derive only public demo addresses inside the browser; never export holder secrets.
  const holderAddresses = await page.evaluate(async () => {
    const { Keypair } = await import('/node_modules/.vite/deps/@solana_web3__js.js');
    return JSON.parse(localStorage.getItem('recorda:protocol:disposable-holders:v1')).map(secret => Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey.toBase58());
  });
  await page.getByLabel('Record timestamp (ISO UTC)').fill(new Date(Date.now() + 60_000).toISOString());
  await transition('Schedule coupon', 'SCHEDULED');
  const actionAddress = new PublicKey(await page.getByTestId('protocol-action-input').inputValue());
  const scheduled = await program.account.corporateAction.fetch(actionAddress);
  while ((await rpc.getBlockTime(await rpc.getSlot())) < Number(scheduled.recordTimestamp.toString())) await new Promise(resolve => setTimeout(resolve, 1000));
  await transition('Begin / resume snapshot → finalize', 'SNAPSHOTTED');
  await click('Demo: A transfers 4 → B');
  await transition('Calculate protocol rights', 'AWAITINGAPPROVAL');
  await transition('Approve in Phantom', 'APPROVED');
  await transition('Fund vault with mock USD', 'FUNDED');
  const terms = await program.account.instrument.fetch(scheduled.instrument);
  assert.ok(terms.authority.equals(new PublicKey(operator)));
  assert.equal(terms.faceValueMinor.toString(), String(fixture.input.terms.faceValueMinor));
  assert.equal(terms.couponBps, fixture.input.terms.annualCouponBps);
  assert.equal(terms.paymentsPerYear, fixture.input.terms.paymentsPerYear);
  assert.equal((await getMint(rpc, terms.mint, 'confirmed', TOKEN_2022_PROGRAM_ID)).supply, BigInt(fixture.expected.supply));
  const captured = await program.account.entitlementPosition.all([{ memcmp: { offset: 8, bytes: actionAddress.toBase58() } }]);
  assert.equal(captured.length, 4);
  // RPC account order / snapshot capture order need not be A/B/C/D.
  const rights = holderAddresses.map(address => {
    const right = captured.find(r => r.account.holder.toBase58() === address);
    assert.ok(right, `Missing rights for demo holder ${address}`);
    return right;
  });
  const destinations = rights.map(r => getAssociatedTokenAddressSync(terms.paymentMint, r.account.holder, false, TOKEN_2022_PROGRAM_ID));
  const before = await Promise.all(destinations.map(async address => (await rpc.getAccountInfo(address)) ? (await getAccount(rpc, address, 'confirmed', TOKEN_2022_PROGRAM_ID)).amount : 0n));
  await transition('Settle / resume unpaid holders', 'SETTLED');
  await transition('Finalize on-chain receipt', 'FINALIZED');
  const actual = [];
  for (const [index, name] of Object.keys(fixture.input.snapshot).entries()) {
    const right = await program.account.entitlementPosition.fetch(rights[index].publicKey);
    const bond = PublicKey.findProgramAddressSync([Buffer.from('bond-account'), scheduled.instrument.toBuffer(), right.holder.toBuffer()], programId)[0];
    const current = await getAccount(rpc, bond, 'confirmed', TOKEN_2022_PROGRAM_ID);
    const after = await getAccount(rpc, destinations[index], 'confirmed', TOKEN_2022_PROGRAM_ID);
    assert.equal(right.snapshotUnits.toString(), String(fixture.input.snapshot[name]));
    assert.equal(current.amount, BigInt(fixture.expected.currentAfterTransfer[name]));
    assert.equal(right.amountMinor.toString(), String(fixture.expected.amountsMinor[name]));
    assert.equal(right.settledAmountMinor.toString(), String(fixture.expected.amountsMinor[name]));
    assert.equal(right.settled, true);
    assert.ok(right.destination.equals(destinations[index]));
    assert.equal(after.amount - before[index], BigInt(fixture.expected.amountsMinor[name]));
    actual.push({ name, holder: right.holder.toBase58(), destination: destinations[index].toBase58(), beforeMinor: before[index].toString(), afterMinor: after.amount.toString(), snapshotUnits: right.snapshotUnits.toString(), currentUnits: current.amount.toString(), amountMinor: right.amountMinor.toString() });
  }
  const receiptAddress = PublicKey.findProgramAddressSync([Buffer.from('receipt'), actionAddress.toBuffer()], programId)[0];
  const receipt = await program.account.actionReceipt.fetch(receiptAddress);
  assert.ok(receipt.action.equals(actionAddress));
  assert.ok('finalized' in receipt.finalStatus);
  assert.equal(receipt.settledTotalMinor.toString(), String(fixture.expected.totalMinor));
  assert.equal(receipt.processedHolders, 4);
  const signatures = await rpc.getSignaturesForAddress(actionAddress, { limit: 100 });
  const instrumentSignatures = await rpc.getSignaturesForAddress(scheduled.instrument, { limit: 100 });
  assert.ok(signatures.some(s => !s.err));
  // A new page cannot inherit the React controller's connected-wallet state.
  const auditContext = await browser.newContext();
  const audit = await auditContext.newPage();
  await audit.goto(`${origin}/protocol?action=${actionAddress}`);
  await expect(audit.getByTestId('protocol-summary')).toContainText('FINALIZED');
  await expect(audit.getByRole('button', { name: 'Approve in Phantom', exact: true })).toBeDisabled();
  await expect(audit.getByTestId('protocol-audit')).toContainText('Mismatches: 0');
  await expect(audit.getByTestId('protocol-audit')).toContainText('Snapshot hash: VERIFIED · Receipt hash: VERIFIED');
  assert.deepEqual(errors, []);
  await audit.screenshot({ path: `${output}/coupon.png`, fullPage: true });
  writeFileSync(`${output}/coupon.json`, JSON.stringify({ network: 'devnet', genesis: await rpc.getGenesisHash(), program: programId.toBase58(), operator, operatorBalanceLamports, fixture: fixture.id, action: actionAddress.toBase58(), instrument: scheduled.instrument.toBase58(), receipt: receiptAddress.toBase58(), actual, signatures, instrumentSignatures, verifiedAt: new Date().toISOString(), scope: 'Human Phantom-signed Phase 1 golden happy path; negative acceptance remains in local suites' }, null, 2) + '\n');
  await auditContext.close();
  console.log(`PASS: Devnet golden payouts, immutable rights, receipt and read-only audit. Evidence: ${output}/coupon.json`);
} finally {
  await browser.close(); // Disconnect CDP; user's Chrome remains open.
}
