/** Format two-decimal test money without converting a u64 to a floating point number. */
export function mockMoney(value: { toString(): string } | bigint | string) {
  const amount = BigInt(value.toString());
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${whole}.${(absolute % 100n).toString().padStart(2, '0')} Mock USD`;
}

export function percentBps(value: { toString(): string } | string | number) {
  const bps = BigInt(value.toString());
  return `${bps / 100n}${bps % 100n ? `.${(bps % 100n).toString().padStart(2, '0').replace(/0$/, '')}` : ''}%`;
}
