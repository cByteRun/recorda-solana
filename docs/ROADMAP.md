# Roadmap

**Current focus:** Phase 1 Coupon human Devnet golden passed; Coupon UX and role views are implemented in M1.7. Next: M2.0 action contracts/compatibility, then Redemption and Voting on the existing engine.

[Specification](TZ.md) · [Requirements](REQUIREMENTS.md) · [Verification](#verification-and-gaps)

## Verification and gaps

Audit: **2026-10-10**. [Test results and artifacts](ARCHITECTURE.md#test-evidence). [Adversarial matrix and findings](SECURITY-AUDIT.md); [all 121 normative IDs](audit-coverage.json) are classified by delivery status with evidence sources and explicit gaps. `npm run test:audit` reproduces the local cross-layer audit; mapping a requirement does not mark it accepted.

Final local audit passed: build/SBF/IDL; React/client/wallet 84/84; Rust 8/8; validator 17/17; protocol browser/audit/usability 27/27; setup 6/6. The complete runner records successful exit codes and stable source/test hashes in `target/security-audit/run.json`. This is current local Coupon evidence, not a fresh human Phantom/Devnet replay or acceptance of the missing MVP scenarios.

| Requirement / feature | Implementation | Test evidence | Result / scope |
| --- | --- | --- | --- |
| Current Coupon attack/recovery audit; FR-07–16,20–27,38–42; NFR-01–09,11; Coupon portion of TC-20/29 | Program transitions/Clock, canonical registry reads, independent audit and immutable wallet payload | `test:audit`: Rust, controlled React/RPC/wallet, actual failed validator transactions and protocol browser | See SECURITY-AUDIT for run evidence; full MVP, typed actions, period deduplication and fresh human Devnet acceptance remain open |
| UC-CP-01; FR-01–04,06–15,38–39 | `programs/recorda/src/lib.rs`: instrument/registry/transfer/snapshot | `protocol-tests/coupon.test.mjs` | Actual PDAs/token accounts; authority, eligibility, late record barrier, snapshot completeness/hash and mutation negatives |
| FR-16,20–22; TC-01–03,05 | `coupon_minor`, `calculate_entitlement` | Rust tests + integration golden/rounding/overflow | A/B/C/D: snapshot 10/5/2/0 → current 6/9/2/0 → coupon 500/250/100/0; total 850 |
| FR-23–27; TC-04,15,17–19 | approve/fund/settle/finalize instructions | Integration + `protocol-ui-tests/coupon.spec.ts` | Actual transfers, funded-vault checks, CPI rollback, duplicate protection and partial reload/resume |
| FR-38–42; TC-16 | receipt/events; `protocol.ts`, `protocol-audit.ts`, protocol page | Integration + `protocol-ui-tests/audit.spec.ts` and browser lifecycle | Independent formula/hash/destination checks; forged rights/receipt and wrong owner fail closed; read-only reopen after clearing storage |
| R1 client boundary / Devnet runner synchronization | Browser/Memo controller; `coupon.ts`, `transactions.ts`, `rpc-fetch.ts`; `scripts/protocol-stage.mjs`, `chain-clock.mjs` | Eight files in `tests/` selected by `test:e2e:golden` | 45 tests: original 36 plus stage waits/progression/errors, program Clock readiness/fail-closed timeout and readiness-slot propagation and disclosure-aware runner controls; controlled RPC/DOM only |
| UC-CP-01; TC-01–03,05; FR-24–25,40–42; NFR-10 | Existing `/protocol` controls + `scripts/devnet-golden.mjs` | `test:e2e:golden:devnet`; saved artifact `target/devnet-evidence/coupon.json` | PASS: human Phantom + independent PDA/payment verification; Coupon happy path accepted, complete NFR-10 scope remains open |
| NFR-01–08,11,12 | Checked program math, constraints, immutable rights, per-holder progress; Phantom operator key | Rust/integration/browser suites + source inspection | Coupon guarantees exercised locally; no comprehensive security review or exhaustive authorization matrix claimed |
| NFR-09–10; TZ §19/21; R1/R3/R4 | React/Vite Coupon role views, guidance and proof at `/` and `/protocol` | Build + `protocol-ui-tests/coupon.spec.ts`, `usability.spec.ts` | Coupon roles, wallet boundaries, recovery and mobile overflow verified locally; Next.js mismatch and multi-action role journeys remain open |
| UC-BR-01; FR-17–18,28–32; TC-06–10 | Only preparatory principal/final-coupon fields | No redemption E2E | Open; field assertions do not satisfy the scenario |
| UC-VOTE-01; FR-19,33–37; TC-11–14 | Only preparatory voting-power field | No voting E2E | Open |

## Reference-driven delivery order

The 2026-10-06 review preserves delivered Coupon functionality and adds explicit implementation/acceptance tasks. [Upstream assessment and local gap map](ARCHITECTURE.md#reference-assessment-and-adaptation) explains what to reuse. External repositories are references, not dependencies already integrated into Recorda.

| Phase | Requirements / acceptance | Adaptation and exit gate |
| --- | --- | --- |
| Phase 1 | Existing UC-CP-01, FR-01–16,20–27,38–42 | Preserve Coupon PDAs, integer math, record barrier, payments and public audit; no rewrite to Merkle or external backend |
| Phase 2 | UC-BR-01, UC-VOTE-01; FR-43–48; NFR-13–15; TC-20–29 plus TC-06–14 | Typed actions, persistent redemption lock, atomic holder-signed burn/payment, explicit voting rules and typed receipts; all three actions pass validator acceptance |
| Phase 3 | FR-05,23,40–42,48; NFR-09,14 | Extend existing FSD client/auditor and roles; recover every action by PDA and verify outcomes independently |
| Phase 4 | TC-01–29; existing hackathon DoD | Preserve Coupon regression and retain human Devnet proof for all three scenarios; extension tests apply without making Post-MVP mandatory |
| P1 | UC-MD-01; FR-49–55,58; NFR-16–19; TC-30–33,35,37–38 | Finalized-slot index, reproducible commitment/proofs, distributor and operations; benchmarks/provenance precede scale claims |
| P2 | UC-PR-01; FR-56; TC-34 | Early/partial redemption builds on accepted full redemption; independent integer allocation fixture |
| P3 | UC-EV-01; FR-57; TC-36 | External adapters/provenance propose events; existing authority controls execution |

Execution dependencies: **M2.0 → M2.3 action contracts → M2.1/M2.2 → Phase 3 → Phase 4 → P1/P2/P3**. Shared primitives come first; each action keeps its own formula and terminal conditions. Same instrument supports Coupon → Voting → Full Redemption in the demo because full redemption ends its active lifecycle.

## Phase 1 — MVP: Coupon foundation

Checked M1.0–M1.5 features are implemented and locally verified; the Coupon happy path also passed human-signed Devnet acceptance. The matching local evidence source/IDL/binary hashes were rechecked on 2026-10-06. Phase 1 Coupon human Devnet golden passed as recorded below. Full TZ acceptance also requires the unfinished Phase 2 actions.

### M1.0 — Browser reference

- [x] React/Vite Browser/Memo coupon reference at `/reference`; `/` now opens the implemented Coupon journey.
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
- [x] 2026-10-10: explicit attack matrix and normative-ID traceability; actual failed burn/transfer/payment transactions verify runtime rollback, and a second Coupon verifies right/vault/receipt account isolation.
- [x] Wallet payload/partial-signature integrity and immutable wire data; preserve the local signature when a broadcast response is lost and block automatic resend after a broadcast attempt.
- [x] Browser signature rejection, reload/resume and forged-proof rejection.
- [x] Human Phantom golden runner code using existing Phase 1 controls, independent payment deltas and public evidence (live Coupon golden passed).
- [x] Five-minute stage waits, busy/audit completion, error diagnostics and pre-payment resume by Action PDA; already completed snapshot/transfer is not repeated.
- [x] Snapshot readiness and default scheduling use Solana Clock sysvar; UI countdown/disable and simulation/broadcast minimum slot prevent early RecordDate calls.
- [x] Synchronize program ID across Rust/Anchor/IDL and deploy on Devnet: `CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF`; CLI confirms deployment at slot 508134659 (on-chain binary hash comparison still separate).
- [x] Execute human Devnet Coupon golden replay; retain signatures, token balance deltas and finalized receipt in `target/devnet-evidence/coupon.json` (2026-10-06, action `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx`).

Partial human Devnet evidence: action `CE5ueNhvatzRjinSwDcrpbad16AzveNgEzkcNDKPiR4S` has verified FINALIZED coupon payments/receipt (850 total, four holders). A→B:4 occurred after finalization, the later action `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx` passed the transfer-before-payout golden replay. Independent read-only audit is `target/devnet-evidence/action-CE5ueNhvatzRjinSwDcrpbad16AzveNgEzkcNDKPiR4S.json`; it is not `coupon.json` from a completed runner.

Optional setup utility: `solana:airdrop` is implemented with unit-tested network/confirmation guards. A live faucet request returned `Internal error`; successful funding is not claimed. The golden runner does not call this utility or depend on faucet availability. Airdrop is not a TZ business feature.

### M1.7 — Coupon UX/UI and role views

- [x] Primary Coupon entry and environment/wallet indicators.
- [x] Lifecycle stages and next-action guidance.
- [x] Inline explanations for blocked controls.
- [x] Instrument, record date, payment and funding summary.
- [x] Snapshot/current balance distinction and rights breakdown.
- [x] Transaction status, Explorer links and recovery guidance.
- [x] Operator, Investor and Auditor views.
- [x] Wallet identity boundaries and read-only demo/audit views.
- [x] Shared typography, spacing, colors and UI components.
- [x] Readable amounts, statuses, addresses and payment proof.
- [x] Form validation and empty/loading states.
- [x] Responsive layout, keyboard focus and accessible labels.
- [x] Coupon role, wallet boundary and recovery checks.

## Phase 2 — MVP: Three actions on one engine

### M2.0 — Action contracts and compatibility

- [ ] Specify action kind/version, immutable parameter commitment and action-specific transition tables (FR-43–44; NFR-13).
- [ ] Define instrument conflict rules and coupon-period deduplication; a generic status enum alone does not enforce them (NFR-15).
- [ ] Choose versioned/new accounts or explicit migration before altering deployed layouts; retain the old Coupon decoder/receipt verification (NFR-14).
- [ ] Review pinned upstream files/tests/licenses before any code reuse; start from the reference locations in ARCHITECTURE rather than porting whole runtimes.
- [ ] Exit: approved implementation contracts in docs, generated IDL/client plan, cross-kind/compatibility acceptance specified in TC-20,28; Coupon stays reproducible.

### M2.1 — Redemption

- [ ] Maturity action using the shared snapshot.
- [ ] Principal and separate final coupon.
- [ ] Explicit approval and settlement.
- [ ] Burn, retirement or lock of redeemed units.
- [ ] Double-redemption protection.
- [ ] Supply/status update and final receipt.
- [ ] Enforce maturity with Solana Clock; persist the redemption lock beyond `finalize_snapshot`, including partial settlement (FR-45; TC-21).
- [ ] Add holder-signed atomic thaw/burn/payment/counter update; existing freeze authority is not burn authority (FR-46; TC-22–23).
- [ ] Freeze/include the final-coupon policy and period; reject a period already paid by Coupon (TC-24).
- [ ] Add redemption math, instructions/accounts/events in `programs/recorda/src/`; regenerate IDL and add `protocol-tests/redemption.test.mjs` and independent principal/burn fixtures.
- [ ] Exit: TC-06–10,21–24 pass with actual token balances/supply, CPI rollback, zero rights and resume; preparatory fields alone do not pass.

### M2.2 — Voting

- [ ] Proposal, record date, voting window and quorum.
- [ ] Voting power from finalized snapshot holdings.
- [ ] YES/NO/ABSTAIN and VoteReceipt.
- [ ] Deadline and double-vote protection.
- [ ] On-chain tally, quorum and final result.
- [ ] Enforce holder signature, unique `(proposal, holder)` receipt, immutable proposal hash/window/rules and exact Clock boundaries (FR-47; TC-25–26).
- [ ] Use the specified abstention/quorum/tie rule; approve/open/finalize without funding a payment vault (TC-27).
- [ ] Add Proposal/VoteReceipt accounts and events in `programs/recorda/src/`; regenerate IDL and add `protocol-tests/voting.test.mjs` plus independent tally fixtures.
- [ ] Exit: TC-11–14,25–27 pass; post-record transfers leave voting power unchanged, proposal acceptance does not automatically modify bond terms.

### M2.3 — Shared engine

- [ ] Shared registry, snapshot and authority rules for all actions.
- [ ] Shared history/receipt with action-specific calculation and execution.
- [ ] Clear Coupon/Redemption/Voting distinction in the UI.
- [ ] Extend existing registry/snapshot/entitlement primitives with typed dispatch; retain per-action snapshots rather than reusing a mutable balance across record dates (FR-43).
- [ ] Bind receipt kind/version/parameter commitment to payment/burn/tally outcomes (FR-48); reject wrong-kind/cross-action accounts and forged results (TC-20,28).
- [ ] Keep Scheduled-only cancellation; document resuming an incomplete snapshot from chain, without implying a post-begin abort exists (TC-29).
- [ ] Exit: Coupon regression remains green, all action-specific transitions/account substitutions are checked and historical receipts decode.

## Phase 3 — MVP: Product journeys

### M3.1 — Protocol-backed client

- [x] Coupon reads and recovery from authoritative chain state.
- [ ] Redemption/Voting reads and recovery.
- [ ] Resolve the Next.js requirement versus React/Vite implementation.

### M3.2 — Operator, Investor and Auditor

- [ ] Reuse the Coupon role views and identity boundaries implemented in [M1.7](#m17--coupon-uxui-and-role-views) for Redemption and Voting.
- [ ] Add action-specific Investor rights/outcomes and Operator/Auditor controls and proof for Redemption/Voting, backed by their own fixtures and role E2E.
- [ ] Complete Instrument, Registry and Action Detail views for all actions.
- [ ] Complete Operator/Investor/Auditor journeys and role restrictions.
- [ ] Consistent IMPLEMENTED/SIMULATED labels.
- [ ] Explain the lifecycle in 30–60 seconds.
- [ ] Extend `src/shared/solana/protocol.ts`, `protocol-audit.ts`, protocol controller and `src/pages/protocol/` in the existing FSD direction; no backend is required for MVP.
- [ ] Show holder-signature requirement for redemption, principal/final coupon separately, retired/remaining supply and vote window/quorum/result.
- [ ] Add action-specific browser/role recovery tests and artifacts under `protocol-ui-tests/`; retain wallet-free Auditor access and exact Coupon golden.
- [ ] Exit: each role completes/reopens its applicable journey on the same instrument; no current balance is presented as historical entitlement.

## Phase 4 — MVP: Acceptance and submission

### M4.1 — Correctness and Devnet

- [ ] TC-01–29 across all three actions, including the reference-driven MVP extension (TC-30–38 are Post-MVP).
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
- [ ] Run Coupon → Voting → Full Redemption on one instrument; show before/after rights, tally and retired supply, with independently checked final receipts.
- [ ] Record upstream pin/file/license inventory for incorporated code and label unimplemented Post-MVP features in the release notes.
- [ ] Demo video showing complete E2E.

## Post-MVP

### P1 — Scale and operations

- [ ] Merkle snapshots/indexer.
- [ ] Role separation and multisig.
- [ ] Richer transfer controls.
- [ ] Reports and extended timeline.
- [ ] P1.1: define finalized-slot data-source/eligibility trust model, index replay/checkpoints and supply reconciliation (FR-49; NFR-16; TC-30).
- [ ] P1.2: specify domain-bound leaf encoding, deterministic manifest/root/totals and retrievable proof storage (FR-50; NFR-17; TC-32).
- [ ] P1.3: adapt the Upside distributor pattern to UC-MD-01, with explicit approval/funding, claim replay/destination protection and deadline/reclaim accounting (FR-51–52; TC-31,33).
- [ ] P1.4: specify transfer policy/expiry/freeze and role/multisig boundaries; bind metadata/terms versions and export paginated history (FR-53–55,58; TC-35,37).
- [ ] P1.5: benchmark compute/rent/transaction/proof costs and publish the supported holder envelope; no unmeasured scale promise (NFR-18; TC-38).
- [ ] Exit: prove historical inputs and distribution reconciliation, proof availability and negative claims before replacing the controlled MVP snapshot. Root membership alone does not verify ownership/formula.

### P2 — Additional actions

- [ ] Early/partial redemption: implement UC-PR-01/FR-56 after M2.1, preserving atomic settlement and persistent unit restrictions (TC-34).
- [ ] Dividends and tender/buyback.
- [ ] Modification workflow.
- [ ] Approved UC/FR and golden acceptance for each new action.
- [ ] Publish per-holder integer rounding/remainder policy; verify 100/300/600 at 20% retires 20/60/120 and leaves supply 800.
- [ ] Reject overlapping retirement, reconcile partial supply/status and distinguish early-full completion from active partial redemption.
- [ ] Exit: independent partial-redemption fixture and negative/rollback/recovery evidence; Voting remains the third hackathon action.

### P3 — External integrations

- [ ] KYC/AML and custody/recovery.
- [ ] Fiat rails and depository adapters.
- [ ] Production security and operational/legal review.
- [ ] Add canonical event adapter and provenance/attestation boundary inspired by CorpShift/CorpAction; deduplicate source delivery and bind evidence/parameters to proposals (UC-EV-01; FR-57; TC-36).
- [ ] Keep KYC PII off-chain; map provider results into versioned eligibility and explicit authority changes rather than copying EVM identity contracts.
- [ ] Exit: adapter retries/tampering/revocation tests pass, source trust is documented and external signals cannot execute unapproved actions.
