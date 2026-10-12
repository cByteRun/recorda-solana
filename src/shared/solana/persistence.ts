import { selectedWorkspace } from "@/shared/solana/workspaces";
import { Keypair } from "@solana/web3.js";
import { HOLDER_IDS, type HolderId } from "@/entities/holder/model/types";

const KEYS = {
  deployment: `kase_real_deployment_v2:${selectedWorkspace()}`,
  holders: `kase_real_holders_v2:${selectedWorkspace()}`,
  action: `kase_real_action_v2:${selectedWorkspace()}`
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
  const holders = HOLDER_IDS.map((id) => {
    const existing = stored?.find((holder) => holder.id === id);
    return {
      id,
      name: `Investor ${id}`,
      keypair: existing ? Keypair.fromSecretKey(Uint8Array.from(existing.secretKey)) : Keypair.generate()
    };
  });

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
