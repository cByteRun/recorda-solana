import { test, expect } from "@playwright/test";
import { createRpcFetch } from "@/shared/solana/rpc-fetch";

test("429 honors Retry-After and then returns a successful response", async () => {
  let calls = 0;
  const delays: number[] = [];
  const rpc = createRpcFetch({
    fetcher: async () => ++calls === 1 ? new Response(null, { status: 429, headers: { "retry-after": "2" } }) : new Response("ok"),
    wait: async (ms) => { delays.push(ms); }
  });
  expect(await (await rpc("https://rpc.test")).text()).toBe("ok");
  expect(delays).toContain(2000);
  expect(calls).toBe(2);
});

test("persistent throttling terminates without an infinite retry loop", async () => {
  let calls = 0;
  const rpc = createRpcFetch({ fetcher: async () => { calls++; return new Response(null, { status: 429 }); }, wait: async () => {}, retries: 2 });
  await expect(rpc("https://rpc.test")).rejects.toThrow("RPC rate limit (429)");
  expect(calls).toBe(3);
});

test("concurrent RPC requests are serialized and queue recovers after a failure", async () => {
  const order: string[] = [];
  const rpc = createRpcFetch({
    fetcher: async (input) => { order.push(String(input)); if (String(input).endsWith("first")) throw new Error("offline"); return new Response("ok"); },
    wait: async () => {}
  });
  const first = rpc("https://rpc.test/first");
  const second = rpc("https://rpc.test/second");
  await expect(first).rejects.toThrow("offline");
  expect((await second).status).toBe(200);
  expect(order).toEqual(["https://rpc.test/first", "https://rpc.test/second"]);
});
