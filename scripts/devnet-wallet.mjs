// Human wallet switching only: never imports keys, selects accounts or signs.
export async function waitForDevnetWallet(page, address, { timeout = 600_000, interval = 2000, onChange = console.log } = {}) {
  await page.bringToFront();
  await page.evaluate(expected => {
    document.getElementById('recorda-wallet-wait')?.remove();
    const panel = document.createElement('aside');
    panel.id = 'recorda-wallet-wait';
    panel.setAttribute('role', 'status');
    Object.assign(panel.style, { position: 'fixed', top: '8px', left: '8px', right: '8px', zIndex: '9999', padding: '16px', background: '#fff4cc', color: '#171717', border: '2px solid #d97706', overflowWrap: 'anywhere' });
    panel.textContent = `Wallet test: switch account in Phantom in THIS browser to ${expected}. Open Phantom → account selector → choose this Solana address → unlock. If it is not connected, click Connect Phantom / Wallet on this page and approve the connection. No Google account switch is needed. `;
    const current = document.createElement('strong');
    current.id = 'recorda-wallet-current';
    panel.append(current);
    document.body.append(panel);
  }, address);
  const deadline = Date.now() + timeout;
  let lastState;
  try {
    while (Date.now() < deadline) {
      const state = await page.evaluate(async () => {
        const provider = window.phantom?.solana ?? window.solana;
        let connectionError = '';
        // Phantom may not emit accountChanged for an account not yet connected
        // to this origin. Refresh trusted authorization without opening prompts.
        if (provider?.isPhantom) {
          try { await provider.connect({ onlyIfTrusted: true }); }
          catch (error) { connectionError = String(error?.message ?? error); }
        }
        const active = provider?.publicKey?.toBase58() ?? null;
        const current = document.getElementById('recorda-wallet-current');
        if (current) current.textContent = `Connected: ${active ?? 'none'}.${connectionError ? ' Connection approval required: click Connect Phantom / Wallet.' : ''}`;
        return { active, connectionError, providerFound: Boolean(provider?.isPhantom) };
      });
      const description = JSON.stringify(state);
      if (lastState !== description) onChange(`Wallet wait: expected ${address}; connected ${state.active ?? 'none'}${!state.providerFound ? '; Phantom not found in this browser' : ''}${state.connectionError ? `; ${state.connectionError}` : ''}`);
      lastState = description;
      // Failed trusted connection can leave the old key cached: never accept it.
      if (state.active === address && !state.connectionError) return;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw Error(`Timed out waiting for Phantom account ${address}. Last wallet state: ${lastState}. Switch in the CDP browser, unlock, and approve Connect Phantom / Wallet for this page. No transaction was signed by this wait.`);
  } finally {
    await page.evaluate(() => document.getElementById('recorda-wallet-wait')?.remove());
  }
}
