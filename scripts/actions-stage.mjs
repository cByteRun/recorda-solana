// Observe one requested operation. Never re-click or re-sign after submission.
export async function actionsStage(page, name, target, { timeout = 600_000, interval = 250 } = {}) {
  const root = page.getByTestId('actions-root');
  const before = await root.getAttribute('data-state');
  if (name !== 'Create action' && !before) throw Error(`${name}: action report is not loaded. Read the existing Action PDA before continuing.`);
  const connected = await page.getByRole('button', { name: /^Wallet / }).count() > 0;
  await page.getByRole('button', { name, exact: true }).click({ timeout });
  const deadline = Date.now() + timeout;
  let state = before;
  while (Date.now() < deadline) {
    // Always inspect errors while awaiting a transition, including late failures.
    const alerts = await page.getByRole('alert').allTextContents();
    if (alerts.length) throw Error(`${name}: ${alerts.join('; ')}. Inspect the existing Action PDA and submitted signature before retrying.`);
    const busy = await root.getAttribute('data-busy');
    state = await root.getAttribute('data-state');
    if (busy !== 'true') {
      if (before && !state) throw Error(`${name}: action report reset. Read and reconcile the existing Action PDA; no automatic retry.`);
      if (connected && !await page.getByRole('button', { name: /^Wallet / }).count()) {
        throw Error(`${name}: signing wallet disconnected or page state reset (state: ${state || 'unknown'}). Reconnect and reconcile the existing Action PDA; no automatic retry.`);
      }
      if (!target || state === target) return { state };
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw Error(`${name}: timed out waiting for ${target || 'operation completion'}; state: ${state || 'unknown'}. Inspect the existing Action PDA and Phantom; no automatic retry.`);
}
