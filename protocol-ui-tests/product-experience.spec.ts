import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Connection, PublicKey } from '@solana/web3.js';
import { createActionsV2 } from '../src/shared/solana/actions-v2';

const evidence = JSON.parse(readFileSync('target/protocol-evidence/actions-v2.json', 'utf8'));

test('real redemption receipt shows readable principal, separate coupon and zero supply; raw units remain inspectable', async ({ page }) => {
  const scenario = evidence.scenarios.find((item: { kind: string }) => item.kind === 'redemption');
  await page.goto(`/actions?action=${scenario.action}`);
  await expect(page.getByText('Audit: Verified')).toBeVisible();
  await expect(page.locator('.summary-metrics')).toContainText('17,850.00 Mock USD');
  await expect(page.locator('.summary-metrics')).toContainText('17,000.00 Mock USD');
  await expect(page.locator('.summary-metrics')).toContainText('850.00 Mock USD');
  await expect(page.getByText('The instrument is redeemed. Its outstanding supply is zero.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Continue to/ })).toHaveCount(0);
  const raw = page.getByText('Principal / final coupon / total (minor units): 1700000 / 85000 / 1785000', { exact: true });
  await expect(raw).toBeHidden();
  await page.getByText('Instrument & action details', { exact: true }).click();
  await expect(raw).toBeVisible();
  await page.getByText('Instrument & action details', { exact: true }).click();
  await page.screenshot({ path: 'target/design-evidence/redemption-receipt.png', fullPage: true });
});

test('investor sees a real historical coupon right beside changed current holdings without signing', async ({ page }) => {
  const scenario = evidence.scenarios.find((item: { kind: string }) => item.kind === 'coupon');
  const rpc = new Connection(process.env.RECORDA_TEST_RPC || 'http://127.0.0.1:8899', 'confirmed');
  const report = await createActionsV2(rpc).read(new PublicKey(scenario.action));
  const holder = report.rights.find(item => item.account.units.toString() === '10')!.account.holder.toBase58();
  await page.addInitScript(address => {
    const provider = { isPhantom: true, publicKey: undefined as unknown, async connect() {
      const path = '/src/shared/solana/protocol.ts';
      const { RECORDA_PROGRAM_ID } = await import(/* @vite-ignore */ path);
      const Key = RECORDA_PROGRAM_ID.constructor;
      this.publicKey = new Key(address);
      return { publicKey: this.publicKey };
    }, signTransaction() { throw Error('This inspection must not sign'); } };
    Object.assign(window, { phantom: { solana: provider } });
  }, holder);
  await page.goto(`/actions?action=${scenario.action}`);
  await expect(page.getByText('Audit: Verified')).toBeVisible();
  await page.getByLabel('Role', { exact: true }).selectOption('Investor');
  await page.getByRole('button', { name: 'Connect Phantom', exact: true }).click();
  const card = page.locator('.holder-right-card');
  // This fixture has since completed full redemption: current supply is zero,
  // while the earlier Coupon retains the holder's ten-unit right and 500 payout.
  await expect(card).toContainText('Current units: 0');
  await expect(card).toContainText('Snapshot units: 10');
  await expect(card).toContainText('500.00 Mock USD');
  await expect(card).toContainText('10 units × 1,000.00 Mock USD × 10% ÷ 2');
  await expect(page.getByRole('button', { name: 'Sign atomic burn and payment' })).toHaveCount(0);
  await page.screenshot({ path: 'target/design-evidence/investor-right.png', fullPage: true });
});
