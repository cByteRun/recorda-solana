export const INSTRUMENT = {
  id: "KASE-BOND-001",
  symbol: "KZB26",
  faceValueUsd: 1000,
  faceValueMinor: 100000,
  annualCouponBps: 1000,
  annualCouponRate: 0.1,
  couponFrequency: 2,
  maturityDate: "2028-12-01",
  decimals: 0,
  initialSupply: 17
} as const;

export const SETTLEMENT = {
  symbol: "KUSD-DEV",
  decimals: 2,
  initialTreasurySupplyUi: 10_000_000
} as const;

export type Instrument = typeof INSTRUMENT;
