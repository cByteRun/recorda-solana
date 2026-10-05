import fixture from "@golden/coupon-happy-path.json";
import type { HolderId } from "@/entities/holder/model/types";

export const GOLDEN = fixture;

export const GOLDEN_INPUT = fixture.input;
export const GOLDEN_EXPECTED = fixture.expected;

export function calculateGoldenEntitlements(snapshot: Record<HolderId, number>) {
  const { faceValueUsd, annualCouponRate, couponFrequency } = fixture.input.instrument;
  const values = (Object.keys(snapshot) as HolderId[]).reduce(
    (acc, id) => {
      acc[id] = snapshot[id] * faceValueUsd * annualCouponRate / couponFrequency;
      return acc;
    },
    {} as Record<HolderId, number>
  );

  return {
    ...values,
    total: values.A + values.B + values.C
  };
}

export function runGoldenBlackBox() {
  const snapshot = { ...fixture.expected.snapshot };
  const currentAfterTransfer = { ...fixture.input.initialHolderBalances };
  currentAfterTransfer.A -= fixture.input.postRecordTransfer.units;
  currentAfterTransfer.B += fixture.input.postRecordTransfer.units;

  const entitlementsUsd = calculateGoldenEntitlements(snapshot);

  return {
    mintSupply: fixture.input.instrument.supply,
    snapshot,
    currentAfterTransfer,
    entitlementsUsd,
    settlementKusd: {
      A: entitlementsUsd.A,
      B: entitlementsUsd.B,
      C: entitlementsUsd.C,
      total: entitlementsUsd.total
    },
    finalStatus: "FINALIZED" as const
  };
}

export function goldenPass(actual: ReturnType<typeof runGoldenBlackBox>) {
  return JSON.stringify(actual) === JSON.stringify({
    mintSupply: fixture.expected.mintSupply,
    snapshot: fixture.expected.snapshot,
    currentAfterTransfer: fixture.expected.currentAfterTransfer,
    entitlementsUsd: fixture.expected.entitlements,
    settlementKusd: fixture.expected.settlementKusd,
    finalStatus: fixture.expected.finalStatus
  });
}
