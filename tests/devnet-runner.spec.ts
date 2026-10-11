import { test, expect } from '@playwright/test';
import { actionsStage } from '../scripts/actions-stage.mjs';
import { protocolStage } from '../scripts/protocol-stage.mjs';
import { waitForDevnetWallet } from '../scripts/devnet-wallet.mjs';

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


test('Devnet runner opens an enabled operation inside a collapsed disclosure', async ({ page }) => {
  await page.setContent(`<main data-testid="protocol-root" data-busy="false">
    <section data-testid="protocol-summary" data-state="snapshotted"></section>
    <details><summary>Optional demo</summary><button onclick="document.body.dataset.transferred='yes'">Transfer</button></details>
  </main>`);
  await protocolStage(page, 'Transfer', undefined, { timeout: 2000, interval: 20 });
  await expect(page.locator('details')).toHaveAttribute('open', '');
  await expect(page.locator('body')).toHaveAttribute('data-transferred', 'yes');
});


test('wallet wait refreshes a stale provider through trusted connection without signing', async ({ page }) => {
  await page.setContent('<main>Actions</main>');
  await page.evaluate(() => {
    (window as any).walletCalls = [];
    (window as any).phantom = { solana: { isPhantom: true,
      publicKey: { toBase58: () => 'operator' },
      connect: async (options: unknown) => {
        (window as any).walletCalls.push(options);
        const provider = (window as any).phantom.solana;
        provider.publicKey = { toBase58: () => 'holder-A' };
      },
      signTransaction: () => { throw Error('must never sign'); }
    } };
  });
  await waitForDevnetWallet(page, 'holder-A', { timeout: 2000, interval: 20, onChange: () => {} });
  expect(await page.evaluate(() => (window as any).walletCalls)).toEqual([{ onlyIfTrusted: true }]);
  await expect(page.locator('#recorda-wallet-wait')).toHaveCount(0);
});

test('wallet wait shows expected/current accounts and waits for actual human authorization', async ({ page }) => {
  await page.setContent('<main>Actions</main>');
  await page.evaluate(() => {
    (window as any).authorized = false;
    (window as any).phantom = { solana: { isPhantom: true,
      publicKey: { toBase58: () => 'holder-A' },
      connect: async () => { if (!(window as any).authorized) throw Error('not trusted'); }
    } };
  });
  let done = false;
  const waiting = waitForDevnetWallet(page, 'holder-A', { timeout: 3000, interval: 20, onChange: () => {} }).then(() => { done = true; });
  await expect(page.locator('#recorda-wallet-wait')).toContainText('holder-A');
  await expect(page.locator('#recorda-wallet-current')).toContainText('Connection approval required');
  expect(done).toBe(false);
  await page.evaluate(() => { (window as any).authorized = true; });
  await waiting;
  expect(done).toBe(true);
});

test('wallet timeout reports the wrong connected account without accepting or signing it', async ({ page }) => {
  await page.setContent('<main>Actions</main>');
  await page.evaluate(() => {
    (window as any).phantom = { solana: { isPhantom: true,
      publicKey: { toBase58: () => 'operator' }, connect: async () => {}
    } };
  });
  await expect(waitForDevnetWallet(page, 'holder-A', { timeout: 150, interval: 20, onChange: () => {} })).rejects.toThrow('"active":"operator"');
  await expect(page.locator('#recorda-wallet-wait')).toHaveCount(0);
});


test('actions runner surfaces an error arriving after initial idle instead of waiting ten minutes', async ({ page }) => {
  await page.setContent(`<main data-testid="actions-root" data-state="snapshotted" data-busy="false">
    <button onclick="setTimeout(() => {const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Signature rejected';document.body.append(p)}, 100)">Calculate rights</button>
  </main>`);
  await expect(actionsStage(page, 'Calculate rights', 'awaitingApproval', { timeout: 2000, interval: 20 })).rejects.toThrow('Signature rejected');
});

test('actions runner stops on wallet/page reset without re-clicking a signing operation', async ({ page }) => {
  await page.setContent(`<main data-testid="actions-root" data-state="snapshotted" data-busy="false">
    <button id="wallet">Wallet operator</button>
    <button onclick="window.clicks=(window.clicks||0)+1;setTimeout(()=>document.querySelector('#wallet').textContent='Connect Phantom',100)">Calculate rights</button>
  </main>`);
  await expect(actionsStage(page, 'Calculate rights', 'awaitingApproval', { timeout: 2000, interval: 20 })).rejects.toThrow('disconnected or page state reset');
  expect(await page.evaluate(() => (window as any).clicks)).toBe(1);
});

test('actions runner waits for the complete calculation and chain refresh', async ({ page }) => {
  await page.setContent(`<main data-testid="actions-root" data-state="snapshotted" data-busy="false">
    <button>Wallet operator</button><button onclick="const m=document.querySelector('main');m.dataset.busy='true';setTimeout(()=>{m.dataset.state='awaitingApproval';setTimeout(()=>m.dataset.busy='false',100)},100)">Calculate rights</button>
  </main>`);
  expect(await actionsStage(page, 'Calculate rights', 'awaitingApproval', { timeout: 2000, interval: 20 })).toEqual({ state: 'awaitingApproval' });
  await expect(page.getByTestId('actions-root')).toHaveAttribute('data-busy', 'false');
});


test('actions runner refuses to sign before the URL action report has loaded', async ({ page }) => {
  await page.setContent(`<main data-testid="actions-root" data-state="" data-busy="false">
    <button onclick="document.body.dataset.clicked='yes'">Approve action</button>
  </main>`);
  await expect(actionsStage(page, 'Approve action', 'approved', { timeout: 1000 })).rejects.toThrow('action report is not loaded');
  expect(await page.locator('body').getAttribute('data-clicked')).toBeNull();
});

test('actions runner detects a lost report with the wallet still connected', async ({ page }) => {
  await page.setContent(`<main data-testid="actions-root" data-state="awaitingApproval" data-busy="false">
    <button>Wallet operator</button><button onclick="setTimeout(()=>document.querySelector('main').dataset.state='',100)">Approve action</button>
  </main>`);
  await expect(actionsStage(page, 'Approve action', 'approved', { timeout: 2000, interval: 20 })).rejects.toThrow('action report reset');
});
