import { test, expect } from '@playwright/test';
import { protocolStage } from '../scripts/protocol-stage.mjs';

// Exercise runner/browser synchronization only; these tests are not Devnet evidence.
test('Devnet runner waits beyond the page click timeout for a disabled stage', async ({ page }) => {
  await page.setContent(`<main data-testid="protocol-root" data-busy="false">
    <section data-testid="protocol-summary" data-state="scheduled"></section>
    <button disabled onclick="document.querySelector('section').dataset.state='snapshotted'">Snapshot</button>
    <script>setTimeout(() => document.querySelector('button').disabled = false, 150)</script>
  </main>`);
  page.setDefaultTimeout(25);
  const result = await protocolStage(page, 'Snapshot', 'snapshotted', { timeout: 2000, interval: 20 });
  expect(result).toEqual({ clicked: true, state: 'snapshotted' });
});

test('Devnet runner skips a snapshot completed manually without clicking it again', async ({ page }) => {
  await page.setContent(`<main data-testid="protocol-root" data-busy="false">
    <section data-testid="protocol-summary" data-state="awaitingApproval"></section>
    <button disabled onclick="document.body.dataset.repeated='yes'">Snapshot</button>
  </main>`);
  expect(await protocolStage(page, 'Snapshot', 'snapshotted', { timeout: 1000 })).toEqual({ clicked: false, state: 'awaitingApproval' });
  expect(await page.locator('body').getAttribute('data-repeated')).toBeNull();
});

test('Devnet runner waits for busy refresh to finish even when next state is rendered', async ({ page }) => {
  await page.setContent(`<main data-testid="protocol-root" data-busy="true">
    <section data-testid="protocol-summary" data-state="snapshotted"></section>
    <button disabled>Snapshot</button>
    <script>setTimeout(() => document.querySelector('main').dataset.busy='false', 150)</script>
  </main>`);
  await protocolStage(page, 'Snapshot', 'snapshotted', { timeout: 2000, interval: 20 });
  await expect(page.getByTestId('protocol-root')).toHaveAttribute('data-busy', 'false');
});

test('Devnet runner reports application rejection immediately instead of a disabled-button timeout', async ({ page }) => {
  await page.setContent(`<main data-testid="protocol-root" data-busy="false">
    <section data-testid="protocol-summary" data-state="scheduled"></section>
    <button disabled>Snapshot</button><div role="alert">Wallet rejected signature</div>
  </main>`);
  await expect(protocolStage(page, 'Snapshot', 'snapshotted', { timeout: 1000 })).rejects.toThrow('Wallet rejected signature');
});
