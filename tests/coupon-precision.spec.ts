import { expect, test } from "@playwright/test";
import fixture from "../golden/coupon-tz-section-22.json" with { type: "json" };
import { couponDistribution, couponMinor } from "@/features/corporate-action/model/coupon";

test("UC-CP-01 FR-15/16/20/22 TC-01/02/03/05: TZ §22 includes zero holder and fixed record-date rights", () => {
  const snapshot = { ...fixture.input.snapshot };
  const current = { ...snapshot };
  current.A -= fixture.input.postRecordTransfer.units;
  current.B += fixture.input.postRecordTransfer.units;
  expect(current).toEqual(fixture.expected.currentAfterTransfer);
  const distribution = couponDistribution(snapshot, fixture.input.terms);
  expect(distribution).toEqual({ amounts: fixture.expected.amountsMinor, totalMinor: fixture.expected.totalMinor });
  expect(snapshot).toEqual(fixture.input.snapshot);
  expect(couponDistribution(current, fixture.input.terms).amounts.A).toBe(30000);
});

test("NFR-01/02: deterministic minor-unit rounding without floating-point products", () => {
  const terms = { faceValueMinor: 101, annualCouponBps: 333, paymentsPerYear: 3 };
  expect(couponMinor(7, terms)).toBe(7);
  expect(couponDistribution({ A: 7, B: 7 }, terms)).toEqual({ amounts: { A: 7, B: 7 }, totalMinor: 14 });
  expect(couponMinor(Number.MAX_SAFE_INTEGER, { faceValueMinor: 1, annualCouponBps: 1, paymentsPerYear: 1 })).toBe(900719925474);
});

test("FR-20 NFR-02: reject invalid financial inputs and overflow", () => {
  for (const units of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => couponMinor(units, fixture.input.terms)).toThrow();
  }
  for (const terms of [
    { ...fixture.input.terms, paymentsPerYear: 0 },
    { ...fixture.input.terms, annualCouponBps: 10001 },
    { ...fixture.input.terms, faceValueMinor: 0 }
  ]) expect(() => couponMinor(10, terms)).toThrow();
  expect(() => couponMinor(Number.MAX_SAFE_INTEGER, fixture.input.terms)).toThrow("overflow");
  expect(() => couponDistribution({ A: Number.MAX_SAFE_INTEGER, B: Number.MAX_SAFE_INTEGER }, {
    faceValueMinor: 1, annualCouponBps: 10000, paymentsPerYear: 1
  })).toThrow("total overflow");
});

// Dependency overrides must preserve actual bytes in both module systems.
test("NFR-02: SPL integer layouts preserve endian bytes and unsigned limits", async () => {
  const esm = await import("@solana/buffer-layout-utils");
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cjs = require("@solana/buffer-layout-utils") as typeof esm;
  const codec = require("../vendor/bigint-buffer/index.cjs");
  for (const api of [esm, cjs]) {
    for (const [little, big, width] of [
      [api.u64, api.u64be, 8], [api.u128, api.u128be, 16], [api.u256, api.u256be, 32]
    ] as const) {
      for (const value of [0n, 1n, 0x0102030405060708n, (1n << BigInt(width * 8)) - 1n]) {
        const le = Buffer.alloc(width), be = Buffer.alloc(width);
        little().encode(value, le, 0); big().encode(value, be, 0);
        expect(little().decode(le, 0)).toBe(value);
        expect(big().decode(be, 0)).toBe(value);
        expect(le).toEqual(Buffer.from(be).reverse());
        const hex = value.toString(16).padStart(width * 2, "0");
        expect(be.toString("hex")).toBe(hex);
      }
    }
  }
  expect(codec.toBigIntLE(Buffer.alloc(0))).toBe(0n);
  expect(codec.toBufferLE(0n, 0)).toEqual(Buffer.alloc(0));
  for (const value of [-1n, 256n]) expect(() => codec.toBufferLE(value, 1)).toThrow(RangeError);
  for (const width of [-1, 0.5, NaN]) expect(() => codec.toBufferBE(0n, width)).toThrow(RangeError);
});
