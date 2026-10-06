# ROADMAP — Recorda

**Source of truth:** [Technical specification](TZ.md), particularly §§2–5: linking record-date ownership to holder rights, execution and proof.

> **“Tokenization tells you who owns the asset. We determine what that ownership entitled them to on the record date, execute the corporate action and prove what happened next.”**

**Central axis: Record Date → Right → Controlled Execution → Verifiable Proof.**

Every feature must advance one of these stages or ensure its correctness. UC/FR/NFR/TC below provide concise traceability to the specification and do not replace its requirements. MVP includes Phases 1–4; Post-MVP does not replace required scenarios.

## Current focus and progress

Branch: **feat/phase-1-react**. Active phase: **Phase 1**, milestone **R1 — React coupon bridge**. Next protocol milestone: **M1.1**, followed by M1.2–M1.6.

- [x] React/npm migration, UI/domain Playwright and runtime/CI fixes.
- [x] Historical code verification at commit a09cd7a: build + 11/11 Playwright, [PR CI](https://github.com/cByteRun/recorda-solana/actions/runs/37360917971).
- [x] README as product presentation; FEATURES and UC/FR/NFR in the roadmap.
- [ ] React Devnet acceptance with manual Phantom signing and recorded transactions/deltas.
- [ ] Latest-version preview: Vercel reported build-rate-limit.
- [ ] Anchor Coupon Core M1.1–M1.6.
- [ ] Full MVP: Coupon + Redemption + Voting, protocol security and proof.

**Checkbox rule:** [x] means completion only within the stated scope and with evidence. An implemented bridge does not satisfy on-chain requirements. Documentation changes do not imply that a new code verification has passed.

## Trace requirements to outcomes

**Specification axis → UC/FR/NFR → milestone FEATURES → golden input/expected → implementation → E2E → actual output/proof.**

Every milestone needs features, an expected business outcome, actual-versus-expected verification and an accurate IMPLEMENTED / SIMULATED boundary.

| Verification layer | What it proves | What it does not cover |
| --- | --- | --- |
| Golden model + domain Playwright | Formula, snapshot/current separation, amounts and output comparison | Actual execution or protocol enforcement |
| UI Playwright | Product axis, holder cards, gating and browser errors | Phantom signing and payment |
| Manual React Devnet acceptance | RPC state, signatures and actual bridge payout deltas | Custom-program immutability and idempotency |
| Anchor integration E2E (planned) | Actual PDA/token state, authority, transitions and repeated calls | UX clarity without interface verification |

**Datasets:** `golden/coupon-tz-section-22.json` implements TZ §22 A/B/C/D = 10/5/2/0, current = 6/9/2/0, coupons = 500/250/100/0 and total 850. R1 deployment and the offline UI use this dataset. `golden/coupon-happy-path.json` retains historical 10/20/5 regression expectations. Neither fixture is evidence of program enforcement.

## Phase 0 — business-flow evidence in the reference prototype

### M0.1 — test instrument and holders

**Outcome:** the operator sees real positions from which rights later arise.
**Axis:** input to Record Date. **UC:** preparation for UC-CP-01, UC-BR-01, UC-VOTE-01.
**FR:** 01–04,09,40 — instrument, parameters, issuance, allocation, balance and transactions.
**NFR:** 05,10,12 — verifiability, reproducibility and no hardcoded operator secret.

**FEATURES**

- [x] Reference Token-2022 KZB26, supply 35 and A/B/C = 10/20/5.
- [x] Disposable holder identities and token accounts.
- [x] Phantom operator and links to real Devnet transactions.

**Verification / exit:** historical reference evidence in golden; mint ownership, supply and holder balances read through RPC. This is not a completed protocol registry.

### M0.2 — coupon reference flow

**Outcome:** coupon entitlement remains tied to the record-date position after a bond transfer.
**Axis:** all four stages in the Browser/Memo bridge. **UC:** UC-CP-01.
**FR:** 10,12,14–16,22–25,27,38–41 — snapshot, entitlement, approval, settlement, proof.
**NFR:** 01,05,09,10 — repeatability, audit and a clear demo; protocol guarantees remain open.

**FEATURES**

- [x] Reference snapshot 10/20/5 and post-record transfer A → B: 4.
- [x] Current ownership 6/24/5 with coupon 500/1000/250.
- [x] Phantom approval and reference KUSD-DEV settlement.
- [x] Memo receipt and reference verifier with RPC outcome checks.

**Verification / exit:** golden/reference evidence describes a historical PASS. FR-13,20,26 and NFR-02,03,06,11 are not satisfied by the Memo/browser implementation.

## Phase 1 — MVP: React bridge and protocol Coupon Core

### R1 — React coupon bridge and reproducible verification

**Outcome:** the same domain flow is available in a maintainable client and automatically verified within supported boundaries.
**Axis:** presents Record Date → Right → Controlled Execution → Verifiable Proof.
**UC:** UC-CP-01; entitlement explanation and outcome verification for specification §6 roles.
**FR:** client scope of 09,12,14–16,20,22–27,40–41; protocol enforcement remains pending.
**NFR:** client coverage of 01–04,08–10,12; NFR-05/06/07/11 require real-chain evidence and the future protocol core.

**FEATURES**

- [x] React + TypeScript + Vite/npm, Tailwind v4, local shadcn-style UI.
- [x] FSD-style structure and ported Phantom/Token-2022 orchestration.
- [x] Holder cards, coupon pipeline, formula, statuses and transaction links.
- [x] Input-derived TZ §22 offline oracle, zero-balance D and full expected-output comparison; historical golden preserved.
- [x] Checked integer minor-unit coupon products/totals, rounding and overflow rejection in the client (FR-20 / NFR-02 client scope).
- [x] Full browser coupon lifecycle with controlled Phantom/RPC, decoded transfers, expected payouts, receipts and reload.
- [x] Negative client flows: snapshot RPC failure/wrong owner, rejected approval, insufficient funding, unavailable balances and corrupted cached amounts.
- [x] Persist broadcast settlement signature before confirmation; block duplicate submission across reload.
- [x] Playwright: snapshot/current invariant, coupon/total, zero, corrupted output, UI/gating/runtime errors.
- [x] npm lockfile, npm ci, CI build/tests and reports.
- [x] Signed-Memo compute budget, pre-sign RPC simulation, account checks and transaction-adapter regression tests.
- [x] Snapshot reads fail closed instead of attesting RPC-error zero fallbacks.
- [x] PR-only CI with stale-run cancellation; merge-only Vercel CLI deployment workflow and disabled Git auto-deployments.
- [ ] Configure VERCEL_TOKEN/VERCEL_ORG_ID/VERCEL_PROJECT_ID and verify the first merge deployment.
- [x] Restored-session wallet gating and local recorded-settlement guard.
- [x] README, ARCHITECTURE and implementation-boundary audit.
- [ ] Manual React Devnet acceptance replay with retained evidence.
- [ ] Working preview of the current version after the Vercel limit is lifted.

**Verification / exit:** Local build + 35/35 Playwright tests passed on 2026-10-06. See [R1 coverage and local verification](R1_TEST_COVERAGE.md). Automated browser tests use controlled RPC and a test wallet. Real Phantom/Devnet flow requires retained manual evidence; M1.1–M1.6 protocol guarantees remain open.

### M1.1 — instrument, eligibility and holder registry

**Outcome:** rights are created for eligible holders of the specified instrument.
**Axis:** foundation for Record Date. **UC:** setup for all three UCs.
**FR:** 01–09,38 — parameters, supply, registry, approve/revoke, transfer control and balances.
**NFR:** 04,10–12 — authority, reproducibility, protocol truth, key safety.

**FEATURES**

- [ ] Anchor workspace, Instrument and HolderPosition PDAs.
- [ ] Obligation parameters, mint/settlement mint, authority and outstanding/redeemed supply.
- [ ] Registry: register/approve/revoke a holder and link the token account.
- [ ] Transfer eligibility control that cannot bypass the registry (FR-08).
- [ ] Token-2022 mint/account validation and client position reads.

**Verification / exit:** integration tests reject incorrect authority and unsuitable accounts; registry/parameters reload from the chain.

### M1.2 — record date and immutable snapshot

**Outcome:** ownership at the required date is known; later transfers do not rewrite rights.
**Axis:** Record Date. **UC:** UC-CP-01, UC-BR-01, UC-VOTE-01.
**FR:** 10–15,38–39 — action, authority, snapshot, finalization, metadata, transitions.
**NFR:** 04,06,11 — authorization, immutability and protocol truth.

**FEATURES**

- [ ] CorporateAction PDA and valid lifecycle transitions.
- [ ] SnapshotPosition for each eligible holder with balance-source validation.
- [ ] create action → snapshot holders → finalize snapshot.
- [ ] Slot/time/hash and protection against finalized-snapshot mutation.
- [ ] Real post-record transfer without changing the snapshot.

**Verification / exit:** TC-03,16,17; golden snapshot 10/20/5 with current 6/24/5. Invalid balances, mutation and transitions are rejected on-chain.

### M1.3 — holder rights and financial calculation

**Outcome:** each holder receives an explainable entitlement based on their record-date position.
**Axis:** Right. **UC:** UC-CP-01; foundation for principal/final coupon and voting power.
**FR:** 16–22 — right types, integer math, per-holder entitlement and total.
**NFR:** 01,02,11 — determinism, precision and protocol truth.

**FEATURES**

- [ ] EntitlementPosition PDA and integer/fixed-point coupon calculation.
- [ ] Calculation from Instrument + SnapshotPosition; frontend amounts are not authoritative.
- [ ] Aggregate obligation and parameter/overflow validation.
- [ ] Data contracts for principal, final coupon and snapshot voting power.

**Verification / exit:** TC-01,02,05; 500/1000/250, total 1750, zero = 0; an incorrect client amount does not change the protocol result.

### M1.4 — approval and once-only payment

**Outcome:** a verified entitlement is executed after authorization without double payment.
**Axis:** Controlled Execution. **UC:** UC-CP-01.
**FR:** 23–27 — preview, approval, settlement, no double payment, finalization.
**NFR:** 03,04,07,08 — idempotency, authority, atomicity, recovery.

**FEATURES**

- [ ] Distribution preview and approve_action with authority validation.
- [ ] Controlled settlement vault and Token-2022 transfer_checked CPI.
- [ ] Per-holder settled state and protection against a second settlement.
- [ ] Safe partial-batch continuation without double payment.
- [ ] Funding checks and total settled versus obligation verification.

**Verification / exit:** TC-04,15,17–19; actual KUSD deltas = 500/1000/250. Repeated/unauthorized calls do not transfer funds.

### M1.5 — receipt and rights/execution history

**Outcome:** investors and auditors see when rights arose, why and what was executed.
**Axis:** Verifiable Proof. **UC:** investor/auditor flows in specification §§6,21.
**FR:** 38–42 — identity, events, tx, receipt, read-only verification.
**NFR:** 05,09,11 — audit, clarity and chain state.

**FEATURES**

- [ ] ActionReceipt PDA and finalization only after the obligation is executed.
- [ ] Events/transaction references linking snapshot, entitlement, approval and outcome.
- [ ] Holder history from action/entitlement state, separate from current wallet balance.
- [ ] Read-only formula explanation and outcome verification.

**Verification / exit:** A: record-date 10, current 6, entitlement/payment 500 and final receipt. An unexecuted action cannot be finalized.

### M1.6 — complete golden Coupon protocol E2E

**Outcome:** actual chain state proves the business axis, beyond cards or a model.
**Axis:** all four stages. **UC:** UC-CP-01.
**FR:** combined acceptance of M1.1–M1.5. **NFR:** 01–12 within Coupon scope.

**FEATURES**

- [ ] Golden fixture → initialize → snapshot → transfer → entitlement → approve → settle → receipt.
- [ ] Oracle compares actual PDA/token-account state with independent expected output.
- [ ] Negative tests: unauthorized, mutation, double settlement, wrong accounts, invalid transitions.
- [ ] Replay specification §22 with A/B/C/D and a zero-balance holder, separately from regression golden.
- [ ] Playwright reads/displays protocol results; signing remains a human action.

**Verification / exit:** TC-01–05,15–19 pass; rights/execution match expected; Memo is not the source of domain truth.

## Phase 2 — MVP: three corporate actions on one engine

### M2.1 — bond redemption

**Outcome:** holders receive principal/final coupon and the corresponding units stop circulating.
**Axis:** Right → Controlled Execution → Verifiable Proof, with shared Record Date.
**UC:** UC-BR-01. **FR:** 05,17–18,28–32,41.
**NFR:** 01–08,11 — precision, correctness, once-only execution and proof.

**FEATURES**

- [ ] Maturity redemption action using the shared snapshot.
- [ ] Principal and separate final coupon.
- [ ] Authority approval and settlement.
- [ ] Unit burn/retirement/lock and outstanding/redeemed supply.
- [ ] Double-redemption protection and outcome receipt.

**Verification / exit:** TC-06–10; 10 bonds → 10000 principal plus the specified coupon; redeemed units cannot be redeemed again.

### M2.2 — bondholder voting

**Outcome:** each vote corresponds to a record-date position and is counted exactly once.
**Axis:** shared Record Date → voting Right → vote → Proof.
**UC:** UC-VOTE-01. **FR:** 19,33–37,41.
**NFR:** 01,03–06,11 — determinism, once-only execution, authority, audit and immutability.

**FEATURES**

- [ ] Proposal, record date, voting window and quorum.
- [ ] Voting power from the finalized snapshot.
- [ ] YES/NO/ABSTAIN and VoteReceipt.
- [ ] Double-vote protection and deadline validation.
- [ ] Final on-chain tally/quorum and proof.

**Verification / exit:** TC-11–14; post-record transfers do not change voting power; the result equals the sum of valid votes.

### M2.3 — shared lifecycle engine

**Outcome:** new events reuse one rights-servicing mechanism.
**Axis:** all four stages. **UC:** all three UCs.
**FR:** 06,10–15,21–24,38–42. **NFR:** 01,04–06,09,11.

**FEATURES**

- [ ] Shared Instrument/Registry/Snapshot and authority rules.
- [ ] Shared identity/history/receipt model with action-specific calculations.
- [ ] Clear UI distinction between the shared lifecycle and Coupon/Redemption/Voting logic.

**Verification / exit:** 3/3 actual E2E scenarios; every completed event has a verifiable outcome.

## Phase 3 — MVP: explain rights in the product

### M3.1 — client reads protocol truth

**Outcome:** opening the client restores history and rights independently of local state.
**Axis:** presentation of the full chain. **UC:** operator journeys for all UCs.
**FR:** 02,05,09,14,21–23,38–41. **NFR:** 09–12.

**FEATURES**

- [x] React/Vite shell and Phantom adapter (implemented early in R1).
- [ ] Generated Anchor IDL/types and PDA reads.
- [ ] UI finalized state from the chain; localStorage only for optional resume/cache.
- [ ] Refresh/restart restores lifecycle and holder rights.

**Verification / exit:** UI data matches PDAs after reload; the client does not determine the final amount.

### M3.2 — Operator / Investor / Auditor journeys

**Outcome:** users understand who is entitled to what and where the proof is within 30–60 seconds.
**Axis:** Record Date → Right → Controlled Execution → Verifiable Proof.
**UC:** three corporate actions and role-specific flows in specification §§6,21.
**FR:** 02,05–09,14,21–25,33–34,38–42. **NFR:** 05,09,10.

**FEATURES**

- [ ] Instruments and holder registry with eligibility/current balance.
- [ ] Corporate-action timeline and action detail with record date/formula/status.
- [ ] Operator preview/approval/execution.
- [ ] Investor: what was due, why and what was executed.
- [ ] Auditor: snapshot/obligation/processed totals/mismatches/tx/receipt.
- [ ] IMPLEMENTED/SIMULATED labels visible in the relevant context.

**Verification / exit:** Playwright journeys for supported steps and the manual-signing boundary; the demo makes the pitch obvious in 30–60 seconds.

## Phase 4 — MVP: acceptance and submission

### M4.1 — correctness and security

**Outcome:** rights and execution remain correct under normal and invalid calls.
**Axis:** guarantees across all four stages. **UC:** all three UCs.
**FR:** 08,11,13,20,24,26,30–32,36–42. **NFR:** 01–12.

**FEATURES**

- [ ] TC-01–19 automated where possible; manual boundaries documented.
- [ ] Integer math, authority, immutable snapshot and valid transitions.
- [ ] No double settle/redeem/vote and partial recovery.
- [ ] Clean Devnet run, protocol/UI consistency and no known P0/P1 issues.
- [ ] No operator secret in the repository/frontend.

**Verification / exit:** mismatch/double execution/unauthorized execution = 0 in the acceptance dataset.

### M4.2 — reproducible demo and submission

**Outcome:** judges understand the idea and reproduce the result.
**Axis:** pitch → live rights lifecycle → proof.
**UC/FR:** all required scenarios and specification §24 DoD. **NFR:** 05,09,10.

**FEATURES**

- [x] README: problem, solution, target audience, edge and product axis.
- [x] Local setup instructions, architecture and implemented/simulated boundaries.
- [ ] Complete working MVP against specification §24 DoD and an evidence-backed coverage table.
- [ ] Demo video: complete Coupon/Redemption/Voting E2E, beyond the interface.
- [ ] Devnet evidence and a clear independent-verification method.

**Verification / exit:** 3/3 scenarios, 100% finalized outcomes with proof; README enables demo reproduction.

## Post-MVP — extend supported rights and integrations

These milestones do not cancel unfinished MVP requirements. UCs here are new scenarios that must first be approved in the specification; existing NFRs remain mandatory.

### P1 — scaling and infrastructure roles

**Axis:** scalable Record Date and Controlled Execution/Proof.
**Specification link:** §26 P1; extends FR-06,12–14,24,39–42 and NFR-04–05,08–11.

**FEATURES**

- [ ] Merkle commitment / indexer for larger registries.
- [ ] Batch processing and richer transfer controls built on mandatory FR-08.
- [ ] Issuer/operator/auditor separation and multisig.
- [ ] Downloadable reports and an extended timeline.

**Verification / exit:** scaling does not change golden rights; batching does not cause repeated processing.

### P2 — additional corporate-action types

**Axis:** new Rights on the shared lifecycle.
**Specification link:** §26 P2; new UC/FR definitions before implementation, NFR-01–08,11.

**FEATURES**

- [ ] Early/partial redemption.
- [ ] Dividends, tender offer/buyback.
- [ ] Conversion and modification-of-terms workflow.

**Verification / exit:** a separate golden/acceptance contract for each new right and execution.

### P3 — external integrations and production model

**Axis:** eligibility → controlled external execution → proof.
**Specification link:** §§20,25–26; new UC/FR definitions, NFR-03–05,07–08,11–12.

**FEATURES**

- [ ] KYC/AML, custody/recovery and external fiat/bank rails.
- [ ] KASE/KCSD/depository adapters after integration-requirement verification.
- [ ] Production security review and an operational/legal model before Mainnet.

**Verification / exit:** external settlement references link to entitlements; actual execution and initiation are clearly distinguished.

## Scope filter

A feature belongs in MVP if it strengthens the central axis, supports a required scenario or satisfies specification FR/NFR/DoD. Otherwise, it belongs in Post-MVP.

README presents the product. ROADMAP tracks delivery and current focus. [ARCHITECTURE](ARCHITECTURE.md) describes implementation. The [audit](PHASE_1_AUDIT.md) records limitations and evidence.
