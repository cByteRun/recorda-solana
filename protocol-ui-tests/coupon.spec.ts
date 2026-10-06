import type { Recorda } from '../src/shared/solana/idl/recorda';
import { test, expect } from '@playwright/test';
import { Connection, Keypair, VersionedTransaction, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { readChainClock, waitForRecordDate } from '../src/shared/solana/chain-clock.mjs';
import { protocolStage } from '../scripts/protocol-stage.mjs';
const rpc = new Connection(process.env.RECORDA_TEST_RPC || 'http://127.0.0.1:8899', 'confirmed');
const expected = JSON.parse(readFileSync('golden/coupon-tz-section-22.json', 'utf8')).expected;

test('browser → real Anchor rights → explicit signed execution → receipt → independent reload', async ({ page }) => {
  test.setTimeout(420_000);
  const operator = Keypair.generate();
  const airdrop = await rpc.requestAirdrop(operator.publicKey, 10_000_000_000);
  await rpc.confirmTransaction({ signature: airdrop, ...await rpc.getLatestBlockhash() }, 'confirmed');
  const errors: string[] = [], signed: number[][] = [];
  let rejectSigningAt: number | undefined;
  page.on('pageerror', e => errors.push(e.message));
  await page.exposeFunction('protocolTestSign', (bytes: number[]) => {
    if (rejectSigningAt === signed.length + 1) { rejectSigningAt = undefined; throw new Error("Test wallet rejected the next holder payment"); }
    const transaction = VersionedTransaction.deserialize(Uint8Array.from(bytes));
    transaction.sign([operator]); signed.push(bytes);
    return [...transaction.serialize()];
  });
  await page.addInitScript(({ address }) => {
    const provider = {
      isPhantom: true, publicKey: undefined as unknown,
      async connect() {
        const modulePath = '/src/shared/solana/protocol.ts';
        const { RECORDA_PROGRAM_ID } = await import(/* @vite-ignore */ modulePath);
        const PublicKey = RECORDA_PROGRAM_ID.constructor;
        this.publicKey = new PublicKey(address);
        return { publicKey: this.publicKey };
      },
      async signTransaction(tx: { serialize(): Uint8Array; constructor: { deserialize(bytes: Uint8Array): unknown } }) {
        const result = await (window as unknown as { protocolTestSign(bytes: number[]): Promise<number[]> }).protocolTestSign([...tx.serialize()]);
        return tx.constructor.deserialize(Uint8Array.from(result));
      }
    };
    Object.assign(window, { phantom: { solana: provider } });
  }, { address: operator.publicKey.toBase58() });
  async function connectAs(address: string) {
    await page.evaluate(async nextAddress => {
      const modulePath = '/src/shared/solana/protocol.ts';
      const { RECORDA_PROGRAM_ID } = await import(/* @vite-ignore */ modulePath);
      const PublicKey = RECORDA_PROGRAM_ID.constructor;
      const provider = window.phantom!.solana!;
      provider.publicKey = new PublicKey(nextAddress);
      provider.connect = async () => ({ publicKey: new PublicKey(nextAddress) });
    }, address);
    await page.getByRole('button', { name: /^(Connect|Reconnect) Phantom$/ }).click();
    await expect(page.getByTestId('protocol-root')).toHaveAttribute('data-busy', 'false');
  }
  await page.goto('/protocol');
  await expect(page.getByTestId('protocol-boundary')).toContainText('Anchor PDA');
  await page.getByRole('button', { name: 'Connect Phantom' }).click();
  const setup = page.getByRole('button', { name: 'Create / resume demo instrument' });
  await expect(setup).toBeEnabled(); await setup.click();
  await expect(setup).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  const clock = await readChainClock(rpc);
  await page.getByLabel('Record timestamp (ISO UTC)').fill(new Date(Number(clock.timestamp + 8n) * 1000).toISOString());
  await page.getByRole('button', { name: 'Schedule coupon' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('SCHEDULED', { timeout: 30_000 });
  await expect(page.getByTestId('protocol-root')).toHaveAttribute('data-busy', 'false');
  const snapshot = page.getByRole('button', { name: 'Begin / resume snapshot → finalize' });
  await expect(snapshot).toBeDisabled();
  await expect(page.getByTestId('protocol-record-time')).toContainText('Waiting for record date on Solana');
  await waitForRecordDate(rpc, clock.timestamp + 8n, { timeoutMs: 120_000 });
  await expect(snapshot).toBeEnabled({ timeout: 20_000 });
  await protocolStage(page, 'Begin / resume snapshot → finalize', 'snapshotted', { timeout: 120_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('SNAPSHOTTED', { timeout: 45_000 });
  await protocolStage(page, 'Demo: A transfers 4 → B', undefined, { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Calculate protocol rights' })).toBeEnabled();
  await protocolStage(page, 'Calculate protocol rights', 'awaitingApproval', { timeout: 120_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('AWAITINGAPPROVAL', { timeout: 45_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('850.00');
  await expect(page.getByTestId('protocol-rights')).toContainText('500.00');
  await expect(page.getByTestId('protocol-rights')).toContainText('250.00');
  await expect(page.getByTestId('protocol-rights')).toContainText('100.00');
  await connectAs(Keypair.generate().publicKey.toBase58());
  await expect(page.getByText('This wallet is not the instrument authority. Reading remains available.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve in Phantom', exact: true })).toBeDisabled();
  await connectAs(operator.publicKey.toBase58());
  await expect(page.getByRole('button', { name: 'Approve in Phantom', exact: true })).toBeEnabled();
  const beforeApproval = signed.length;
  await protocolStage(page, 'Approve in Phantom', 'approved', { timeout: 60_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('APPROVED');
  expect(signed.length).toBe(beforeApproval + 1);
  await protocolStage(page, 'Fund vault with mock USD', 'funded', { timeout: 60_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('FUNDED');
  rejectSigningAt = signed.length + 2;
  await page.getByRole('button', { name: 'Settle / resume unpaid holders' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('EXECUTING', { timeout: 45_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('Processed: 1/4');
  await expect(page.getByRole('alert')).toContainText('Wallet signature was declined');
  await page.reload();
  await expect(page.getByTestId('protocol-summary')).toContainText('EXECUTING', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Settle / resume unpaid holders' })).toBeDisabled();
  await page.getByRole('button', { name: 'Connect Phantom' }).click();
  await protocolStage(page, 'Settle / resume unpaid holders', 'settled', { timeout: 60_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('SETTLED');
  await protocolStage(page, 'Finalize on-chain receipt', 'finalized', { timeout: 60_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('FINALIZED');
  await expect(page.getByTestId('protocol-audit')).toContainText('Mismatches: 0');
  await expect(page.getByTestId('protocol-audit')).toContainText('Snapshot hash: VERIFIED · Receipt hash: VERIFIED');
  const action = await page.getByTestId('protocol-action-input').inputValue();
  const signedBeforeRoles = signed.length;
  await page.getByRole('button', { name: 'Investor', exact: true }).click();
  await expect(page.getByText('No registered position for this wallet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settle / resume unpaid holders' })).toHaveCount(0);
  for (const [name, current, snapshot, due] of [['A', '6', '10', '500.00'], ['B', '9', '5', '250.00'], ['C', '2', '2', '100.00'], ['D', '0', '0', '0.00']]) {
    await page.getByRole('button', { name: `Demo ${name} · read-only`, exact: true }).click();
    await expect(page.getByText(/READ-ONLY DEMO/)).toBeVisible();
    const row = page.getByTestId('protocol-rights').locator('tbody tr');
    await expect(row).toHaveCount(1);
    await expect(row.locator('td').nth(1)).toHaveText(current);
    await expect(row.locator('td').nth(2)).toHaveText(snapshot);
    await expect(row.locator('td').nth(3)).toHaveText(`${due} Mock USD`);
    if (name === "D") await expect(row).toContainText("Zero entitlement · processed");
  }
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await expect(page.getByTestId('protocol-action-input')).toHaveValue(action);
  await expect(page.getByTestId('protocol-rights').locator('tbody tr')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Approve in Phantom', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('protocol-summary')).toContainText('850.00');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'target/protocol-evidence/coupon-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Operator', exact: true }).click();
  expect(signed.length).toBe(signedBeforeRoles);

  const holderKeys = await page.evaluate(() => JSON.parse(localStorage.getItem('recorda:protocol:disposable-holders:v1')!));
  // Use independent RPC to verify real credited tokens, not just rendered strings.
  const instrumentAddress = await page.getByLabel('Instrument PDA').inputValue();
  const idl = JSON.parse(readFileSync('src/shared/solana/idl/recorda.json', 'utf8'));
  const { Program } = await import('@coral-xyz/anchor');
  const program = new Program<Recorda>(idl as Recorda, { connection: rpc });
  const terms = await program.account['instrument'].fetch(new PublicKey(instrumentAddress));
  for (const [index, id] of ['A', 'B', 'C', 'D'].entries()) {
    const holder = Keypair.fromSecretKey(Uint8Array.from(holderKeys[index])).publicKey;
    const balance = await getAccount(rpc, getAssociatedTokenAddressSync(terms.paymentMint, holder, false, TOKEN_2022_PROGRAM_ID), 'confirmed', TOKEN_2022_PROGRAM_ID);
    expect(balance.amount).toBe(BigInt(expected.amountsMinor[id]));
  }
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/protocol?action=${action}`);
  await expect(page.getByTestId('protocol-summary')).toContainText('FINALIZED', { timeout: 20_000 });
  await expect(page.getByText('Payments and receipt are finalized.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve in Phantom' })).toBeDisabled();
  await expect(page.getByTestId('protocol-audit')).toContainText('Mismatches: 0');
  await expect(page.getByTestId('protocol-audit')).toContainText('Snapshot hash: VERIFIED · Receipt hash: VERIFIED');
  await expect(page.getByRole('link', { name: 'ActionReceipt PDA' })).toBeVisible();
  await expect(page.getByTestId('protocol-history')).toContainText('FINALIZED');
  mkdirSync('target/protocol-evidence', { recursive: true });
  await page.screenshot({ path: 'target/protocol-evidence/coupon-ui.png', fullPage: true });
  const receipt = PublicKey.findProgramAddressSync([Buffer.from('receipt'), new PublicKey(action).toBuffer()], new PublicKey(idl.address))[0];
  // Corrupt the read response only. No chain state is changed; the auditor must fail closed.
  await page.route('http://127.0.0.1:18899/**', async route => {
    const request = route.request().postDataJSON();
    if (request?.method !== 'getAccountInfo' || request.params?.[0] !== receipt.toBase58()) return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    const data = Buffer.from(body.result.value.data[0], 'base64');
    data[data.length - 1] ^= 1;
    body.result.value.data[0] = data.toString('base64');
    await route.fulfill({ response, json: body });
  });
  await page.getByRole('button', { name: 'Read chain / refresh' }).click();
  await expect(page.getByRole('alert')).toContainText('Receipt hash mismatch');
  await expect(page.getByTestId('protocol-audit')).toContainText('RECONCILIATION REQUIRED');
  await page.unroute('http://127.0.0.1:18899/**');
  await connectAs(Keypair.generate().publicKey.toBase58());
  await expect(page.getByRole('button', { name: 'Finalize on-chain receipt', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Investor', exact: true }).click();
  await expect(page.getByText('No registered position for this wallet.')).toBeVisible();
  await expect(page.getByTestId('protocol-rights').locator('tbody tr')).toHaveCount(0);
  const investorA = Keypair.fromSecretKey(Uint8Array.from(holderKeys[0])).publicKey.toBase58();
  await connectAs(investorA);
  const ownRow = page.getByTestId('protocol-rights').locator('tbody tr');
  await expect(ownRow).toHaveCount(1);
  await expect(ownRow.locator('td').nth(1)).toHaveText('6');
  await expect(ownRow.locator('td').nth(2)).toHaveText('10');
  await expect(ownRow.locator('td').nth(3)).toHaveText('500.00 Mock USD');
  await expect(page.getByText(/READ-ONLY DEMO/)).toHaveCount(0);
  expect(signed.length).toBe(signedBeforeRoles);
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await expect(page.getByTestId('protocol-rights').locator('tbody tr')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Settle / resume unpaid holders', exact: true })).toHaveCount(0);
  await page.route('http://127.0.0.1:18899/**', async route => {
    const request = route.request().postDataJSON();
    if (request?.method !== 'getAccountInfo' || request.params?.[0] !== action) return route.continue();
    const response = await route.fetch(), body = await response.json();
    body.result.value.owner = SystemProgram.programId.toBase58();
    await route.fulfill({ response, json: body });
  });
  await page.getByRole('button', { name: 'Read chain / refresh' }).click();
  await expect(page.getByRole('alert')).toContainText('not owned by the Recorda program');
  await expect(page.getByTestId('protocol-summary')).toHaveCount(0);
  expect(errors).toEqual([]);
  writeFileSync('target/protocol-evidence/coupon-ui.json', JSON.stringify({ network: 'local-validator', action, verifiedAt: new Date().toISOString(), checks: ['TZ golden payouts', 'partial signing rejection', 'reload and once-only resume', 'independent snapshot and receipt hash', 'read-only history', 'Coupon role amounts and action preservation', 'connected and unknown Investor wallets', 'unauthorized approval disabled', 'no extra role-switch signatures', 'mobile overflow', 'zero entitlement processed', 'corrupted receipt rejected', 'wrong program account owner rejected'], pageErrors: errors }, null, 2) + '\n');
});
