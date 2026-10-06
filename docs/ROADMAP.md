# Roadmap

Source of truth: [TZ](TZ.md) + [REQUIREMENTS](REQUIREMENTS.md).
**Current focus:** finish the required Redemption and Voting flows, then Devnet acceptance.
**Verified scope:** Coupon Core on Local Validator; full hackathon MVP remains incomplete.
A checkmark means implemented and locally verified within the stated scope. It does not imply Devnet, remote CI or production readiness.

## Phase 1 — Coupon foundation

| Milestone | Delivered feature | Requirements | Evidence |
| --- | --- | --- | --- |
| [x] M1.1 | Instrument/registry, approved holders and controlled Token-2022 transfers | FR-01–09,38; NFR-04,11 | Validator issuance, revoke/approve, account validation and bypass rejection |
| [x] M1.2 | Scheduled record barrier; complete, immutable snapshot with slot/time/hash | FR-10–15,39; TC-03,16,17 | Late-snapshot barrier, mutation rejection and unchanged rights after transfer |
| [x] M1.3 | Integer coupon rights, per-holder and aggregate obligation | FR-16,20–22; TC-01,02,05 | Exact golden payouts, rounding/overflow and independent formula checks |
| [x] M1.4 | Authority approval, funded vault, once-only resumable payment | FR-23–27; TC-04,15,17–19 | Actual payment deltas, failed CPI rollback, duplicate rejection and resume |
| [x] M1.5 | Receipt/events/history and read-only independent audit | FR-38–42; NFR-05,09,11 | Snapshot/receipt commitments, destinations, paid amounts and corrupted proof rejection |
| [x] M1.6 | Golden Coupon E2E through program, token accounts and browser | UC-CP-01; TC-01–05,15–19 | Integration and browser suites below |

Scope qualifications: FR-02 issuer is represented by the combined authority, not a separate issuer field. FR-05 redeemed supply is displayed but remains zero. Principal/final-coupon/voting-power fields are preparation for Phase 2, not completed FR-17–19 scenarios. Security tests cover exercised invalid calls, not every possible instruction/account combination.

- [x] R1 reference at `/`: React/Vite Browser/Memo lifecycle, checked client math, transaction simulation and pending-signature guard.
- [x] Coupon client at `/protocol`: compiler IDL, chain reads, approval/payment controls, reload/history and public audit URL.
- [ ] Human Phantom/Devnet replay with retained signatures and balance deltas.
- [ ] Verify remote CI, deployment secrets and first merge deployment/current preview.

R1 tests use controlled wallet/RPC. Only Coupon Core validator tests establish the on-chain guarantees above.

## Phase 2 — Three actions on one engine

### M2.1 — Redemption / UC-BR-01

- [ ] Maturity action using the shared snapshot; principal and separate final coupon (FR-17–18,28–29).
- [ ] Explicit approval, payment plus atomic/controlled burn, retirement or lock (FR-24,30).
- [ ] Once-only redemption, supply/status update and receipt (FR-05,31–32,41).

**Exit:** TC-06–10; 10 bonds → 10,000 principal plus final coupon; retired units cannot circulate or redeem again.

### M2.2 — Voting / UC-VOTE-01

- [ ] Proposal, record date, voting window/quorum and snapshot power (FR-19,33–34).
- [ ] YES/NO/ABSTAIN, VoteReceipt, deadline and double-vote protection (FR-35–36).
- [ ] On-chain tally/quorum/result (FR-37,41).

**Exit:** TC-11–14; transfers do not change power; tally equals valid votes and never exceeds snapshot supply.

### M2.3 — Shared engine

- [ ] Reuse registry, snapshot, approval/history/receipt across all three action types.
- [ ] Distinguish action-specific calculation/execution in the UI.

**Exit:** actual E2E for 3/3 actions. Extend existing accounts/controllers first; add infrastructure only when requirements demand it.

## Phase 3 — Product journeys

- [x] M3.1 Coupon reads authoritative protocol state and restores rights after reload.
- [ ] M3.1 Redemption/Voting reads and recovery.
- [ ] M3.2 Complete Instrument/Registry/Action Detail and Operator/Investor/Auditor journeys for all actions (TZ §21).
- [ ] Consistent IMPLEMENTED/SIMULATED labels; explain ownership → right → execution → proof in 30–60 seconds.
- [ ] Resolve Next.js requirement versus React/Vite implementation (TZ §19); do not silently amend TZ.

**Exit:** UI matches PDAs, role restrictions hold, all supported journeys have browser coverage.

## Phase 4 — Acceptance and submission

- [ ] M4.1 Complete TC-01–19 across all actions; authorization, precision, immutability, atomicity and safe recovery.
- [ ] M4.1 Clean Devnet replay, no known P0/P1 failures and no operator secret in source/frontend.
- [x] M4.2 README, compact product/architecture and requirement-to-evidence mapping.
- [ ] M4.2 Full TZ DoD, 3/3 demonstrated actions, retained proof and demo video.

**Exit:** zero mismatch, repeated execution and unauthorized execution; every finalized action independently verifiable; README reproduces the demo.

## Post-MVP

- [ ] P1: Merkle/indexer scaling, role separation/multisig, richer transfer controls, reports/timeline.
- [ ] P2: early/partial redemption, dividends, tender/buyback and modification workflow.
- [ ] P3: KYC/AML, custody/recovery, fiat rails, depository adapters and production review.

These do not replace unfinished P0 requirements. Each new action needs its own approved UC/FR and golden acceptance contract.

## Verification and gaps

Audit date: **2026-10-06**. Source → requirements → milestone → implementation → test → actual output:

| Requirement / feature | Implementation | Test evidence | Result / scope |
| --- | --- | --- | --- |
| UC-CP-01; FR-01–04,06–15,38–39 | `programs/recorda/src/lib.rs`: instrument/registry/transfer/snapshot | `protocol-tests/coupon.test.mjs` | Actual PDAs/token accounts; authority, eligibility, late record barrier, snapshot completeness/hash and mutation negatives |
| FR-16,20–22; TC-01–03,05 | `coupon_minor`, `calculate_entitlement` | Rust tests + integration golden/rounding/overflow | A/B/C/D: snapshot 10/5/2/0 → current 6/9/2/0 → coupon 500/250/100/0; total 850 |
| FR-23–27; TC-04,15,17–19 | approve/fund/settle/finalize instructions | Integration + `protocol-ui-tests/coupon.spec.ts` | Actual transfers, funded-vault checks, CPI rollback, duplicate protection and partial reload/resume |
| FR-38–42; TC-16 | receipt/events; `protocol.ts`, `protocol-audit.ts`, protocol page | Integration + `protocol-ui-tests/audit.spec.ts` and browser lifecycle | Independent formula/hash/destination checks; forged rights/receipt and wrong owner fail closed; read-only reopen after clearing storage |
| R1 client boundary | Browser/Memo controller; `coupon.ts`, `transactions.ts`, `rpc-fetch.ts` | Six files in `tests/` selected by `test:e2e:golden` | 35 tests: model/UI, decoded transfers, bad RPC/accounts, rejected approval, funding, corrupted cache and uncertain-signature guard; controlled RPC only |
| NFR-01–08,11,12 | Checked program math, constraints, immutable rights, per-holder progress; Phantom operator key | Rust/integration/browser suites + source inspection | Coupon guarantees exercised locally; no comprehensive security review or exhaustive authorization matrix claimed |
| NFR-09–10; TZ §19/21 | React/Vite Coupon views and setup | Build + browser tests | Coupon UX locally verified; Next.js mismatch, complete role journeys and human Devnet replay open |
| UC-BR-01; FR-17–18,28–32; TC-06–10 | Only preparatory principal/final-coupon fields | No redemption E2E | Open; field assertions do not satisfy the scenario |
| UC-VOTE-01; FR-19,33–37; TC-11–14 | Only preparatory voting-power field | No voting E2E | Open |

Fresh local checks: **build/SBF/IDL pass; Rust 4/4; R1 35/35; validator 16/16**. **Protocol browser/audit 4/4 passed** on the final uninterrupted run. The first browser lifecycle failed during a Vite full reload while documents were being edited; trace captured the reload, and rerun without edits passed unchanged. `agent-browser` 0.38.2 also checked `/` and `/protocol`: meaningful content/controls, no runtime errors or Vite overlay; screenshots in `/tmp/recorda-doc-audit-{home,protocol}.png`. Rust count includes generated `test_id`; integration count includes its parent test (15 subtests + parent), so counts are not requirement counts.

Evidence generated by `protocol:test:ui`: `target/protocol-evidence/coupon.json` (expected/actual, signatures, source/binary/IDL hashes), `coupon-ui.json`, `coupon-ui.png`, Playwright reports/traces. Ignored artifacts are local evidence, not checked-in release proof. `.github/workflows/e2e.yml` defines CI; remote execution was not checked in this audit.

Known boundaries: scheduled snapshots lock ownership from record time; registration/issuance seals at first snapshot; only one pending snapshot per instrument; revoke/approve requires zero balance; signatures depend on RPC history (latest 100 queried); no recovery/cancellation after starting an incomplete snapshot is claimed. R1 browser truth remains mutable and uncertain payments require reconciliation. [ARCHITECTURE](ARCHITECTURE.md) describes these restrictions; [README](../README.md#manual-acceptance) describes the human replay.
