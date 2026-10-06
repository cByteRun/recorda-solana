# Phase 1 PR audit — historical review 2026-10-05

## Current Coupon Core status — 2026-10-06

M1.1–M1.6 now have Local Validator acceptance: Rust 4/4, integration 16/16,
protocol browser/audit 4/4 and R1 regression 35/35. See [Coupon Core](COUPON_PROTOCOL.md).
The R1 review below is historical and retains its client-only boundary; its
unimplemented-Anchor statements describe that earlier baseline. Devnet/human
Phantom acceptance and Phase 2 remain open.

## Current R1 follow-up (2026-10-06)

The owner scoped this follow-up to the current React bridge R1. See [R1_TEST_COVERAGE](R1_TEST_COVERAGE.md) for the current requirement matrix and verification. TZ §22 now drives the four-holder client demo; the historical expected fixture is preserved. Client monetary products/totals now use integer minor units, unavailable balances are unknown, and pending settlement signatures persist before confirmation. The following review records the earlier baseline and must not be read as the current test count or implementation. Manual Devnet evidence and Anchor milestones remain open.

## Scope and verdict

Review of `feat/phase-1-react` against TZ → ROADMAP → golden → React →
Playwright → oracle. React migration is a coupon Browser/Memo bridge;
full hackathon MVP and Anchor protocol are not complete.

## Review checklist

- [x] Read TZ UC/FR/NFR/TC and roadmap milestones.
- [x] Inspect golden input/expected output and oracle independence.
- [x] Trace React lifecycle, storage, Phantom signing and Token-2022 calls.
- [x] Inspect Playwright config and failed remote Actions logs.
- [x] Correct Node 22 JSON import attribute (remote failure root cause).
- [x] Trace revealed Buffer is not defined during SPL module evaluation: dynamically load App after Buffer bootstrap; assert no pageerror in UI tests.
- [x] Commit dependency lockfile; use npm ci in CI.
- [x] Derive model snapshot from input rather than expected.
- [x] Compare all modeled outputs; reject corrupted totals/settlement.
- [x] Gate restored-session workflow on wallet connection.
- [x] Guard already-recorded settlement; persist signature before RPC refresh.
- [x] Correct receipt payload final status to FINALIZED.
- [x] Fix escaped README Markdown and stale React description.
- [x] Document architecture/current phase and preserve unfinished protocol checkboxes.
- [x] Replace original project MIT notice with all-rights-reserved notice;
      third-party licenses remain applicable.
- [ ] Manually sign and replay React Devnet acceptance with recorded signatures.
- [ ] Complete protocol negative tests after Anchor implementation.

## Requirement-to-evidence chain

| TZ | Roadmap | Fixture / implementation | Automated evidence | Boundary / gap |
| --- | --- | --- | --- | --- |
| UC-CP-01; FR-01–04,09 | M0.1 / R1 | Token-2022 mint/ATA/RPC controller | Holder rendering and wallet gating | Real mint/allocations require manual signing |
| FR-12–15; TC-03 | M0.2 / M1.2 | Initial 10/20/5 → snapshot; transfer → 6/24/5 | Domain snapshot independence | Browser/Memo; no protocol immutability |
| FR-16,22; TC-01,02,05 | M1.3 / R1 | Snapshot → 500/1000/250; total 1750 | Exact formula, zero and full expected comparison | Client number arithmetic; NFR-02 not complete |
| FR-24; NFR-04 | M1.4 | Explicit Phantom signTransaction | Disconnected and restored-session gating; missing Phantom error | No program authority constraints |
| FR-25–27; TC-04 | M1.4 | KUSD checked transfers and local signature guard | UI gating only; model payouts are simulation | On-chain idempotency not implemented |
| FR-40,41; NFR-05 | M1.5 | Explorer links and Memo receipt | UI renders lifecycle | Receipt PDA/history not implemented |
| NFR-09,10 | R1 / M3.1 | React/Vite + typed FSD-style client | Chromium UI and TypeScript/Vite build | Clean-origin Devnet run remains manual |
| NFR-11; TC-15–19 | M1.1–M1.6 | Target Anchor architecture only | Not claimed | Protocol authorization, mutation, insufficient funding and recovery pending |
| UC-BR-01; TC-06–10 | M2.1 | Not implemented | None | Redemption remains open |
| UC-VOTE-01; TC-11–14 | M2.2 | Not implemented | None | Voting remains open |

## Remaining correctness risks

1. Browser/localStorage can be edited or lost. Client guards do not enforce
   immutable entitlement or once-only settlement on-chain.
2. Confirmation failure after broadcast is ambiguous. Do not blindly retry a
   payment; reconcile its signature and token deltas first. Current transaction
   adapter does not provide full durable recovery/idempotency.
3. Settlement rail setup persists after several transactions; partial failures
   are not yet safely resumable. M1.4 must move recovery into protocol state.
4. Display refresh can map unavailable balances to zero; snapshot acquisition now
   rereads validated accounts directly and aborts on RPC failure. Protocol-owned
   atomic record-date enforcement is still required.
5. R1 follow-up replaced financial products/totals with integer minor-unit calculations. Program-owned fixed-point validation remains required.
6. Offline oracle emits simulated settlement and FINALIZED. It validates the
   deterministic scenario only; it does not run real wallet/RPC lifecycle.

## Verification

Local build and 11 Playwright tests are the intended automated gate. Remote CI
and Vercel status must be checked for the new commit before declaring release
readiness. Human signing and real-chain validation follow
[MANUAL_DEVNET_ACCEPTANCE](MANUAL_DEVNET_ACCEPTANCE.md).

## Wallet and CI follow-up

- Signed JSON Memo instructions now request 600,000 compute units unless an explicit unit limit already exists. The original snapshot/receipt payload is retained. Compute exhaustion is a plausible cause of Phantom's generic error, not a confirmed diagnosis from the submitted stack trace alone.
- The TypeScript shared adapter simulates before asking Phantom to sign, exposes failed program logs, checks the account, and reports actionable wallet errors. It never automatically re-signs after a known broadcast signature.
- Six mocked transaction-adapter regression tests plus five golden domain tests passed locally; TypeScript/Vite build passed. Real Phantom signing remains manual acceptance. Local Chromium download returned truncated archives, so browser UI execution must be verified by the remote CI gate.
- E2E now triggers on PR updates and manual dispatch, without duplicate push runs. Concurrency cancels older runs of the same PR. GitHub-hosted runner provisioning can still queue; repository YAML cannot guarantee immediate capacity.
- Production deployment is triggered only by a merged same-repository PR to main, checks out its merge commit and reruns build/tests before official Vercel CLI prebuilt deployment. Vercel Git auto-deployments are disabled in vercel.json. The three deployment secrets must be configured before first use.
