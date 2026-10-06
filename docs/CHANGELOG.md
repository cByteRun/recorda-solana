# Changelog

## 2026-10-06 — Phase 1 / M1.1–M1.6: Anchor Coupon Core

- [x] Anchor workspace, pinned Rust/Solana dependencies and generated IDL/types.
- [x] Token-2022 instrument, holder registry, approval/revocation and controlled transfers.
- [x] Protect registered zero-balance accounts from external closure.
- [x] Block ownership/registry changes at the scheduled record date; support authorized cancellation.
- [x] Immutable snapshot with units, capture slot/time, ordering and hash.
- [x] Checked on-chain coupon calculation, holder rights and aggregate obligation.
- [x] Explicit approval, funded vault and Token-2022 payments with atomic rollback.
- [x] Once-only settlement and safe recovery after a partial batch/reload.
- [x] On-chain receipt and per-holder payment amount, destination and slot.
- [x] `/protocol` operator controls, holder rights, history and read-only audit.
- [x] Independently verify formula, totals, snapshot/receipt hashes and program account ownership.
- [x] Golden E2E on Local Validator: TZ §22 total 850 and historical regression total 1750.
- [x] Negative E2E: unauthorized calls, invalid transitions/accounts, late snapshot, duplicate payment, funding, overflow and failed CPI.
- [x] Browser E2E: real validator payments, rejected signature, reload/resume and corrupted proof rejection.
- [x] Protocol CI, evidence artifacts and updated ROADMAP/setup/coverage.
- [x] Validation: Rust 4/4, protocol integration 16/16, browser/audit 4/4, R1 golden 35/35; SBF/build/IDL check pass.
- [ ] Verify remote CI, Devnet deployment and human Phantom acceptance.
- [ ] Implement Phase 2 Redemption and Voting.

## 2026-10-06 — Phase 1 / R1: React coupon bridge

- [x] React/TypeScript/Vite, holder cards, coupon pipeline and transaction links.
- [x] TZ §22 dataset: A/B/C/D = 10/5/2/0; coupon = 500/250/100/0; total = 850.
- [x] Preserve historical golden 10/20/5 as a separate regression.
- [x] Calculate coupon amounts and totals in integer minor units; reject invalid inputs and overflow.
- [x] Validate cached entitlements before payment; derive settlement Memo payouts from actual amounts.
- [x] Show unavailable RPC balances as unknown; abort unsafe allocation/payment.
- [x] Persist settlement signature before confirmation; block repeated payment after reload.
- [x] E2E: snapshot → transfer → calculation → approval → settlement → receipt → reload.
- [x] Negative tests: RPC failure, wrong account owner, rejected approval, insufficient funds, corrupted entitlement and failed confirmation.
- [x] Display IMPLEMENTED/client-owned and SIMULATED boundaries.
- [x] Update README, ROADMAP, architecture, audit and manual Devnet acceptance.
- [x] Add UC/FR/NFR/TC coverage matrix: [R1_TEST_COVERAGE.md](R1_TEST_COVERAGE.md).
- [x] Verify build and 35/35 Playwright tests with controlled wallet/RPC.
- [x] Fix Linux Playwright setup: install Chromium with system dependencies.
- [ ] Retain real Phantom/Devnet signatures and payout deltas from manual acceptance.
- [ ] Verify deployment secrets, merged-PR deployment and current preview.
- [x] Anchor Coupon Core M1.1–M1.6 delivered separately above; R1 client tests retain their Browser/Memo boundary.
