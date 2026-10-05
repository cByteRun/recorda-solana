import { Connection, PublicKey } from "@solana/web3.js";

import { createRpcFetch } from "@/shared/solana/rpc-fetch";

export const DEVNET_RPC = import.meta.env?.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const connection = new Connection(DEVNET_RPC, {
  commitment: "confirmed",
  disableRetryOnRateLimit: true,
  fetch: createRpcFetch()
});

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export function explorerTx(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddress(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

