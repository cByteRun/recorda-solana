# Roadmap

**Current focus:** Phase 1 Coupon human Devnet golden passed; Phase 2 — Redemption and Voting remains next.

[Specification](TZ.md) · [Requirements](REQUIREMENTS.md) · [Verification](#verification-and-gaps)

## Verification and gaps

Audit: **2026-10-06**. [Test results and artifacts](ARCHITECTURE.md#test-evidence).

| Requirement / feature | Implementation | Test evidence | Result / scope |
| --- | --- | --- | --- |
| UC-CP-01; FR-01–04,06–15,38–39 | `programs/recorda/src/lib.rs`: instrument/registry/transfer/snapshot | `protocol-tests/coupon.test.mjs` | Actual PDAs/token accounts; authority, eligibility, late record barrier, snapshot completeness/hash and mutation negatives |
| FR-16,20–22; TC-01–03,05 | `coupon_minor`, `calculate_entitlement` | Rust tests + integration golden/rounding/overflow | A/B/C/D: snapshot 10/5/2/0 → current 6/9/2/0 → coupon 500/250/100/0; total 850 |
| FR-23–27; TC-04,15,17–19 | approve/fund/settle/finalize instructions | Integration + `protocol-ui-tests/coupon.spec.ts` | Actual transfers, funded-vault checks, CPI rollback, duplicate protection and partial reload/resume |
| FR-38–42; TC-16 | receipt/events; `protocol.ts`, `protocol-audit.ts`, protocol page | Integration + `protocol-ui-tests/audit.spec.ts` and browser lifecycle | Independent formula/hash/destination checks; forged rights/receipt and wrong owner fail closed; read-only reopen after clearing storage |
| R1 client boundary / Devnet runner synchronization | Browser/Memo controller; `coupon.ts`, `transactions.ts`, `rpc-fetch.ts`; `scripts/protocol-stage.mjs`, `chain-clock.mjs` | Eight files in `tests/` selected by `test:e2e:golden` | 44 tests: original 36 plus stage waits/progression/errors, program Clock readiness/fail-closed timeout and readiness-slot propagation; controlled RPC/DOM only |
| UC-CP-01; TC-01–03,05; FR-24–25,40–42; NFR-10 | Existing `/protocol` controls + `scripts/devnet-golden.mjs` | `test:e2e:golden:devnet`; saved artifact `target/devnet-evidence/coupon.json` | PASS: human Phantom + independent PDA/payment verification; Coupon happy path accepted, complete NFR-10 scope remains open |
| NFR-01–08,11,12 | Checked program math, constraints, immutable rights, per-holder progress; Phantom operator key | Rust/integration/browser suites + source inspection | Coupon guarantees exercised locally; no comprehensive security review or exhaustive authorization matrix claimed |
| NFR-09–10; TZ §19/21 | React/Vite Coupon views and setup | Build + browser tests | Coupon UX locally verified; Next.js mismatch, complete role journeys remain open; Coupon human Devnet replay passed |
| UC-BR-01; FR-17–18,28–32; TC-06–10 | Only preparatory principal/final-coupon fields | No redemption E2E | Open; field assertions do not satisfy the scenario |
| UC-VOTE-01; FR-19,33–37; TC-11–14 | Only preparatory voting-power field | No voting E2E | Open |

## Phase 1 — MVP: Coupon foundation

Checked M1.0–M1.5 features are implemented and locally verified; the Coupon happy path also passed human-signed Devnet acceptance. The matching local evidence source/IDL/binary hashes were rechecked on 2026-10-06. Phase 1 Coupon human Devnet golden passed as recorded below. Full TZ acceptance also requires the unfinished Phase 2 actions.

### M1.0 — Browser reference

- [x] React/Vite Browser/Memo coupon flow at `/`.
- [x] Integer client calculation and golden oracle.
- [x] Transaction simulation, wallet gating and pending-signature guard.

### M1.1 — Instrument and registry

- [x] Instrument and HolderPosition PDAs.
- [x] Token-2022 issuance and registered holder balances.
- [x] Holder approval/revocation.
- [x] Controlled transfers and registry-bypass protection.

### M1.2 — Record date and snapshot

- [x] Scheduled record-date transfer barrier.
- [x] Authorized snapshot capture and supply completeness checks.
- [x] Immutable snapshot with slot, timestamp and hash.
- [x] Scheduled-action cancellation.
- [x] Post-record transfer without changing finalized rights.

### M1.3 — Coupon rights

- [x] Integer coupon calculation from immutable holdings.
- [x] Per-holder entitlement and aggregate obligation.
- [x] Rounding, parameter and overflow validation.

### M1.4 — Controlled settlement

- [x] Distribution preview and explicit authority approval.
- [x] Funded vault and Token-2022 payments.
- [x] Once-only settlement and atomic rollback.
- [x] Safe continuation after partial payment.

### M1.5 — Receipt and client

- [x] On-chain receipt and transition events.
- [x] Coupon operator controls at `/protocol`.
- [x] Holder rights, destinations, paid amounts and transaction links.
- [x] Chain-based history and recovery after reload.
- [x] Public read-only audit of formula, totals and commitments.

### M1.6 — Coupon E2E

- [x] Required and historical golden fixtures.
- [x] Actual validator PDA/token-account verification.
- [x] Authorization, mutation, funding and duplicate-payment negatives.
- [x] Browser signature rejection, reload/resume and forged-proof rejection.
- [x] Human Phantom golden runner code using existing Phase 1 controls, independent payment deltas and public evidence (live Coupon golden passed).
- [x] Five-minute stage waits, busy/audit completion, error diagnostics and pre-payment resume by Action PDA; already completed snapshot/transfer is not repeated.
- [x] Snapshot readiness and default scheduling use Solana Clock sysvar; UI countdown/disable and simulation/broadcast minimum slot prevent early RecordDate calls.
- [x] Synchronize program ID across Rust/Anchor/IDL and deploy on Devnet: `CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF`; CLI confirms deployment at slot 508134659 (on-chain binary hash comparison still separate).
- [x] Execute human Devnet Coupon golden replay; retain signatures, token balance deltas and finalized receipt in `target/devnet-evidence/coupon.json` (2026-10-06, action `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx`).

Partial human Devnet evidence: action `CE5ueNhvatzRjinSwDcrpbad16AzveNgEzkcNDKPiR4S` has verified FINALIZED coupon payments/receipt (850 total, four holders). A→B:4 occurred after finalization, the later action `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx` passed the transfer-before-payout golden replay. Independent read-only audit is `target/devnet-evidence/action-CE5ueNhvatzRjinSwDcrpbad16AzveNgEzkcNDKPiR4S.json`; it is not `coupon.json` from a completed runner.

Optional setup utility: `solana:airdrop` is implemented with unit-tested network/confirmation guards. A live faucet request returned `Internal error`; successful funding is not claimed. The golden runner does not call this utility or depend on faucet availability. Airdrop is not a TZ business feature.

## Phase 2 — MVP: Three actions on one engine

### M2.1 — Redemption

- [ ] Maturity action using the shared snapshot.
- [ ] Principal and separate final coupon.
- [ ] Explicit approval and settlement.
- [ ] Burn, retirement or lock of redeemed units.
- [ ] Double-redemption protection.
- [ ] Supply/status update and final receipt.

### M2.2 — Voting

- [ ] Proposal, record date, voting window and quorum.
- [ ] Voting power from finalized snapshot holdings.
- [ ] YES/NO/ABSTAIN and VoteReceipt.
- [ ] Deadline and double-vote protection.
- [ ] On-chain tally, quorum and final result.

### M2.3 — Shared engine

- [ ] Shared registry, snapshot and authority rules for all actions.
- [ ] Shared history/receipt with action-specific calculation and execution.
- [ ] Clear Coupon/Redemption/Voting distinction in the UI.

## Phase 3 — MVP: Product journeys

### M3.1 — Protocol-backed client

- [x] Coupon reads and recovery from authoritative chain state.
- [ ] Redemption/Voting reads and recovery.
- [ ] Resolve the Next.js requirement versus React/Vite implementation.

### M3.2 — Operator, Investor and Auditor

- [ ] Add `/protocol` role selector: Operator / Investor / Auditor, preserving the selected Action PDA when switching views.
- [ ] Operator: show all holders, total obligation, vault, lifecycle controls and transaction approval; combine Paying Agent for MVP.
- [ ] Investor: show connected holder's current units, record-date units, entitlement, payment destination/status and proof; provide explicit A/B/C/D read-only demo selection.
- [ ] Auditor: wallet-free view of all rights, totals, hashes, receipt and transaction links; no mutation controls.
- [ ] Role selection changes presentation only; wallet identity and program authorization still govern mutations. Demo holder selection never signs as that holder.
- [ ] Define role golden expectations from the same Coupon fixture/action: A 6 current / 10 snapshot / 500 due; B 9 / 5 / 250; C 2 / 2 / 100; D 0 / 0 / 0; Operator/Auditor total 850.
- [ ] E2E: switch roles on one action, verify expected fields/control visibility, disconnected/unauthorized wallets and read-only reopening; add Redemption/Voting role checks when implemented.
- [ ] Complete Instrument, Registry and Action Detail views for all actions.
- [ ] Complete Operator/Investor/Auditor journeys and role restrictions.
- [ ] Consistent IMPLEMENTED/SIMULATED labels.
- [ ] Explain the lifecycle in 30–60 seconds.

## Phase 4 — MVP: Acceptance and submission

### M4.1 — Correctness and Devnet

- [ ] TC-01–19 across all three actions.
- [ ] Authorization, precision, immutability and atomicity across all actions.
- [ ] Safe recovery and no repeated settle/redeem/vote.
- [ ] Human Phantom/Devnet replay with signatures and balance deltas.
- [ ] Clean Devnet run with no known P0/P1 issues.
- [ ] Verify no operator secret in source/frontend.

### M4.2 — Demo and release

- [x] README, product/architecture and requirement-to-evidence mapping.
- [ ] Remote CI verification.
- [ ] Deployment secrets, first merge deployment and current preview.
- [ ] Full TZ DoD and retained proof for 3/3 actions.
- [ ] Demo video showing complete E2E.

## Post-MVP

### P1 — Scale and operations

- [ ] Merkle snapshots/indexer.
- [ ] Role separation and multisig.
- [ ] Richer transfer controls.
- [ ] Reports and extended timeline.

### P2 — Additional actions

- [ ] Early/partial redemption.
- [ ] Dividends and tender/buyback.
- [ ] Modification workflow.
- [ ] Approved UC/FR and golden acceptance for each new action.

### P3 — External integrations

- [ ] KYC/AML and custody/recovery.
- [ ] Fiat rails and depository adapters.
- [ ] Production security and operational/legal review.
