const states = ['scheduled', 'snapshotPending', 'snapshotted', 'awaitingApproval', 'approved', 'funded', 'executing', 'settled', 'finalized'];
export async function protocolStage(page, name, target, { timeout = 300_000, interval = 250 } = {}) {
  const deadline = Date.now() + timeout;
  const button = page.getByRole('button', { name, exact: true, includeHidden: true });
  let clicked = false;
  let state = null;
  while (Date.now() < deadline) {
    const busy = await page.getByTestId('protocol-root').getAttribute('data-busy', { timeout: Math.max(1, deadline - Date.now()) });
    const summary = page.getByTestId('protocol-summary');
    state = await summary.count() ? await summary.getAttribute('data-state', { timeout: Math.max(1, deadline - Date.now()) }) : null;
    if (busy !== 'true') {
      const alerts = await page.getByRole('alert').allTextContents();
      if (alerts.length) throw new Error(`${name}: ${alerts.join('; ')} (state: ${state || 'notCreated'})`);
      if (target && states.indexOf(state) >= states.indexOf(target) && states.includes(state)) return { clicked, state };
      if (!target && clicked) return { clicked, state };
      if (!clicked && await button.isEnabled({ timeout: Math.max(1, deadline - Date.now()) }).catch(() => false)) {
        const disclosure = button.locator('xpath=ancestor::details[1]');
        if (await disclosure.count() && !await disclosure.getAttribute('open').then(value => value !== null)) {
          await disclosure.locator('summary').first().click();
        }
        await button.click({ timeout: Math.max(1, deadline - Date.now()) });
        clicked = true;
      }
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`${name}: timed out waiting for ${target || 'operation completion'}; state: ${state || 'notCreated'}. Inspect the page/Phantom and resume the existing Action PDA; do not repeat payments blindly.`);
}
