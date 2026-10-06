# Changelog

## 2026-10-06 — Audit Phase 1 scope and clarify golden evidence

- [x] Reconcile M1.0–M1.6 with Rust instructions, client/local-validator tests and saved evidence; source/IDL/binary hashes match the existing local run.
- [x] Distinguish client golden simulation, actual local Solana execution and unverified human Devnet replay; keep NFR-10 and full TZ DoD open.
- [x] Remove automatic airdrop from Devnet golden runner; existing wallet SOL is used, optional faucet tooling is outside the business-feature checklist. No successful live airdrop is claimed.
- [x] Check official Devnet RPC: neither the declared program ID nor the deployment keypair public address has an account; document ID synchronization, build/deploy and subsequent Phantom replay.
- [x] Explain TZ/historical golden inputs, minor-unit expected payouts, role boundaries and the remaining Redemption/Voting scope.

## 2026-10-06 — Phase 1 Devnet golden and airdrop

- [x] Correct Devnet genesis guard to the full hash returned by the official Devnet RPC; the truncated value incorrectly rejected Devnet before requesting funds.

- [x] Add `solana:airdrop`: request 1 test SOL for a public address, enforce Devnet genesis, confirm actual faucet signature and expose faucet fallback.
- [x] Add `test:e2e:golden:devnet`: attach to a user's Phantom browser without wallet/RPC substitution; drive existing Phase 1 coupon controls with human signatures.
- [x] Independently compare required golden snapshot/current units, rights, Token-2022 payout deltas, total and receipt; retain public Devnet evidence and read-only hash audit.
- [x] Link TZ → REQUIREMENTS → ROADMAP → golden tests; document Operator versus disposable Investor identities and distinguish local/controlled tests from Devnet acceptance.
- [x] Verification: build passes; existing golden 36/36; airdrop guard/confirmation tests 3/3 (also added to CI); `/protocol` browser controls render with no page errors. Devnet runner syntax checked; human end-to-end execution remains pending.
- [x] Require the configured Recorda ID to match generated IDL; explain that Deploy KZTB26/token mint and ComputeBudget/Associated Token IDs are not Rust program deployment evidence.
- [ ] Live Devnet replay remains pending matching program deployment and human wallet signatures; no Devnet PASS claimed.

## 2026-10-06 — Simplify roadmap

- [x] Use current focus → phases → milestones → feature checklists; preserve completion states.
- [x] Place the verification/gaps matrix at the start of ROADMAP; retain test-artifact details in ARCHITECTURE and update links.

## 2026-10-06 — Resolve npm dependency vulnerabilities

- [x] Override jayson to 5.0.0 and toml to 5.0.0; remove vulnerable uuid/stream-json chains without downgrading Solana/Anchor.
- [x] Replace native bigint-buffer with a small local unsigned JS codec; validate exact LE/BE bytes, u64/u128/u256 limits and invalid inputs in CJS/ESM.
- [x] Regenerate portable lockfile: clean npm ci and npm audit report 0 vulnerabilities; build and IDL check pass.
- [x] Verification: golden 36/36, validator 16/16, protocol browser/audit 4/4; agent-browser page checks pass.

## 2026-10-06 — Preserve TZ detail and refine documentation navigation

- [x] Keep full TZ context, domain rules and architecture; replace only sections already preserved verbatim in REQUIREMENTS with normative links.
- [x] Remove repeated requirements, metrics, datasets and stale implementation claims from PRODUCT; link to their authoritative sections.
- [x] Order README as business problem → solution/value/example → quick start → visible golden validation → protocol/manual/CI details.
- [x] Verify unchanged TZ sections, normative definitions and local file/section links; application code is unchanged.

## 2026-10-06 — Documentation consolidation and cross-layer audit

- [x] Consolidate docs into TZ, REQUIREMENTS, ROADMAP, CHANGELOG, ARCHITECTURE and PRODUCT; setup/operations/manual replay live in README.
- [x] Preserve UC/FR/NFR/TC and MVP DoD definitions in the normative TZ annex; retain section numbers and requirement authority.
- [x] Replace duplicate implementation plan and stale audits with one requirement → code → test → evidence matrix in ROADMAP.
- [x] Rewrite README around the 30–60 second coupon example, actual scope, build and reproducible acceptance.
- [x] Record Next.js/Vite mismatch, preparatory rights fields, RPC-history/snapshot recovery limits and unfinished Redemption/Voting/Devnet work.
- [x] Fresh build/SBF/IDL pass, Rust 4/4, R1 35/35, validator 16/16 and protocol browser/audit 4/4; real payouts, rejected signature, reload/resume and forged-proof rejection verified.
- [x] Install agent-browser outside the repository and verify `/` and `/protocol`: content/controls render, no runtime errors or Vite overlay.
- [x] Rerun protocol E2E without document edits after Vite reloaded the first browser session; final run passed without application/test changes.

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
- [x] Add UC/FR/NFR/TC coverage matrix: [Roadmap verification](ROADMAP.md#verification-and-gaps).
- [x] Verify build and 35/35 Playwright tests with controlled wallet/RPC.
- [x] Fix Linux Playwright setup: install Chromium with system dependencies.
- [ ] Retain real Phantom/Devnet signatures and payout deltas from manual acceptance.
- [ ] Verify deployment secrets, merged-PR deployment and current preview.
- [x] Anchor Coupon Core M1.1–M1.6 delivered separately above; R1 client tests retain their Browser/Memo boundary.
