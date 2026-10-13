/** Deterministic UTF-8 JSON: sorted object keys, preserved array order, decimal integers. */
export function canonicalJson(value: unknown): string {
  function normalize(input: unknown): unknown {
    if (typeof input === 'bigint') return input.toString();
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).sort(([a],[b]) => a<b?-1:a>b?1:0).map(([key,value]) => [key,normalize(value)]));
    return input;
  }
  return JSON.stringify(normalize(value));
}
