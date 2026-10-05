# ROADMAP — Recorda / KASE Corporate Actions Engine

**Source of truth:** [`docs/TZ.md`](docs/TZ.md).  
**Execution principle:** E2E-first. Each milestone must end in a reproducible business outcome, not merely code completion.  
**Product axis:** **Record Date → Right → Controlled Execution → Verifiable Proof**.

Legend:

- `[x]` demonstrated / complete for the stated milestone scope.
- `[ ]` not complete.
- `UC` / `FR` / `NFR` IDs refer to `docs/TZ.md`.

---

# Phase 0 — Product proof / reference implementation

## M0.1 — Real tokenized instrument and holders ✅

### Goal

Prove that the demo is grounded in real Solana state rather than mock balances.

### Use cases

- Foundation for `UC-CP-01` Coupon Payment.
- Foundation for `UC-BR-01` Bond Redemption.
- Foundation for `UC-VOTE-01` Bondholder Voting.

### Requirements covered

- FR-01 Create tokenized bond instrument.
- FR-02 Store financial parameters in the reference fixture.
- FR-03 Issue Token-2022 test supply.
- FR-04 Distribute tokens among test holders.
- FR-09 Display current registered-holder balances.
- FR-40 Show transaction signatures.
- NFR-05 Auditability.
- NFR-10 Devnet reproducibility.
- NFR-12 No admin private key hardcoded in repository.

### Checklist

- [x] Real Token-2022 `KZB26` mint on Devnet.
- [x] Supply = `35` units.
- [x] Real test holder keypairs A/B/C.
- [x] Real Token-2022 accounts for A/B/C.
- [x] Initial balances `10 / 20 / 5`.
- [x] Phantom operator / fee payer.
- [x] Real Devnet transaction links.

### DoD

- [x] RPC independently returns mint owner = Token-2022.
- [x] RPC independently returns supply = `35`.
- [x] RPC independently returns holder balances = `10 / 20 / 5` before the corporate-action flow.

---

## M0.2 — Coupon vertical slice with black-box E2E oracle ✅

### Goal

Prove the central business hypothesis before writing the custom Anchor protocol.

### Use case

- `UC-CP-01` Coupon Payment — reference / bridge implementation.

### Requirements demonstrated

- FR-10 Corporate action with record date.
- FR-12 Capture holder balances.
- FR-14 Store snapshot slot/time/hash in attestation.
- FR-15 Post-record transfer does not recalculate snapshot.
- FR-16 Coupon entitlement calculation.
- FR-20 Fixed deterministic formula in the fixture.
- FR-23 Coupon preview.
- FR-24 Explicit operator approval.
- FR-25 Real settlement execution using KUSD-DEV.
- FR-27 Finalize coupon action.
- FR-38 Unique action ID.
- FR-39 State-transition evidence via transactions.
- FR-40 Transaction signatures.
- FR-41 Final receipt attestation.
- NFR-01 Determinism.
- NFR-05 Auditability.
- NFR-09 UX clarity.
- NFR-10 Devnet reproducibility.

### Checklist

- [x] Record-date snapshot reads real Token-2022 balances `10 / 20 / 5`.
- [x] Real post-record transfer `A → B: 4 KZB26`.
- [x] Current balances become `6 / 24 / 5`.
- [x] Snapshot remains `10 / 20 / 5`.
- [x] Entitlements remain `$500 / $1,000 / $250`.
- [x] Phantom signs explicit approval.
- [x] Real Token-2022 KUSD-DEV settlement `500 / 1000 / 250`.
- [x] Receipt transaction finalized.
- [x] Black-box verifier re-reads network state and reports `E2E PASS`.

### DoD

- [x] `golden/coupon-happy-path.json` expected output equals independently read actual output.
- [x] Every reference transaction is confirmed/finalized.
- [x] Holder A signs the A→B bond transfer.
- [x] Connected operator signs approval.
- [x] Real KUSD settlement deltas equal entitlements.

### Known limitation / exit condition

This milestone proves the **business flow**, not final protocol trust. Snapshot semantics, entitlement calculation and final action state are still orchestrated by browser code and recorded through Memo attestations.

**Exit to Phase 1:** custom Anchor program becomes the source of finalized corporate-action truth.

---

# Phase 1 — MVP Protocol Core: Move Corporate Action Truth On-Chain

## M1.1 — Anchor workspace + Instrument / Holder state

### Goal

Create the minimal protocol foundation without rewriting the working business flow.

### Use cases

- Instrument setup used by all three required scenarios.
- Holder eligibility used by all three required scenarios.

### Requirements

- FR-01, FR-02, FR-05.
- FR-06 Holder registry.
- FR-07 Approve/revoke test holder.
- FR-09 Current holder balance view.
- FR-38 Unique PDA identity.
- NFR-04 Authorization.
- NFR-11 Critical finalized state must not depend on UI/backend.
- NFR-12 No hardcoded admin keys.

### Checklist

- [ ] Initialize Anchor workspace.
- [ ] Create `Instrument` PDA.
- [ ] Store mint, settlement mint, face value, coupon bps, frequency, maturity, authorities and status.
- [ ] Create `HolderPosition` PDA.
- [ ] Implement `register_holder`.
- [ ] Implement `revoke_holder`.
- [ ] Validate Token-2022 mint/account ownership.
- [ ] Add TypeScript integration tests.

### DoD

- [ ] Unauthorized wallet cannot mutate instrument/registry.
- [ ] Instrument financial parameters are read from PDA, not frontend constants.
- [ ] Holder registry can be reproduced from chain state after refreshing/restarting the client.

---

## M1.2 — CorporateAction state machine + immutable record-date snapshot

### Goal

Move the product's most important truth — **who held how much on the record date** — into protocol-owned state.

### Use cases

- `UC-CP-01` snapshot stage.
- `UC-BR-01` snapshot stage.
- `UC-VOTE-01` voting-power snapshot stage.

### Requirements

- FR-10 Create corporate action with record date.
- FR-11 Authorized snapshot only.
- FR-12 Capture eligible-holder balances.
- FR-13 Finalize immutable snapshot.
- FR-14 Store timestamp/slot/hash or equivalent proof metadata.
- FR-15 Ignore post-record transfers for finalized snapshot.
- FR-38 / FR-39 Action identity and transitions.
- NFR-04 Authorization.
- NFR-06 Snapshot immutability.
- NFR-11 Protocol as source of truth.

### Checklist

- [ ] Create `CorporateAction` PDA.
- [ ] Define state machine: `DRAFT → SNAPSHOTTING → SNAPSHOTTED → CALCULATED → APPROVED → SETTLING → SETTLED → FINALIZED`.
- [ ] Create per-holder `SnapshotPosition` PDA for hackathon scale.
- [ ] Implement `create_corporate_action`.
- [ ] Implement `snapshot_holder`.
- [ ] Implement `finalize_snapshot`.
- [ ] Reject snapshot mutation after finalization.
- [ ] Test real post-record Token-2022 transfer after snapshot.

### DoD

- [ ] Golden scenario: snapshot remains `10 / 20 / 5` while live token accounts become `6 / 24 / 5`.
- [ ] Attempt to modify finalized snapshot fails on-chain.
- [ ] Browser cannot submit arbitrary snapshot units that disagree with validated holder state for the chosen snapshot mechanism.

---

## M1.3 — EntitlementPosition + deterministic financial math

### Goal

Make the program — not JavaScript — calculate and persist holder rights.

### Use cases

- `UC-CP-01` coupon entitlement.
- Foundation for `UC-BR-01` principal/final coupon.
- Foundation for `UC-VOTE-01` voting power.

### Requirements

- FR-16 Coupon entitlement.
- FR-17 Redemption principal foundation.
- FR-18 Final coupon foundation.
- FR-19 Voting power foundation.
- FR-20 Integer/fixed-point arithmetic.
- FR-21 Per-holder entitlement on-chain.
- FR-22 Aggregate total obligation.
- NFR-01 Determinism.
- NFR-02 Precision.
- NFR-11 Protocol source of truth.

### Checklist

- [ ] Create `EntitlementPosition` PDA.
- [ ] Implement integer coupon formula using snapshot units and `Instrument` parameters.
- [ ] Implement `calculate_entitlement`.
- [ ] Prevent frontend from providing the final calculated amount as authoritative input.
- [ ] Accumulate / validate total obligation.
- [ ] Add tests for zero balance and exact 10-bond coupon.

### DoD

- [ ] For `A/B/C snapshot = 10/20/5`, program outputs `500/1000/250` KUSD.
- [ ] Identical inputs always produce identical outputs.
- [ ] No floating-point arithmetic exists in the program.
- [ ] Deliberately wrong frontend amount cannot alter protocol entitlement.

---

## M1.4 — HITL approval + settlement CPI + idempotency

### Goal

Turn a calculated right into controlled execution and guarantee no double payment.

### Use case

- `UC-CP-01` approval and settlement.

### Requirements

- FR-23 Preview distribution.
- FR-24 Explicit approval.
- FR-25 Settlement.
- FR-26 Double-payment protection.
- FR-27 Finalize coupon action.
- NFR-03 Idempotency.
- NFR-04 Authorization.
- NFR-07 Atomicity where possible.
- NFR-08 Recoverability.

### Checklist

- [ ] Implement `approve_action` with operator authority constraint.
- [ ] Implement `settle_holder` using Token-2022 `transfer_checked` CPI for KUSD-DEV.
- [ ] Store destination, settled amount and settled timestamp in `EntitlementPosition`.
- [ ] Reject second settlement of a settled entitlement.
- [ ] Allow safe continuation after partial batch settlement.
- [ ] Track aggregate settled amount.

### DoD

- [ ] Unauthorized approval fails.
- [ ] A receives exactly `500 KUSD`, B `1000`, C `250` from program-controlled flow.
- [ ] Repeating `settle_holder(A)` fails without an additional transfer.
- [ ] Partial A/B settlement can resume with C without paying A/B twice.

---

## M1.5 — ActionReceipt + holder corporate-action history

### Goal

Make the system answer not only “what is the wallet balance?” but **who received what, for which record date, why, and when**.

### Use cases

- `UC-AUDIT-01` View holder corporate-action history.
- `UC-INVESTOR-01` Explain my entitlement.
- Auditor flow from the TZ.

### Requirements

- FR-39 State-transition logging/events.
- FR-40 Transaction proof in client/indexer.
- FR-41 Final ActionReceipt.
- FR-42 Read-only verification view.
- NFR-05 Auditability.
- NFR-09 UX clarity.

### Checklist

- [ ] Create `ActionReceipt` PDA.
- [ ] Implement `finalize_action` only after obligation is fully satisfied.
- [ ] Emit corporate-action events.
- [ ] Expose per-holder history from `SnapshotPosition + EntitlementPosition`.
- [ ] Investor explanation displays record-date units, formula inputs, entitlement and settled amount.
- [ ] Auditor view resolves action state plus relevant transaction signatures.

### DoD

- [ ] Holder A history can show: record date `10 KZB26`, current balance `6`, entitlement `500 KUSD`, settled `500 KUSD`, finalized status and tx proof.
- [ ] Current KUSD wallet balance is not used as a substitute for payment history.
- [ ] Finalized action has an on-chain receipt owned by the Recorda program.

---

## M1.6 — Golden Anchor E2E parity

### Goal

Replace the current Browser/Memo black box while preserving the exact verified business output.

### Requirements

- TC-01, TC-03, TC-04, TC-05.
- TC-15, TC-16, TC-17, TC-18, TC-19.
- NFR-01 through NFR-12 where applicable to Coupon.

### Checklist

- [ ] Consume [`golden/coupon-happy-path.json`](golden/coupon-happy-path.json) in test harness.
- [ ] Initialize `10 / 20 / 5`.
- [ ] Finalize snapshot `10 / 20 / 5`.
- [ ] Transfer `A→B:4` and observe current `6 / 24 / 5`.
- [ ] Program entitlement remains `500 / 1000 / 250`.
- [ ] Settle `500 / 1000 / 250 KUSD`.
- [ ] Finalize ActionReceipt.
- [ ] Negative tests for unauthorized, mutation and double settlement.

### DoD

- [ ] `expected == actual` for the golden fixture.
- [ ] Coupon protocol E2E passes without Memo being the source of domain truth.
- [ ] Browser can be replaced without changing financial outcome.

---

# Phase 2 — MVP Required Corporate Actions (3/3)

## M2.1 — Bond Redemption

### Goal

Satisfy the second required KASE scenario using the same snapshot/entitlement/execution engine.

### Use case

- `UC-BR-01` Bond Redemption at maturity.

### Requirements

- FR-17 Principal calculation.
- FR-18 Final coupon.
- FR-28 Start redemption at maturity.
- FR-29 Principal settlement.
- FR-30 Burn/retire/lock redeemed units.
- FR-31 No double redemption.
- FR-32 Mark instrument redeemed when fully redeemed.
- NFR-03, NFR-04, NFR-07, NFR-08.

### Checklist

- [ ] Create `REDEMPTION` action using common `CorporateAction` model.
- [ ] Calculate principal = snapshot units × face value.
- [ ] Calculate final coupon separately when due.
- [ ] Settle principal/final coupon in KUSD-DEV.
- [ ] CPI burn/retire/lock corresponding KZB26 units.
- [ ] Track redeemed/outstanding supply.
- [ ] Reject second redemption.

### DoD

- [ ] 10 bonds produce `10,000 KUSD` principal plus configured final coupon.
- [ ] Redeemed units are no longer active outstanding bonds.
- [ ] Same units cannot be redeemed twice.
- [ ] Full redemption moves instrument to final redeemed state.
- [ ] Final ActionReceipt exists.

---

## M2.2 — Bondholder Voting

### Goal

Satisfy the required additional corporate action and prove reuse of the same record-date layer beyond payments.

### Use case

- `UC-VOTE-01` Bondholder Voting.

### Requirements

- FR-19 Voting power.
- FR-33 Proposal.
- FR-34 Record date/window/quorum.
- FR-35 YES/NO/ABSTAIN.
- FR-36 No double vote.
- FR-37 Final tally on-chain.
- NFR-01, NFR-03, NFR-04, NFR-06.

### Checklist

- [ ] Create proposal linked to instrument and record-date action.
- [ ] Voting power = finalized snapshot units.
- [ ] Implement YES/NO/ABSTAIN receipt.
- [ ] Reject second vote by same holder for same proposal.
- [ ] Finalize tally on-chain.
- [ ] Demonstrate that post-record transfers do not alter voting power.

### DoD

- [ ] Holder voting power exactly matches record-date snapshot.
- [ ] No double vote.
- [ ] Tally equals sum of valid vote receipts.
- [ ] Final voting ActionReceipt / result is verifiable.

---

## M2.3 — Common lifecycle engine validation

### Goal

Prove that Coupon, Redemption and Voting are configurations of one lifecycle engine, not three unrelated demos.

### Checklist

- [ ] Common `Instrument` and `HolderPosition` reused.
- [ ] Common `CorporateAction` identity/state principles reused.
- [ ] Common record-date/snapshot layer reused.
- [ ] Common authorization/audit conventions reused.
- [ ] UI clearly distinguishes action-specific logic from shared lifecycle infrastructure.

### DoD

- [ ] Required scenarios demonstrated E2E: **3/3**.
- [ ] Every finalized action has verifiable on-chain proof: **100%**.

---

# Phase 3 — MVP Product UX / React / Audit

## M3.1 — React + Vite dApp shell

### Goal

Replace the single-file UI with a maintainable client only after protocol boundaries are stable.

### Requirements

- NFR-09 UX clarity.
- NFR-10 Devnet reproducibility.
- NFR-11 Separation of UI from protocol truth.

### Checklist

- [ ] Initialize Vite + React + TypeScript app.
- [ ] Connect Phantom through supported wallet integration.
- [ ] Use Anchor-generated IDL/types.
- [ ] Read PDAs rather than duplicating finalized business state in client storage.
- [ ] Preserve the proven vertical flow from the reference HTML.

### DoD

- [ ] Refreshing/restarting browser reconstructs corporate-action state from Solana.
- [ ] React contains presentation/orchestration only; final entitlement is not client-authoritative.

---

## M3.2 — Operator / Investor / Auditor views

### Goal

Make the financial logic understandable to non-blockchain judges and users.

### Checklist

- [ ] Instruments view.
- [ ] Holder Registry view.
- [ ] Corporate Actions timeline.
- [ ] Action detail with Record Date → Snapshot → Entitlement → Approval → Execution → Proof.
- [ ] Investor “Why did I receive this amount?” view.
- [ ] Holder corporate-action payment/history view.
- [ ] Auditor read-only verification view.
- [ ] Explorer links / transaction proof.

### DoD

A judge can understand the product without reading source code and can independently verify each core outcome.

---

# Phase 4 — MVP Hardening & Hackathon Submission

## M4.1 — Acceptance/security matrix

### Checklist

- [ ] TC-01…TC-19 automated where practical.
- [ ] No float financial math.
- [ ] No hardcoded authority secret.
- [ ] Invalid state transitions rejected.
- [ ] Unauthorized execution rejected.
- [ ] Double settlement rejected.
- [ ] Double redemption rejected.
- [ ] Double voting rejected.
- [ ] Partial settlement recovery tested.

### DoD

- [ ] Required scenarios pass on clean Devnet deployment.
- [ ] Golden coupon test is reproducible.
- [ ] No known P0/P1 correctness failure.

---

## M4.2 — Submission package

### Checklist

- [ ] Working prototype.
- [ ] Source repository.
- [ ] README quick start.
- [ ] Technical overview: architecture, record-date logic, entitlement, settlement, Solana components.
- [ ] Explicit IMPLEMENTED vs SIMULATED table.
- [ ] Demo video showing full E2E, not static screens.
- [ ] Public/reproducible Devnet evidence as appropriate.

### DoD — Hackathon MVP

All source-of-truth DoD items in `docs/TZ.md §24` are satisfied, including Coupon, Redemption, Voting and final on-chain proof.

---

# Post-MVP

## P1 — Scale and market-infrastructure fit

- [ ] Merkle snapshot commitment for large holder sets.
- [ ] Indexer / snapshot service for scalable holder enumeration.
- [ ] Token ACL / richer permissioned transfer controls.
- [ ] Separate issuer/operator/auditor roles.
- [ ] Squads / multisig authorization.
- [ ] Downloadable action reports.
- [ ] Rich event timeline and reporting.

## P2 — More corporate actions

- [ ] Early redemption.
- [ ] Partial redemption.
- [ ] Dividends.
- [ ] Tender offer / buyback.
- [ ] Token conversion.
- [ ] Modification of instrument terms.

## P3 — Production integrations

- [ ] Real KYC/AML provider.
- [ ] External fiat/bank settlement rail adapter.
- [ ] KASE/KCSD/depository integration research and adapters.
- [ ] Custody / recovery model.
- [ ] Production security review/audit.
- [ ] Mainnet operational model only after legal/compliance validation.

---

# Scope guard

Do not add a feature to MVP unless at least one is true:

1. it improves **Record Date → Right → Controlled Execution → Verifiable Proof**;
2. it is required by a KASE scenario / minimum prototype requirement;
3. it closes a listed FR/NFR/DoD gap;
4. it materially improves live-demo understanding of the core lifecycle.

Otherwise it belongs in Post-MVP.