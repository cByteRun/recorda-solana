import { expect, test } from '@playwright/test';

test.beforeEach(async({page})=>{await page.addInitScript(()=>sessionStorage.setItem('recorda-workspace','test'));});
test('primary entry and roles remain usable without a wallet or action', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Real assets/ })).toBeVisible();
  await page.getByRole('link', { name: 'Get started', exact: true }).first().click();
  await page.getByRole('button',{name:'Открыть Test',exact:true}).click();
  await page.goto('/actions');
  await expect(page.getByRole('heading', { name: 'Corporate actions', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Instrument setup', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Coupon servicing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create / resume demo instrument' })).toBeDisabled();
  await page.getByRole('button', { name: 'Investor', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Schedule coupon' })).toHaveCount(0);
  await expect(page.getByText('Open an action above to see its rights and proof.')).toBeVisible();
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await expect(page.getByText('Verify rights, payments and receipt independently.')).toBeVisible();
  await page.getByTestId('protocol-action-input').fill('invalid-address');
  await expect(page.getByText('Enter a valid Solana public address.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Read chain / refresh' })).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'target/protocol-evidence/coupon-entry-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('input errors prevent wallet prompts and expose keyboard focus', async ({ page }) => {
  await page.goto('/protocol');
  await page.getByLabel('Demo instrument ID').fill('-1');
  await expect(page.getByText('Use a nonnegative integer within the u64 range.')).toBeVisible();
  await page.getByLabel('Record timestamp (ISO UTC)').fill('tomorrow');
  await expect(page.getByLabel('Record timestamp (ISO UTC)')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Schedule coupon' })).toBeDisabled();
  await page.getByTestId('protocol-action-input').focus();
  await expect(page.getByTestId('protocol-action-input')).toBeFocused();
  await expect(page.getByTestId('protocol-action-input')).toHaveCSS('outline-style', 'none');
  await expect(page.getByTestId('protocol-action-input')).not.toHaveCSS('box-shadow', 'none');
});
