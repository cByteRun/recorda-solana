// Retry only idempotent JSON-RPC reads; never replay a send or faucet request.
const reads = new Set(['getAccountInfo', 'getMultipleAccounts', 'getProgramAccounts', 'getGenesisHash', 'getBalance', 'getSignaturesForAddress', 'getTransaction', 'getSignatureStatuses', 'getTokenAccountBalance', 'getSlot', 'getBlockTime']);
export function createDevnetRpcFetch({ fetcher = globalThis.fetch.bind(globalThis), wait = ms => new Promise(resolve => setTimeout(resolve, ms)), retries = 3, spacingMs = 200, timeoutMs = 15_000, onRetry = console.warn } = {}) {
  let tail = Promise.resolve();
  return (input, init) => {
    const request = tail.then(async () => {
      let method;
      try { method = JSON.parse(init?.body).method; } catch { /* Unknown requests cannot be retried. */ }
      for (let attempt = 0; ; attempt++) {
        let response;
        try {
          response = await fetcher(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
        } catch (error) {
          if (!reads.has(method) || attempt >= retries || init?.signal?.aborted) throw error;
          onRetry(`Devnet RPC ${method}: network error; retry ${attempt + 1}/${retries}`);
          await wait(1000 * 2 ** attempt);
          continue;
        }
        if (!reads.has(method) || ![429, 502, 503, 504].includes(response.status) || attempt >= retries) return response;
        const seconds = Number(response.headers.get('retry-after'));
        await response.body?.cancel();
        onRetry(`Devnet RPC ${method}: HTTP ${response.status}; retry ${attempt + 1}/${retries}`);
        await wait(Math.min(30_000, Math.max(1000 * 2 ** attempt, Number.isFinite(seconds) ? seconds * 1000 : 0)));
      }
    });
    tail = request.then(() => wait(spacingMs), () => wait(spacingMs));
    return request;
  };
}
