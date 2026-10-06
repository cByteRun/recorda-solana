import type { HolderId } from "@/entities/holder/model/types";

export type ActionStatus =
  | "NOT_STARTED"
  | "SNAPSHOTTED"
  | "POST_RECORD_TRANSFER"
  | "CALCULATED"
  | "APPROVED"
  | "SETTLED"
  | "FINALIZED";

export interface SnapshotEntry {
  id: HolderId;
  owner: string;
  units: number;
}

export interface EntitlementEntry {
  units: number;
  amountMinor?: number;
  usd: number;
  formula: string;
}

export interface CorporateActionState {
  actionId: string;
  status: ActionStatus;
  snapshot?: {
    slot: number;
    blockTime: number | null;
    hash: string;
    holders: SnapshotEntry[];
  };
  entitlements?: Record<HolderId, EntitlementEntry> & { totalUsd?: number; totalMinor?: number };
  signatures: Partial<Record<"snapshot" | "transfer" | "entitlement" | "approval" | "settlement" | "receipt", string>>;
  preSettlementKusd?: Partial<Record<HolderId, number>>;
  postSettlementKusd?: Partial<Record<HolderId, number>>;
  pendingSettlementSignature?: string;
}
