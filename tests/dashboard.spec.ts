import { expect, test } from '@playwright/test';

test('welcome opens the dashboard and registry interactions use explicitly labelled preview data', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Get started', exact: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Every asset. Every right.' })).toBeVisible();
  await expect(page.getByText('Illustrative scenario · no live transactions')).toBeVisible();
  await expect(page.locator('.registry-table tbody tr')).toHaveCount(4);
  await page.getByLabel('Search holders').fill('Holder A');
  await expect(page.locator('.registry-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.registry-table tbody')).toContainText('500.00');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('recorda-holders-preview.csv');
  await page.getByLabel('Search holders').fill('');
  await page.getByLabel('Sort holders').selectOption('name');
  await expect(page.locator('.registry-table tbody tr').first()).toContainText('Holder A');
  await page.getByLabel('Sort holders').selectOption('largest');
  await expect(page.locator('.registry-table tbody tr').first()).toContainText('Holder B');
  await page.getByRole('button', { name: 'Chain data', exact: true }).click();
  await expect(page.locator('.registry-table tbody tr')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Read chain', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const width of [1440, 390, 320]) test(`dashboard and operational screens fit ${width}px with usable navigation`, async ({page}) => {
  await page.setViewportSize({width, height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const route of ['/dashboard', '/holders', '/actions', '/protocol', '/claims']) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({tag:e.tagName, cls:e.className, right:e.getBoundingClientRect().right})));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow)).toBe(true);
    await page.screenshot({path:`target/design-evidence/dashboard-${route.slice(1)}-${width}.png`,fullPage:true});
  }
  await page.goto('/dashboard');
  const rail = page.locator('.dashboard-rail');
  await rail.hover();
  expect((await rail.boundingBox())!.width).toBeGreaterThan(200);
  await page.getByRole('button', {name:'Expand navigation',exact:true}).click();
  await expect(rail).toHaveClass(/rail-pinned/);
  await page.getByRole('link', {name:'Holders',exact:true}).click();
  await expect(page).toHaveURL(/\/holders$/);
  await expect(page.getByRole('heading', {name:'Your holder registry.'})).toBeVisible();
});

test('failed chain reads show an error and never display demo balances as live data', async ({page}) => {
  await page.route('**/api.devnet.solana.com/**', route => route.fulfill({status:503,body:'RPC unavailable'}));
  await page.route('https://api.devnet.solana.com', route => route.fulfill({status:503,body:'RPC unavailable'}));
  await page.goto('/dashboard');
  await page.getByRole('button', {name:'Chain data',exact:true}).click();
  await page.getByRole('textbox', {name:'Coupon action address'}).fill('11111111111111111111111111111111');
  await page.getByRole('button', {name:'Read chain',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.registry-table tbody tr')).toHaveCount(0);
  await expect(page.locator('.dashboard-metric').first()).toContainText('—');
});
