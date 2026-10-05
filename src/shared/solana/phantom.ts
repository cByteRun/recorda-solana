import type { PublicKey, Transaction } from "@solana/web3.js";

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect(): Promise<{ publicKey: PublicKey }>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

export function getPhantom() {
  const provider = window.solana;
  if (!provider?.isPhantom) {
    throw new Error("Phantom provider not found");
  }
  return provider;
}
