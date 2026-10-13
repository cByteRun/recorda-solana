import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  on?(event: "accountChanged" | "disconnect", listener: (publicKey?: PublicKey | null) => void): void;
  removeListener?(event: "accountChanged" | "disconnect", listener: (publicKey?: PublicKey | null) => void): void;
  connect(options?:{onlyIfTrusted?:boolean}): Promise<{ publicKey: PublicKey }>;
  signMessage?(message: Uint8Array, display?: "utf8" | "hex"): Promise<{ signature: Uint8Array; publicKey: PublicKey }>;
  signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

export function getPhantom() {
  const provider = window.phantom?.solana ?? window.solana;
  if (!provider?.isPhantom) {
    throw new Error("Phantom provider not found");
  }
  return provider;
}

