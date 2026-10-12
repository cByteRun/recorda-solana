import { expect, test } from '@playwright/test';

test('judge can understand fixed rights, change perspectives, and enter the real workspace without a wallet', async ({ page }) => {
  const errors: string[] = [];
  const rpcRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST') rpcRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Real assets/ })).toBeVisible();
  await page.getByRole('button', { name: 'Why Recorda?', exact: true }).click();
  await page.getByRole('button', { name: 'Track ownership changes', exact: true }).click();
  const story = page.locator('#story');
  await expect(story.locator('.holding-comparison')).toContainText('6');
  await expect(story.locator('.snapshot-holding')).toContainText('10');
  await expect(story.locator('.coupon-value')).toContainText('500.00');
  await expect(story).toContainText('NOT A LIVE TRANSACTION');
  await page.getByRole('button', { name: 'Reconcile execution', exact: true }).click();
  await expect(story).toContainText('Missing confirmation stays visible for review before any retry');
  await page.getByRole('tab', { name: 'Auditor', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('without connecting a wallet');
  expect(rpcRequests).toEqual([]);
  await page.getByRole('dialog').getByRole('link', { name: 'Get started', exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByRole('button',{name:'Открыть Demo',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.locator('.rail').getByRole('link', { name: 'Corporate actions', exact: true }).click();
  await expect(page.getByRole('heading',{name:'Купонная выплата · H2 2026',exact:true})).toBeVisible();
  expect(rpcRequests.filter(url=>!url.includes('/api/bondops'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('Russian welcome retains the story and start route', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to Russian' }).click();
  await expect(page.getByRole('heading', { name: /Реальные активы/ })).toBeVisible();
  await page.getByRole('button', { name: 'Почему Recorda?', exact: true }).click();
  await page.getByRole('button', { name: 'Учесть смену владельца', exact: true }).click();
  await expect(page.locator('.coupon-value')).toContainText('500.00');
  await page.getByRole('dialog').getByRole('link', { name: 'Начать', exact: true }).click();
  await expect(page.getByRole('heading',{name:'Выберите среду'})).toBeVisible();
  await page.getByRole('button',{name:'Открыть Demo',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Operations overview.', exact: true })).toBeVisible();
});

test('reduced motion stops automatic storytelling but preserves manual exploration and keyboard tabs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.welcome')).toHaveAttribute('data-motion', 'paused');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Why Recorda?', exact: true }).click();
  await page.getByRole('button', { name: 'Track ownership changes', exact: true }).click();
  await expect(page.locator('.holding-comparison')).toContainText('6');
  await page.getByRole('tab', { name: 'Operator', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Auditor', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('without connecting a wallet');
});

test('percent inputs and technical basis points stay consistent before signing', async ({ page }) => {
  await page.addInitScript(()=>sessionStorage.setItem('recorda-workspace','devnet'));
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
  await expect(page.getByRole('heading', { name: /Real assets/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `target/design-evidence/welcome-${width}.png`, fullPage: true });
  await page.addInitScript(()=>sessionStorage.setItem('recorda-workspace','devnet'));
  await page.goto('/actions?instrument=11111111111111111111111111111111');
  await expect(page.getByRole('heading', { name: 'Corporate actions', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: /Voting.*Record a holder decision/ }).click();
  await expect(page.getByLabel('Action kind', { exact: true })).toHaveValue('voting');
  await expect(page.getByLabel('Instrument PDA', { exact: true })).toHaveValue('11111111111111111111111111111111');
  await page.screenshot({ path: `target/design-evidence/workspace-${width}.png`, fullPage: true });
});

test('hand-drawn marks, light stages, pause, replay and explanation focus work together', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.light-field')).toHaveAttribute('data-renderer', 'webgl');
  await expect(page.locator('.light-track svg[aria-label="KASE"]')).toBeVisible();
  await expect(page.locator('.light-track svg[aria-label="Solana"]')).toBeVisible();
  await page.getByRole('button', { name: 'SOLANA: The execution', exact: true }).click();
  await expect(page.locator('.welcome')).toHaveAttribute('data-phase', '1');
  await expect(page.locator('.welcome')).toHaveAttribute('data-motion', 'paused');
  await page.waitForTimeout(6700);
  await expect(page.getByRole('button', { name: 'SOLANA: The execution', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Replay animation', exact: true }).click();
  await expect(page.locator('.welcome')).toHaveAttribute('data-phase', '0');
  await expect(page.locator('.welcome')).toHaveAttribute('data-motion', 'playing');
  await page.getByRole('button', { name: 'Why Recorda?', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.welcome')).toHaveAttribute('data-motion', 'paused');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Why Recorda?', exact: true })).toBeFocused();
  await page.locator('.light-proof-link').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.light-proof-link')).toBeFocused();
});

test('without WebGL the SVG sculpture remains visible and the welcome still opens the workspace', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.locator('.light-field')).toHaveAttribute('data-renderer', 'svg');
  await expect(page.locator('.light-field-fallback')).toBeVisible();
  await page.getByRole('button', { name: 'RECORDA: The record', exact: true }).click();
  await expect(page.locator('.welcome')).toHaveAttribute('data-phase', '2');
  await page.getByRole('link', { name: 'Get started', exact: true }).first().click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByRole('button',{name:'Открыть Demo',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('reference light responds to the pointer, freezes on pause and survives context loss', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 868 });
  await page.clock.install({ time: new Date('2026-10-12T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-12T00:00:01Z'));
  await page.goto('/');
  const field = page.locator('.light-field');
  const canvas = field.locator('canvas');
  await expect(field).toHaveAttribute('data-renderer', 'webgl');
  await page.clock.runFor(2000);
  const bounds = (await field.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * .4);
  await page.clock.runFor(100);
  const illuminated = await canvas.screenshot();
  await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .4);
  await page.clock.runFor(100);
  expect((await canvas.screenshot()).equals(illuminated)).toBe(false);
  await page.mouse.move(10, 10);
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  const paused = await canvas.screenshot();
  await page.clock.runFor(500);
  expect((await canvas.screenshot()).equals(paused)).toBe(true);
  await canvas.evaluate(element => element.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(field).toHaveAttribute('data-renderer', 'svg');
  await expect(field.locator('.light-field-fallback')).toBeVisible();
  await expect(field.locator('.light-field-fallback circle')).toHaveCount(12);
  await page.getByRole('button', { name: 'SOLANA: The execution', exact: true }).click();
  await expect(page.locator('.light-right-copy')).toContainText('Coupon. Voting. Redemption.');
  await page.getByRole('link', { name: 'Get started', exact: true }).first().click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByRole('button',{name:'Открыть Demo',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(errors).toEqual([]);
});

test('welcome fills the reference viewport and forms each product logo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 2590, height: 1560 });
  await page.goto('/');
  const field = page.locator('.light-field');
  await expect(field).toHaveAttribute('data-renderer', 'webgl', { timeout: 15000 });
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual({ width: 2590, height: 1560 });
  const geometries: string[] = [];
  let previous: Buffer | undefined;
  for (const [index, name] of ['KASE: The instrument', 'SOLANA: The execution', 'RECORDA: The record'].entries()) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.welcome')).toHaveAttribute('data-phase', String(index));
    await expect(field).toHaveAttribute('data-transition', 'settled');
    const geometry = await field.locator('circle').evaluateAll(nodes => nodes.map(node => [node.getAttribute('cx'), node.getAttribute('cy')]));
    expect(geometry).toHaveLength(12);
    geometries.push(JSON.stringify(geometry));
    if (index === 1) expect(new Set(geometry.map(([, y]) => y)).size).toBe(3);
    await expect(page.getByRole('heading', { name: /Real assets/ })).toBeVisible();
    const image = await page.screenshot({ path: `target/design-evidence/welcome-reference-stage-${index}.png` });
    if (previous) expect(image.equals(previous)).toBe(false);
    previous = image;
  }
  expect(new Set(geometries).size).toBe(3);
});


test('logo spheres move through intermediate positions and rapid stage changes settle correctly without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.clock.install({ time: new Date('2026-10-12T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-12T00:00:01Z'));
  await page.goto('/');
  const field = page.locator('.light-field');
  await expect(field).toHaveAttribute('data-renderer', 'svg');
  await page.clock.runFor(2000);
  await expect(field).toHaveAttribute('data-transition', 'settled');
  const coordinates = () => field.locator('circle').evaluateAll(nodes => nodes.map(node => [node.getAttribute('cx'), node.getAttribute('cy')]));
  const kase = await coordinates();
  await page.getByRole('button', { name: 'SOLANA: The execution', exact: true }).click();
  await expect(field).toHaveAttribute('data-transition', 'morphing');
  await page.clock.runFor(700);
  const intermediate = await coordinates();
  expect(intermediate).not.toEqual(kase);
  await page.clock.runFor(1300);
  await expect(field).toHaveAttribute('data-transition', 'settled');
  const solana = await coordinates();
  expect(solana).not.toEqual(intermediate);
  expect(new Set(solana.map(([, y]) => y)).size).toBe(3);
  await page.getByRole('button', { name: 'RECORDA: The record', exact: true }).click();
  await page.clock.runFor(400);
  await page.getByRole('button', { name: 'KASE: The instrument', exact: true }).click();
  await page.clock.runFor(2000);
  await expect(field).toHaveAttribute('data-shape', 'kase');
  await expect(field).toHaveAttribute('data-transition', 'settled');
  expect(await coordinates()).toEqual(kase);
  await expect(field.locator('circle')).toHaveCount(12);
});
