import { expect, test } from '@playwright/test';

test('welcome opens the dashboard and registry interactions use explicitly labelled preview data', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Get started', exact: true }).first().click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByRole('button',{name:'Открыть Demo',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Operations overview.' })).toBeVisible();
  await page.goto('/holders');
  await expect(page.getByRole('heading',{name:'Holder registry',exact:true})).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(page.locator('tbody tr').first()).toContainText('500.00');
  expect(errors).toEqual([]);
});

for (const width of [1440, 390, 320]) test(`dashboard and operational screens fit ${width}px with usable navigation`, async ({page}) => {
  await page.addInitScript(()=>sessionStorage.setItem('recorda-workspace','demo'));
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
  await page.locator('.rail').getByRole('link', {name:'Holder registry',exact:true}).click();
  await expect(page).toHaveURL(/\/holders$/);
  await expect(page.getByRole('heading', {name:'Holder registry',exact:true})).toBeVisible();
});

test('failed chain reads show an error and never display demo balances as live data', async ({page}) => {
  await page.addInitScript(()=>sessionStorage.setItem('recorda-workspace','devnet'));
  await page.route('**/api.devnet.solana.com/**', route => route.fulfill({status:503,body:'RPC unavailable'}));
  await page.route('https://api.devnet.solana.com', route => route.fulfill({status:503,body:'RPC unavailable'}));
  await page.goto('/holders');
  await page.getByRole('textbox', {name:'Coupon action address'}).fill('11111111111111111111111111111111');
  await page.getByRole('button', {name:'Read chain',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.registry-table tbody tr')).toHaveCount(0);
  await expect(page.locator('.dashboard-metric').first()).toContainText('—');
});
