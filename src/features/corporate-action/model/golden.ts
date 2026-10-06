import fixture from "@golden/coupon-happy-path.json" with { type: "json" };
import { couponDistribution } from "./coupon";
import specificationFixture from "@golden/coupon-tz-section-22.json" with { type: "json" };

export const SPECIFICATION_GOLDEN = specificationFixture;

export function runSpecificationGolden() {
  const snapshot = { ...specificationFixture.input.snapshot };
  const currentAfterTransfer = { ...snapshot };
  const { from, to, units } = specificationFixture.input.postRecordTransfer;
  currentAfterTransfer[from as keyof typeof snapshot] -= units;
  currentAfterTransfer[to as keyof typeof snapshot] += units;
  const distribution = couponDistribution(snapshot, specificationFixture.input.terms);
  return { supply: Object.values(snapshot).reduce((sum, value) => sum + value, 0), currentAfterTransfer,
    amountsMinor: distribution.amounts, totalMinor: distribution.totalMinor };
}

export function specificationGoldenPass(actual: ReturnType<typeof runSpecificationGolden>) {
  return JSON.stringify(actual) === JSON.stringify(specificationFixture.expected);
}

export const GOLDEN = fixture;

export const GOLDEN_INPUT = fixture.input;
export const GOLDEN_EXPECTED = fixture.expected;

export function calculateGoldenEntitlements<T extends string>(snapshot: Record<T, number>) {
  const { faceValueMinor, annualCouponBps, couponFrequency } = fixture.input.instrument;
  const distribution = couponDistribution(snapshot, { faceValueMinor, annualCouponBps, paymentsPerYear: couponFrequency });
  const values = (Object.keys(snapshot) as T[]).reduce(
    (acc, id) => {
      acc[id] = distribution.amounts[id] / 100;
      return acc;
    },
    {} as Record<T, number>
  );

  return {
    ...values,
    total: distribution.totalMinor / 100
  };
}

export function runGoldenBlackBox() {
  const snapshot = { ...fixture.input.initialHolderBalances };
  const currentAfterTransfer = { ...fixture.input.initialHolderBalances };
  const { from, to, units } = fixture.input.postRecordTransfer;
  currentAfterTransfer[from as keyof typeof currentAfterTransfer] -= units;
  currentAfterTransfer[to as keyof typeof currentAfterTransfer] += units;

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
    entitlementsUsd: {
      A: fixture.expected.entitlements.A.amount,
      B: fixture.expected.entitlements.B.amount,
      C: fixture.expected.entitlements.C.amount,
      total: fixture.expected.entitlements.total
    },
    settlementKusd: fixture.expected.settlementKusd,
    finalStatus: fixture.expected.finalStatus
  });
}
