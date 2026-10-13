import { expect, test, type Page } from '@playwright/test';
import fixture from '../src/features/bondops/fixtures/preview.json' with { type: 'json' };
import type { Workspace } from '../src/features/bondops/model/bondops-context';

const workspace = () => structuredClone(fixture) as unknown as Workspace;
async function openWorkspace(page: Page, data = workspace()) {
  await page.addInitScript(() => { sessionStorage.setItem('recorda-workspace', 'demo'); localStorage.setItem('recorda-language', 'en'); });
  // Projection tests use an isolated read model; do not consume the shared demo login rate limit.
  await page.route('**/api/bondops/session', route => route.fulfill({ json: {
    mode: 'demo', member: data.members.find(m => m.id === 'demo-operator'), csrf: null, demoEnabled: true, liveConfigured: true,
  } }));
  await page.route('**/api/bondops/workspace**', route => route.fulfill({ json: data }));
  await page.goto('/dashboard');
  await expect(page.getByRole('region', { name: 'Corporate action control', exact: true })).toBeVisible();
}

test('operator controls separate cutoff rights, voting and asset terms', async ({ page }) => {
  await openWorkspace(page);
  const desk = page.getByRole('region', { name: 'Corporate action control', exact: true });
  const coupon = desk.getByRole('article', { name: 'Купонная выплата · H2 2026', exact: true });
  await expect(coupon).toContainText('4 holders · 17 record units');
  await expect(coupon).toContainText('850.00 Mock USD');
  await expect(coupon).toContainText('Reconcile before retry');
  await expect(coupon.getByRole('link', { name: 'Review settlement', exact: true })).toHaveAttribute('href', `/settlements?case=${encodeURIComponent(fixture.cases[0].id)}`);
  const voting = desk.getByRole('article', { name: 'Решение держателей', exact: true });
  await expect(voting).toContainText('Quorum: 50%');
  await expect(voting).toContainText('Snapshot not finalized');
  await expect(voting).toContainText('Tally not available yet');
  await expect(voting).not.toContainText('Vault funding');
  await expect(voting).not.toContainText('Mock USD');
  const redemption = desk.getByRole('article', { name: 'Полное погашение', exact: true });
  await expect(redemption).toContainText('Holder signature required');
  await expect(redemption).toContainText('Amounts available after verified calculation');
  await expect(redemption.getByRole('link', { name: 'View action', exact: true })).toHaveAttribute('href', '/actions?example=DEMO-CA-003');
  await desk.getByRole('button', { name: 'Review evidence 1', exact: true }).click();
  await expect(desk.getByRole('article')).toHaveCount(1);
  await expect(desk.getByRole('button', { name: 'Review evidence 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await desk.getByRole('button', { name: 'All actions · 3', exact: true }).click();
  await expect(desk.getByRole('article')).toHaveCount(3);
  const assets = page.getByRole('region', { name: 'Serviced assets', exact: true });
  await assets.locator('summary').click();
  await expect(assets).toContainText('17 outstanding');
  await expect(assets).toContainText('0 retired');
  await expect(assets).toContainText('1,000.00 Mock USD');
  await expect(assets).toContainText('10% · 2 payments per year');
  await expect(assets).toContainText('No real asset backing or legal ownership is verified');
  await expect(assets.locator('a[href*="explorer"]')).toHaveCount(0);
  await page.locator('.language-select').selectOption('ru');
  await expect(page.getByRole('heading', { name: 'Контроль корпоративных действий', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Активы в обслуживании', exact: true })).toContainText('10% · 2 выплат в год');
});

test('uncertain or unverified execution cannot appear as a completed outcome', async ({ page }) => {
  const data = workspace();
  data.actions[0].status = 'settled';
  data.actions[0].rights[0].status = 'pending';
  data.actions[1].status = 'finalized';
  data.actions[1].receipt = 'illustrative-receipt';
  data.actions[1].verified = false;
  data.actions[2].status = 'finalized';
  data.actions[2].receipt = null;
  await openWorkspace(page, data);
  const desk = page.getByRole('region', { name: 'Corporate action control', exact: true });
  await expect(desk.getByRole('button', { name: 'Recorded outcomes 0', exact: true })).toBeVisible();
  await expect(desk.getByRole('article', { name: 'Купонная выплата · H2 2026', exact: true })).toContainText('Reconcile before retry');
  await expect(desk.getByRole('article', { name: 'Решение держателей', exact: true })).toContainText('Verify action state');
  await expect(desk.getByRole('article', { name: 'Полное погашение', exact: true })).toContainText('Verify action state');
});

test('redemption shows separate components; voting proceeds without funding; a receipt is a separate step', async ({ page }) => {
  const data = workspace();
  data.actions[0].status = 'settled';
  data.actions[0].rights.forEach(r => { r.status = 'confirmed'; r.confirmedMinor = r.expectedMinor; });
  const voting = data.actions[1];
  voting.status = 'approved'; voting.approved = true; voting.yes = '6'; voting.no = '9'; voting.abstain = '2';
  const redemption = data.actions[2];
  redemption.status = 'funded'; redemption.approved = true; redemption.funded = true;
  redemption.rights = [structuredClone(data.actions[0].rights[0])];
  Object.assign(redemption.rights[0], { units: '10', principalMinor: '1000000', couponMinor: '50000', expectedMinor: '1050000', confirmedMinor: '0', status: 'due' });
  await openWorkspace(page, data);
  const desk = page.getByRole('region', { name: 'Corporate action control', exact: true });
  await expect(desk.getByRole('article', { name: data.actions[0].label, exact: true })).toContainText('Finalize receipt');
  const voteCard = desk.getByRole('article', { name: voting.label, exact: true });
  await expect(voteCard).toContainText('Review voting window & tally');
  await expect(voteCard).toContainText('YES 6 · NO 9 · ABSTAIN 2');
  await expect(voteCard).not.toContainText('Review vault funding');
  const redeemCard = desk.getByRole('article', { name: redemption.label, exact: true });
  await expect(redeemCard).toContainText('Principal: 10,000.00 · Coupon component: 500.00 Mock USD');
  await expect(redeemCard).toContainText('Coordinate holder redemption');
});

test('partially calculated rights do not display a final obligation; settlement assets stay separate', async ({ page }) => {
  const data = workspace();
  data.actions[0].status = 'calculating';
  data.actions[0].rights[0].calculated = false;
  const other = structuredClone(data.instruments[0]);
  Object.assign(other, { id: 'OTHER-BOND', symbol: 'OTHER', asset: 'OTHER-MINT', currency: 'Other USD', faceMinor: '200000' });
  data.instruments.push(other);
  data.totals.push({ ...data.totals[0], asset: 'OTHER-MINT', currency: 'Other USD', expected: '200000', confirmed: '0', unsettled: '200000', unknown: '0' });
  await openWorkspace(page, data);
  const desk = page.getByRole('region', { name: 'Corporate action control', exact: true });
  await expect(desk.getByRole('article', { name: data.actions[0].label, exact: true })).toContainText('Amounts available after verified calculation');
  await page.getByLabel('Settlement asset', { exact: true }).selectOption('OTHER-MINT');
  await expect(page.locator('.stat-card').nth(1)).toContainText('2,000.00');
  const assets = page.getByRole('region', { name: 'Serviced assets', exact: true });
  await expect(assets.locator('summary')).toHaveCount(1);
  await expect(assets).toContainText('OTHER');
  await expect(assets).not.toContainText('KZB26');
  await expect(desk.getByRole('article')).toHaveCount(3);
});

test('verified voting receipt exposes a recorded outcome through its own action', async ({ page }) => {
  const data = workspace(), voting = data.actions[1];
  Object.assign(voting, { status: 'finalized', approved: true, receipt: 'illustrative-vote-receipt', yes: '10', no: '5', abstain: '2', passed: true });
  await openWorkspace(page, data);
  const desk = page.getByRole('region', { name: 'Corporate action control', exact: true });
  await desk.getByRole('button', { name: 'Recorded outcomes 1', exact: true }).click();
  await expect(desk.getByRole('article')).toHaveCount(1);
  const card = desk.getByRole('article', { name: voting.label, exact: true });
  await expect(card).toContainText('Passed');
  await expect(card.getByRole('link', { name: 'View proof', exact: true })).toHaveAttribute('href', '/actions?example=DEMO-CA-002');
  await expect(card).not.toContainText('Vault funding');
});

for (const width of [1440, 390, 320]) test(`asset controls remain usable at ${width}px in RU and dark theme`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await openWorkspace(page);
  await page.locator('.language-select').selectOption('ru');
  await page.getByRole('region', { name: 'Активы в обслуживании', exact: true }).locator('summary').click();
  await page.evaluate(() => localStorage.setItem('recorda-theme', 'dark'));
  await page.reload();
  // openWorkspace resets only the language at reload; explicitly reselect RU.
  await page.locator('.language-select').selectOption('ru');
  await page.getByRole('region', { name: 'Активы в обслуживании', exact: true }).locator('summary').click();
  await expect(page.locator('.bondops')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const filter = page.getByRole('button', { name: 'Проверить доказательства 1', exact: true });
  await filter.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Контроль корпоративных действий', exact: true }).getByRole('article')).toHaveCount(1);
  await page.getByRole('region', { name: 'Контроль корпоративных действий', exact: true }).getByRole('button', { name: 'Все действия · 3', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `target/design-evidence/asset-control-${width}-ru-dark.png`, fullPage: true });
});
