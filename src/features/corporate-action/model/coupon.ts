export interface CouponTerms {
  faceValueMinor: number;
  annualCouponBps: number;
  paymentsPerYear: number;
}

function integer(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${name}`);
  return BigInt(value);
}

// Round down once, in settlement minor units. Intermediate products never use floats.
export function couponMinor(units: number, terms: CouponTerms): number {
  const balance = integer(units, "snapshot units");
  const face = integer(terms.faceValueMinor, "face value");
  const bps = integer(terms.annualCouponBps, "coupon bps");
  const periods = integer(terms.paymentsPerYear, "payments per year");
  if (face === 0n || periods === 0n || bps > 10_000n) throw new Error("Invalid coupon parameters");
  const amount = balance * face * bps / (10_000n * periods);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Coupon amount overflow");
  return Number(amount);
}

export function couponDistribution<T extends string>(snapshot: Record<T, number>, terms: CouponTerms) {
  const amounts = {} as Record<T, number>;
  let total = 0n;
  for (const id of Object.keys(snapshot) as T[]) {
    amounts[id] = couponMinor(snapshot[id], terms);
    total += BigInt(amounts[id]);
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Coupon total overflow");
  return { amounts, totalMinor: Number(total) };
}
