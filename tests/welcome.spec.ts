import { expect, test } from '@playwright/test';

test('judge can understand fixed rights, change perspectives, and enter the real workspace without a wallet', async ({ page }) => {
  const errors: string[] = [];
  const rpcRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST') rpcRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Ownership changes/ })).toBeVisible();
  await page.getByRole('button', { name: 'Change the ownership', exact: true }).click();
  const story = page.locator('#story');
  await expect(story.locator('.holding-comparison')).toContainText('6');
  await expect(story.locator('.snapshot-holding')).toContainText('10');
  await expect(story.locator('.coupon-value')).toContainText('500.00');
  await expect(story).toContainText('NOT A LIVE TRANSACTION');
  await page.getByRole('button', { name: 'Keep the promise', exact: true }).click();
  await expect(story).toContainText('A transfer cannot rewrite the right');
  await page.getByRole('tab', { name: 'Auditor', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('without connecting a wallet');
  expect(rpcRequests).toEqual([]);
  await page.getByRole('link', { name: 'Get started', exact: true }).first().click();
  await expect(page).toHaveURL(/\/actions$/);
  await expect(page.getByLabel('Role', { exact: true })).toHaveValue('Operator');
  await expect(page.getByLabel('Action kind', { exact: true })).toHaveValue('coupon');
  await expect(page.getByRole('button', { name: 'Create action', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Instrument setup', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Coupon servicing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create / resume demo instrument' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('Russian welcome retains the story and start route', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to Russian' }).click();
  await expect(page.getByRole('heading', { name: /Владение меняется/ })).toBeVisible();
  await page.getByRole('button', { name: 'Изменить владение', exact: true }).click();
  await expect(page.locator('.coupon-value')).toContainText('500.00');
  await page.getByRole('link', { name: 'Начать', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Corporate actions', exact: true })).toBeVisible();
});

test('reduced motion stops automatic storytelling but preserves manual exploration and keyboard tabs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.welcome')).toHaveAttribute('data-motion', 'paused');
  await expect(page.locator('.orbit-system')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Change the ownership', exact: true }).click();
  await expect(page.locator('.holding-comparison')).toContainText('6');
  await page.getByRole('tab', { name: 'Operator', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Auditor', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('without connecting a wallet');
});

test('percent inputs and technical basis points stay consistent before signing', async ({ page }) => {
  await page.goto('/actions?instrument=11111111111111111111111111111111&kind=voting');
  await expect(page.getByLabel('Action kind', { exact: true })).toHaveValue('voting');
  await page.getByLabel('Quorum percent', { exact: true }).fill('62.75');
  await expect(page.getByText('Required quorum: 62.75%. Abstentions count; ties fail.', { exact: true })).toBeVisible();
  await page.getByText('Quorum in basis points', { exact: true }).click();
  await expect(page.getByLabel('Quorum bps', { exact: true })).toHaveValue('6275');
  await page.getByLabel('Quorum bps', { exact: true }).fill('5000');
  await expect(page.getByLabel('Quorum percent', { exact: true })).toHaveValue('50');
  await expect(page.getByRole('button', { name: 'Create action', exact: true })).toBeDisabled();
});

for (const width of [1440, 390, 320]) test(`welcome and workspace fit ${width}px and all lifecycle links remain usable`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Ownership changes/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `target/design-evidence/welcome-${width}.png`, fullPage: true });
  await page.goto('/actions?instrument=11111111111111111111111111111111');
  await expect(page.getByRole('heading', { name: 'Corporate actions', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: /Voting.*Record a holder decision/ }).click();
  await expect(page.getByLabel('Action kind', { exact: true })).toHaveValue('voting');
  await expect(page.getByLabel('Instrument PDA', { exact: true })).toHaveValue('11111111111111111111111111111111');
  await page.screenshot({ path: `target/design-evidence/workspace-${width}.png`, fullPage: true });
});
