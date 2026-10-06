# Changelog

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
- [ ] Implement Anchor Coupon Core M1.1–M1.6; client tests do not close protocol requirements.
