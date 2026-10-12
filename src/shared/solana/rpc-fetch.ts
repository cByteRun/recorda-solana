/** Serialize RPC requests and bound retries to avoid bursts on public Devnet. */
export function createRpcFetch({
  fetcher = globalThis.fetch.bind(globalThis),
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  spacingMs = 200,
  retries = 3
}: {
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  spacingMs?: number;
  retries?: number;
} = {}): typeof fetch {
  let tail: Promise<unknown> = Promise.resolve();
  return (input, init) => {
    const request = tail.then(async () => {
      for (let attempt = 0; ; attempt += 1) {
        const response = await fetcher(input, init);
        if (response.status !== 429) return response;
        if (attempt >= retries) {
          throw new Error("Solana RPC rate limit (429). Wait before retrying, configure another browser-accessible Devnet RPC endpoint.");
        }
        const header = response.headers.get("retry-after");
        const seconds = header === null ? NaN : Number(header);
        const retryMs = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header ?? "") - Date.now();
        await response.body?.cancel();
        await wait(Math.min(30_000, Math.max(1000 * 2 ** attempt, Number.isFinite(retryMs) ? retryMs : 0)));
      }
    });
    tail = request.then(() => wait(spacingMs), () => wait(spacingMs));
    return request;
  };
}
