import { Keypair } from "@solana/web3.js";
import type { HolderId } from "@/entities/holder/model/types";

const KEYS = {
  deployment: "kase_real_deployment_v2",
  holders: "kase_real_holders_v2",
  action: "kase_real_action_v2"
} as const;

export interface StoredHolder {
  id: HolderId;
  name: string;
  secretKey: number[];
}

export function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadOrCreateHolderKeypairs() {
  const stored = loadJson<StoredHolder[]>(KEYS.holders);
  if (stored?.length === 3) {
    return stored.map((holder) => ({
      id: holder.id,
      name: holder.name,
      keypair: Keypair.fromSecretKey(Uint8Array.from(holder.secretKey))
    }));
  }

  const holders = (["A", "B", "C"] as HolderId[]).map((id) => ({
    id,
    name: `Investor ${id}`,
    keypair: Keypair.generate()
  }));

  saveJson(
    KEYS.holders,
    holders.map((holder) => ({
      id: holder.id,
      name: holder.name,
      secretKey: Array.from(holder.keypair.secretKey)
    }))
  );

  return holders;
}

export const storageKeys = KEYS;
