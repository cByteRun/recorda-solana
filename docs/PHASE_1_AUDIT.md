# Phase 1 PR audit — 2026-10-05

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
4. RPC read failures currently map some token balances to zero. Snapshot reads
   must fail closed before claiming production correctness.
5. Instrument math uses JS numbers. Fixed-point protocol math remains required.
6. Offline oracle emits simulated settlement and FINALIZED. It validates the
   deterministic scenario only; it does not run real wallet/RPC lifecycle.

## Verification

Local build and 11 Playwright tests are the intended automated gate. Remote CI
and Vercel status must be checked for the new commit before declaring release
readiness. Human signing and real-chain validation follow
[MANUAL_DEVNET_ACCEPTANCE](../tests/MANUAL_DEVNET_ACCEPTANCE.md).
