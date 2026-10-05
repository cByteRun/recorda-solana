export type HolderId = "A" | "B" | "C";

export interface HolderView {
  id: HolderId;
  name: string;
  owner: string;
  bondAta?: string;
  settlementAta?: string;
  currentBondUnits: number | null;
  snapshotUnits: number | null;
  entitlementUsd: number | null;
  settlementKusd: number | null;
  nativeSol: number | null;
}

export const HOLDER_IDS: HolderId[] = ["A", "B", "C"];
