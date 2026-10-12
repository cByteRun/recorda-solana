import { Connection, PublicKey } from "@solana/web3.js";

import { selectedWorkspace } from "@/shared/solana/workspaces";
import { createRpcFetch } from "@/shared/solana/rpc-fetch";

export const DEVNET_RPC = import.meta.env?.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const LOCAL_RPC = import.meta.env?.VITE_LOCAL_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
export type RpcNetwork = 'devnet'|'local';
export function selectedRpc(): RpcNetwork { return selectedWorkspace()==='test'?'local':'devnet'; }
export const RPC_NETWORK=selectedRpc();
export const RPC_URL=RPC_NETWORK==='local'?LOCAL_RPC:DEVNET_RPC;
export const connection = new Connection(RPC_URL, {
  commitment: "confirmed",
  disableRetryOnRateLimit: true,
  fetch: createRpcFetch()
});

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export function explorerTx(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?${RPC_NETWORK==='local'?`cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`:'cluster=devnet'}`;
}

export function explorerAddress(address: string) {
  return `https://explorer.solana.com/address/${address}?${RPC_NETWORK==='local'?`cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`:'cluster=devnet'}`;
}

