const states = ['scheduled', 'snapshotPending', 'snapshotted', 'awaitingApproval', 'approved', 'funded', 'executing', 'settled', 'finalized'];
export async function protocolStage(page, name, target, { timeout = 300_000, interval = 250 } = {}) {
  const deadline = Date.now() + timeout;
  const button = page.getByRole('button', { name, exact: true });
  let clicked = false;
  let state = null;
  while (Date.now() < deadline) {
    const busy = await page.getByTestId('protocol-root').getAttribute('data-busy');
    const summary = page.getByTestId('protocol-summary');
    state = await summary.count() ? await summary.getAttribute('data-state') : null;
    if (busy !== 'true') {
      const alerts = await page.getByRole('alert').allTextContents();
      if (alerts.length) throw new Error(`${name}: ${alerts.join('; ')} (state: ${state || 'notCreated'})`);
      if (target && states.indexOf(state) >= states.indexOf(target) && states.includes(state)) return { clicked, state };
      if (!target && clicked) return { clicked, state };
      if (!clicked && await button.isEnabled().catch(() => false)) {
        await button.click({ timeout: Math.max(1, deadline - Date.now()) });
        clicked = true;
      }
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`${name}: timed out waiting for ${target || 'operation completion'}; state: ${state || 'notCreated'}. Inspect the page/Phantom and resume the existing Action PDA; do not repeat payments blindly.`);
}
