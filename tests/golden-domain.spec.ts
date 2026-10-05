import { expect, test } from "@playwright/test";
import { GOLDEN_EXPECTED, calculateGoldenEntitlements, goldenPass, runGoldenBlackBox } from "@/features/corporate-action/model/golden";

test.describe("golden coupon domain oracle", () => {
  test("post-record transfer changes current ownership but not record-date rights", () => {
    const actual = runGoldenBlackBox();

    expect(actual.snapshot).toEqual({ A: 10, B: 20, C: 5 });
    expect(actual.currentAfterTransfer).toEqual({ A: 6, B: 24, C: 5 });

    expect(actual.snapshot.A).toBe(10);
    expect(actual.currentAfterTransfer.A).toBe(6);
    expect(actual.entitlementsUsd.A).toBe(500);
  });

  test("entitlements are calculated from snapshot units", () => {
    expect(calculateGoldenEntitlements({ A: 10, B: 20, C: 5 })).toEqual({
      A: 500,
      B: 1000,
      C: 250,
      total: 1750
    });
  });

  test("golden expected output remains stable", () => {
    const actual = runGoldenBlackBox();

    expect(actual.mintSupply).toBe(GOLDEN_EXPECTED.mintSupply);
    expect(actual.snapshot).toEqual(GOLDEN_EXPECTED.snapshot);
    expect(actual.currentAfterTransfer).toEqual(GOLDEN_EXPECTED.currentAfterTransfer);
    expect(actual.entitlementsUsd.A).toBe(GOLDEN_EXPECTED.entitlements.A.amount);
    expect(actual.entitlementsUsd.B).toBe(GOLDEN_EXPECTED.entitlements.B.amount);
    expect(actual.entitlementsUsd.C).toBe(GOLDEN_EXPECTED.entitlements.C.amount);
    expect(actual.entitlementsUsd.total).toBe(GOLDEN_EXPECTED.entitlements.total);
    expect(actual.settlementKusd.A).toBe(GOLDEN_EXPECTED.settlementKusd.A);
    expect(actual.settlementKusd.B).toBe(GOLDEN_EXPECTED.settlementKusd.B);
    expect(actual.settlementKusd.C).toBe(GOLDEN_EXPECTED.settlementKusd.C);
    expect(actual.finalStatus).toBe("FINALIZED");
  });
});



test("TC-02 zero holdings create zero entitlement", () => {
  expect(calculateGoldenEntitlements({ A: 0, B: 0, C: 0 })).toEqual({ A: 0, B: 0, C: 0, total: 0 });
});

test("oracle rejects wrong totals and settlement instead of only checking cards", () => {
  const actual = runGoldenBlackBox();
  expect(goldenPass(actual)).toBe(true);
  expect(goldenPass({ ...actual, settlementKusd: { ...actual.settlementKusd, total: 1 } })).toBe(false);
  expect(goldenPass({ ...actual, entitlementsUsd: { ...actual.entitlementsUsd, total: 1 } })).toBe(false);
});
