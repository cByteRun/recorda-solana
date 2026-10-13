import { SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Clock::unix_timestamp is the program's clock. getBlockTime is only an estimate.
export async function readChainClock(rpc) {
  const { context, value } = await rpc.getAccountInfoAndContext(SYSVAR_CLOCK_PUBKEY, 'confirmed');
  if (!value || value.data.length !== 40) throw new Error('Solana Clock sysvar is unavailable or invalid; snapshot readiness cannot be verified');
  const data = Buffer.from(value.data);
  return { timestamp: data.readBigInt64LE(32), contextSlot: context.slot };
}

export async function waitForRecordDate(rpc, recordTimestamp, { timeoutMs = 300_000, pollIntervalMs = 1000, onProgress } = {}) {
  const record = BigInt(recordTimestamp);
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const clock = await readChainClock(rpc);
    if (clock.timestamp >= record) return clock;
    onProgress?.(clock);
    if (Date.now() >= deadline) throw new Error(`Record date has not arrived on Solana Clock (chain ${clock.timestamp}, record ${record}); resume this Action PDA later`);
    await new Promise(resolve => setTimeout(resolve, Math.min(pollIntervalMs, Math.max(1, deadline - Date.now()))));
  }
}
