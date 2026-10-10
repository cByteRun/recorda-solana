import { expect, test } from '@playwright/test';
import { bridge } from './helpers/bridge';

test.setTimeout(120000);

async function step(page: Parameters<typeof bridge>[0], name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('busy-state')).toHaveCount(0, { timeout: 15000 });
}

test('UC-CP-01 FR-09/12/14/15/16/22–27/40/41: client lifecycle and independent RPC payouts', async ({ page }) => {
  const h = await bridge(page);
  await expect(page.getByRole('button', { name: 'Settle KUSD', exact: true })).toBeDisabled();
  await step(page, 'Create snapshot');
  await expect(page.getByTestId('snapshot-A')).toHaveText('10');
  await step(page, 'Transfer A → B');
  await expect(page.getByTestId('current-A')).toHaveText('6');
  await expect(page.getByTestId('current-B')).toHaveText('9');
  await expect(page.getByTestId('snapshot-A')).toHaveText('10');
  await step(page, 'Calculate entitlement');
  for (const [id, amount] of Object.entries({ A: '500', B: '250', C: '100', D: '0' })) {
    await expect(page.getByTestId(`entitlement-${id}`)).toContainText(amount);
  }
  expect(h.submitted).toHaveLength(3);
  await expect(page.getByRole('button', { name: 'Settle KUSD', exact: true })).toBeDisabled();
  await step(page, 'Approve in Phantom');
  await step(page, 'Settle KUSD');
  await step(page, 'Finalize receipt');
  await expect(page.getByTestId('app-error')).toHaveCount(0, { timeout: 15000 });
  expect(h.submitted).toHaveLength(6);
  expect(h.memos.map(m => m.type)).toEqual(['KASE_RECORD_DATE_SNAPSHOT', 'KASE_POST_RECORD_TRANSFER', 'KASE_ENTITLEMENT_ATTESTATION', 'KASE_OPERATOR_APPROVAL', 'KASE_COUPON_SETTLEMENT', 'KASE_ACTION_RECEIPT']);
  expect(h.memos[2].totalUsd).toBe(850);
  expect(h.memos[4].payouts).toEqual({ A: 500, B: 250, C: 100, D: 0 });
  expect(h.memos[5].finalStatus).toBe('FINALIZED');
  const holderAmounts = [...h.accounts.values()].filter(a => a.amount === 50000n || a.amount === 25000n || a.amount === 10000n);
  expect(holderAmounts.map(a => Number(a.amount)).sort((a,b) => a-b)).toEqual([10000, 25000, 50000]);
  await expect(page.getByTestId('pipeline').getByRole('button', { name: 'Confirmed', exact: true })).toHaveCount(6);
  for (const button of await page.getByTestId('pipeline').getByRole('button').all()) await expect(button).toBeDisabled();
  await expect(page.locator('a[href*="/tx/"]')).toHaveCount(6);
  await page.reload();
  await expect(page.getByText('FINALIZED', { exact: true })).toBeVisible();
  await expect(page.getByTestId('pipeline-step-5').getByRole('button')).toBeDisabled();
  expect(h.errors).toEqual([]);
  expect(h.failures).toEqual([]);
});

test('FR-12 NFR-01/06: RPC failure never signs a zero snapshot', async ({ page }) => {
  const h = await bridge(page, { snapshotFailure: true });
  await step(page, 'Create snapshot');
  await expect(page.getByTestId('app-error')).toContainText('Snapshot RPC unavailable');
  expect(h.submitted).toHaveLength(0);
  await expect(page.getByTestId('snapshot-A')).toHaveText('—');
});

test('FR-24 NFR-04: rejected explicit approval never unlocks settlement', async ({ page }) => {
  const h = await bridge(page, { rejectApproval: true });
  for (const name of ['Create snapshot', 'Transfer A → B', 'Calculate entitlement', 'Approve in Phantom']) await step(page, name);
  await expect(page.getByTestId('app-error')).toContainText('User rejected approval');
  await expect(page.getByRole('button', { name: 'Settle KUSD', exact: true })).toBeDisabled();
  expect(h.submitted).toHaveLength(3);
});

test('TC-18 FR-25/27 NFR-07: insufficient treasury cannot pay or finalize', async ({ page }) => {
  const h = await bridge(page, { insufficientFunds: true });
  for (const name of ['Create snapshot', 'Transfer A → B', 'Calculate entitlement', 'Approve in Phantom', 'Settle KUSD']) await step(page, name);
  await expect(page.getByTestId('app-error')).toContainText('InsufficientFunds');
  await expect(page.getByRole('button', { name: 'Finalize receipt', exact: true })).toBeDisabled();
  expect(h.submitted).toHaveLength(4);
});


test('R1 FR-01/03/04 NFR-10: deployment resume does not mint allocations twice', async ({ page }) => {
  const h = await bridge(page);
  await step(page, 'Deploy / Resume KZB26');
  await expect(page.getByTestId('app-error')).toHaveCount(0);
  expect(h.submitted).toHaveLength(0);
  for (const [id, amount] of Object.entries({ A: 10, B: 5, C: 2, D: 0 })) {
    await expect(page.getByTestId(`current-${id}`)).toHaveText(String(amount));
  }
});

test('R1 FR-12 NFR-04: wrong holder token-account owner cannot be attested', async ({ page }) => {
  const h = await bridge(page, { wrongSnapshotOwner: true });
  await step(page, 'Create snapshot');
  await expect(page.getByTestId('app-error')).toContainText('Invalid bond account for holder A');
  expect(h.submitted).toHaveLength(0);
});

test('R1 FR-09 NFR-09: unavailable RPC balance is unknown, never a zero allocation', async ({ page }) => {
  const h = await bridge(page, { unavailableBond: true });
  await expect(page.getByTestId('current-A')).toHaveText('—');
  await step(page, 'Deploy / Resume KZB26');
  await expect(page.getByTestId('app-error')).toContainText('Balance RPC unavailable');
  expect(h.submitted).toHaveLength(0);
});


test('R1 TC-04 NFR-03/08: submitted payment survives failed confirmation and reload', async ({ page }) => {
  const h = await bridge(page, { settlementConfirmationFailure: true });
  for (const name of ['Create snapshot', 'Transfer A → B', 'Calculate entitlement', 'Approve in Phantom', 'Settle KUSD']) await step(page, name);
  await expect(page.getByTestId('app-error')).toContainText('was submitted');
  expect(h.submitted).toHaveLength(5);
  await expect(page.getByRole('button', { name: 'Settle KUSD', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Finalize receipt', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByTestId('connect-wallet').click();
  await expect(page.getByTestId('busy-state')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Settle KUSD', exact: true })).toBeDisabled();
  expect(h.submitted).toHaveLength(5);
});

test('R1 FR-16/25 NFR-02: corrupted cached entitlement cannot change payout', async ({ page }) => {
  const h = await bridge(page);
  for (const name of ['Create snapshot', 'Transfer A → B', 'Calculate entitlement', 'Approve in Phantom']) await step(page, name);
  await page.evaluate(() => {
    const action = JSON.parse(localStorage.getItem('kase_real_action_v2')!);
    action.entitlements.A.usd = 501;
    localStorage.setItem('kase_real_action_v2', JSON.stringify(action));
  });
  await step(page, 'Settle KUSD');
  await expect(page.getByTestId('app-error')).toContainText('Entitlement mismatch for holder A');
  expect(h.submitted).toHaveLength(4);
});

test('R1 NFR-03/08 payment with lost broadcast response cannot repeat after reload', async ({ page }) => {
  const h = await bridge(page, { settlementBroadcastResponseFailure: true });
  for (const name of ['Create snapshot', 'Transfer A → B', 'Calculate entitlement', 'Approve in Phantom', 'Settle KUSD']) await step(page, name);
  await expect(page.getByTestId('app-error')).toContainText('broadcast outcome is unknown');
  expect(h.submitted).toHaveLength(5);
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('kase_real_action_v2')!).pendingSettlementSignature);
  expect(pending).toMatch(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/);
  await page.reload(); await page.getByTestId('connect-wallet').click();
  await expect(page.getByTestId('busy-state')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Settle KUSD', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Finalize receipt', exact: true })).toBeDisabled();
  expect(h.submitted).toHaveLength(5);
});

for (const attack of ['holder identity', 'consistent amount and units', 'duplicate holder ID'] as const) {
  test(`R1 FR-12/16/25 cached snapshot attack: ${attack}`, async ({ page }) => {
    const h = await bridge(page);
    for (const name of ['Create snapshot', 'Transfer A → B', 'Calculate entitlement', 'Approve in Phantom']) await step(page, name);
    await page.evaluate(attack => {
      const action = JSON.parse(localStorage.getItem('kase_real_action_v2')!);
      if (attack === 'holder identity') action.snapshot.holders[0].owner = action.snapshot.holders[1].owner;
      else if (attack === 'duplicate holder ID') action.snapshot.holders[1].id = 'A';
      else {
        action.snapshot.holders[0].units = 11;
        action.entitlements.A = { ...action.entitlements.A, units: 11, amountMinor: 55000, usd: 550 };
      }
      localStorage.setItem('kase_real_action_v2', JSON.stringify(action));
    }, attack);
    await step(page, 'Settle KUSD');
    await expect(page.getByTestId('app-error')).toContainText(attack === 'holder identity'
      ? 'Snapshot holder identity mismatch' : attack === 'duplicate holder ID' ? 'Invalid snapshot holder set' : 'Snapshot commitment mismatch');
    expect(h.submitted).toHaveLength(4);
  });
}
