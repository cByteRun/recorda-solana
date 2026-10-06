import type { Recorda } from '../src/shared/solana/idl/recorda';
import { test, expect } from '@playwright/test';
import { Connection, Keypair, VersionedTransaction, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const rpc = new Connection(process.env.RECORDA_TEST_RPC || 'http://127.0.0.1:8899', 'confirmed');
const expected = JSON.parse(readFileSync('golden/coupon-tz-section-22.json', 'utf8')).expected;

test('browser → real Anchor rights → explicit signed execution → receipt → independent reload', async ({ page }) => {
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
        const modulePath = '/node_modules/.vite/deps/@solana_web3__js.js';
        const { PublicKey } = await import(/* @vite-ignore */ modulePath);
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
  await page.goto('/protocol');
  await expect(page.getByTestId('protocol-boundary')).toContainText('Anchor PDA');
  await page.getByRole('button', { name: 'Connect Phantom' }).click();
  const setup = page.getByRole('button', { name: 'Create / resume demo instrument' });
  await expect(setup).toBeEnabled(); await setup.click();
  await expect(setup).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Record timestamp (ISO UTC)').fill(new Date(Date.now() + 4000).toISOString());
  await page.getByRole('button', { name: 'Schedule coupon' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('SCHEDULED', { timeout: 30_000 });
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'Begin / resume snapshot → finalize' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('SNAPSHOTTED', { timeout: 45_000 });
  await page.getByRole('button', { name: 'Demo: A transfers 4 → B' }).click();
  await expect(page.getByRole('button', { name: 'Calculate protocol rights' })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Calculate protocol rights' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('AWAITINGAPPROVAL', { timeout: 45_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('850.00');
  await expect(page.getByTestId('protocol-rights')).toContainText('500.00');
  await expect(page.getByTestId('protocol-rights')).toContainText('250.00');
  await expect(page.getByTestId('protocol-rights')).toContainText('100.00');
  const beforeApproval = signed.length;
  await page.getByRole('button', { name: 'Approve in Phantom' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('APPROVED');
  expect(signed.length).toBe(beforeApproval + 1);
  await page.getByRole('button', { name: 'Fund vault with mock USD' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('FUNDED');
  rejectSigningAt = signed.length + 2;
  await page.getByRole('button', { name: 'Settle / resume unpaid holders' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('EXECUTING', { timeout: 45_000 });
  await expect(page.getByTestId('protocol-summary')).toContainText('Processed: 1/4');
  await expect(page.getByRole('alert')).toContainText('Test wallet rejected');
  await page.reload();
  await expect(page.getByTestId('protocol-summary')).toContainText('EXECUTING', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Settle / resume unpaid holders' })).toBeDisabled();
  await page.getByRole('button', { name: 'Connect Phantom' }).click();
  await page.getByRole('button', { name: 'Settle / resume unpaid holders' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('SETTLED', { timeout: 45_000 });
  await page.getByRole('button', { name: 'Finalize on-chain receipt' }).click();
  await expect(page.getByTestId('protocol-summary')).toContainText('FINALIZED');
  await expect(page.getByTestId('protocol-audit')).toContainText('Mismatches: 0');
  await expect(page.getByTestId('protocol-audit')).toContainText('Snapshot hash: VERIFIED · Receipt hash: VERIFIED');
  const action = await page.getByTestId('protocol-action-input').inputValue();
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
  writeFileSync('target/protocol-evidence/coupon-ui.json', JSON.stringify({ network: 'local-validator', action, verifiedAt: new Date().toISOString(), checks: ['TZ golden payouts', 'partial signing rejection', 'reload and once-only resume', 'independent snapshot and receipt hash', 'read-only history', 'corrupted receipt rejected', 'wrong program account owner rejected'], pageErrors: errors }, null, 2) + '\n');
});
