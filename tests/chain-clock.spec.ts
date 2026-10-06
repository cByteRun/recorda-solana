import { expect, test } from '@playwright/test';
import { Connection, SYSVAR_CLOCK_PUBKEY, SystemProgram } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { readChainClock, waitForRecordDate } from '../src/shared/solana/chain-clock.mjs';

function clockRpc(timestamps: bigint[]) {
  const rpc = new Connection('https://api.devnet.solana.com');
  let reads = 0;
  rpc.getBlockTime = async () => { throw new Error('Estimated block time must not decide readiness'); };
  rpc.getAccountInfoAndContext = async address => {
    expect(address.equals(SYSVAR_CLOCK_PUBKEY)).toBe(true);
    const data = Buffer.alloc(40);
    data.writeBigInt64LE(timestamps[Math.min(reads, timestamps.length - 1)], 32);
    return { context: { slot: 100 + reads++ }, value: { data, executable: false, lamports: 1, owner: SystemProgram.programId, rentEpoch: 0 } };
  };
  return rpc;
}

test('record date waits for program Clock even when estimated block time would be ahead', async () => {
  const rpc = clockRpc([9n, 9n, 10n]);
  await expect(waitForRecordDate(rpc, 10n, { pollIntervalMs: 1 })).resolves.toEqual({ timestamp: 10n, contextSlot: 102 });
});

test('missing Clock data fails closed instead of enabling an early snapshot', async () => {
  const rpc = clockRpc([10n]);
  rpc.getAccountInfoAndContext = async () => ({ context: { slot: 100 }, value: null });
  await expect(readChainClock(rpc)).rejects.toThrow('snapshot readiness cannot be verified');
});

test('record wait times out explicitly when chain time never reaches the date', async () => {
  await expect(waitForRecordDate(clockRpc([9n]), 10n, { timeoutMs: 0 })).rejects.toThrow('Record date has not arrived on Solana Clock');
});
