import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createDevnetRpcFetch } from './devnet-rpc-fetch.mjs';

export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export async function assertDevnet(rpc) {
  if (await rpc.getGenesisHash() !== DEVNET_GENESIS) throw new Error('Expected Solana Devnet genesis; refusing this network');
}
export async function devnetConnection() {
  const rpc = new Connection(process.env.RECORDA_DEVNET_RPC || 'https://api.devnet.solana.com', {
    commitment: 'confirmed', fetch: createDevnetRpcFetch(), disableRetryOnRateLimit: true
  });
  await assertDevnet(rpc);
  return rpc;
}
export async function airdrop(rpc, address) {
  await assertDevnet(rpc);
  const key = new PublicKey(address);
  const signature = await rpc.requestAirdrop(key, LAMPORTS_PER_SOL);
  // Poll the actual signature: a blockhash fetched after requestAirdrop is not its expiry proof.
  for (let attempt = 0; attempt < 60; attempt++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true });
    if (status?.err) throw new Error(`Airdrop failed: ${JSON.stringify(status.err)}`);
    if (['confirmed', 'finalized'].includes(status?.confirmationStatus)) return { signature, address: key.toBase58(), balanceLamports: await rpc.getBalance(key) };
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Airdrop confirmation unknown; inspect ${signature} before requesting again`);
}
