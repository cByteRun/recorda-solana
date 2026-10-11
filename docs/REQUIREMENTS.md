# Requirements — normative TZ annex

This file is part of [TZ](TZ.md), with the same authority. Original section numbers and UC/FR/NFR/TC IDs are retained; new IDs are appended. Delivery status belongs in [ROADMAP](ROADMAP.md); evidence is maintained in [ROADMAP](ROADMAP.md#verification-and-gaps).

Current human Devnet MVP reproduction for Coupon, Voting and Redemption is described in [the demo guide](DEVNET-DEMO.md) and [README](../README.md#devnet-demo--coupon--voting--redemption), using a real Operator and A/B/C Phantom accounts. `test:e2e:actions:devnet` supplies happy-path evidence; `test:audit` retains feature and attack coverage, including TC-04/15–19 negative scenarios and Post-MVP. Airdrop supplies test SOL for fees/rent, not coupon funding. Historical v1 evidence does not establish current v2 acceptance.

## KASE track source and coverage

Reviewed 2026-10-11 against the full track brief supplied in the conversation (About KASE, Challenge, Eligibility, Required Scenarios, Minimum Prototype Requirements, Example, Submission Requirements and Judging Criteria). That supplied text is the external requirements baseline for this review; this is not a claim of re-verifying the current listing. The [listing](https://superteam.fun/earn/listing/superteam-kazakhstan-x-kase-side-track-corporate-actions-on-blockchain) is its provenance reference.

The track defines what must be demonstrated; TZ/this annex define Recorda's chosen solution. Architecture, source mappings and historical tests cannot override the brief or establish current submission acceptance. All product obligations below already have normative coverage; administrative/submission gates are tracked separately without inventing feature IDs.

| Track obligation | Existing normative coverage / business domain | Acceptance evidence required |
|---|---|---|
| Identify eligible holders | FR-06–15; registry and record-date rights; TZ §§9–10 | Complete eligible population and balances at cutoff, reconciled to supply |
| Calculate entitlements | FR-16–22; Coupon, Redemption, Voting | Per-holder integer calculations and aggregate reconciliation |
| Execute or initiate action | FR-24–37,43–47; authorized lifecycle | Real Solana execution or an explicit, verifiable initiation flow |
| Record outcome; core components on Solana | FR-21–22,37–42,48; audit domain; TZ §§18–19 | Action-linked on-chain rights, result/receipt and transaction evidence for all three scenarios |
| Coupon at specified record date | UC-CP-01; FR-10–16,20–27; TC-01–05,16 | 10 × 1,000 × 10% ÷ 2 = 500; later transfers preserve rights; once-only settlement |
| Maturity redemption and token retirement | UC-BR-01; FR-17–18,28–32,45–46; TC-06–10,21–24 | 10,000 principal for 10 bonds, separate final coupon if due, atomic retirement/payment and supply reconciliation |
| One additional action | UC-VOTE-01; FR-19,33–37,47; TC-11–14,25–27 | Holder-signed snapshot voting, window/quorum/tally and final on-chain result |
| Test tokenized instrument | FR-01–05; TZ §8 | On-chain instrument/mint, distributed test units and terms |
| Holder registry and record-date mechanism | FR-06–15; TC-03,12,16,29 | Controlled custody and cutoff barrier, complete immutable snapshot |
| Functional entitlement and Solana flow despite simulated rails | FR-16–22,25,29–30,37–41; TZ §20 | Program-enforced rights/execution; mock money and integrations clearly labelled |
| Example: semi-annual 10%, face 1,000, maturity 2 years | TZ §8; UC-CP-01 / UC-BR-01 | Baseline formulas; accelerated demo dates disclosed rather than presented as two elapsed years |
| Main-hackathon registration | TZ §1; submission gates below | Team registration confirmation; cannot be inferred from code/tests |
| Prototype, video, repository, technical overview, simulation disclosure | TZ §24 and submission gates below | Actual submission artifacts and current evidence |
| Judging weights 30/25/20/15/10% | TZ §27; role/UX requirements and NFRs | Demonstrate technical completeness, action correctness, usable journeys, realistic boundaries and shared lifecycle innovation |

KASE's support for equities, bonds, FX, derivatives and money markets describes the exchange context; the brief does not require implementing every asset class. Recorda selects bonds and Voting. The listed additional actions are alternatives, not cumulative obligations. Token-2022, Phantom, Operator approval, holder-signed burn and a Devnet deployment are project design choices, not additional mandates of the track. Post-MVP features cannot substitute for any of the three required demonstrations.

### Causal acceptance chain

| Cause / prerequisite | Required effect and completion gate | Existing coverage |
|---|---|---|
| Registered instrument, permitted custody and a scheduled cutoff | At the cutoff no balance-changing operation can alter the population before capture; a late snapshot does not move the record date | FR-01–15; TZ §9; TC-16,29 |
| Complete, reconciled, finalized snapshot | Immutable action-specific rights derive from record-date units and copied terms; post-record transfers change current holdings only | FR-13–22,43; TC-01–03,05,11–12,16 |
| Correct rights, explicit approval and sufficient payment funds | Coupon payment occurs once; failure leaves balances/counters unchanged and partial progress remains visible | FR-24–27,44; TC-04,15,17–19 |
| Maturity, secured units, approved funded redemption and holder signature | Principal/final coupon and retirement execute atomically; full reconciliation ends active supply; unpaid/unretired units block full completion | FR-28–32,45–46; TC-06–10,21–24 |
| Approved proposal, fixed rights and open voting window | Unique holder votes produce quorum/tally after closing; no funding dependency or automatic terms modification | FR-33–37,47; TC-11–14,25–27 |
| All action-specific completion conditions met | Receipt binds inputs, totals and actual outcome; an interface status, content hash or simulated payment cannot stand in for execution proof | FR-38–42,48; TC-20,28; NFR-05,14 |

A shared engine means shared rules and machinery, not reuse of one historical holder allocation for every event. Each action has its own cutoff, rights and receipt. On one instrument demonstrate Coupon → Voting → Full Redemption: full redemption removes the active supply needed for subsequent holder voting. If a Coupon post-record transfer changes A/B from 10/5 to 6/9, later snapshots use the then-current 6/9; the earlier Coupon rights remain 10/5. The separate no-transfer Devnet fixture retains 10/5/2 and must not be represented as demonstrating that edge case.

### Submission gates

These are delivery obligations of the brief, separate from FR implementation and the historical live DoD checks. Open means confirmation/artifact evidence is still required, not necessarily that the team has not performed the step.

- [ ] Confirm the participating team is officially registered for the main hackathon.
- [ ] Deliver the working prototype with current three-scenario acceptance and reproducible setup ([ROADMAP](ROADMAP.md#remaining-acceptance-and-release-work), [DEVNET-DEMO](DEVNET-DEMO.md)).
- [ ] Provide the source repository URL/access for judges; local source files alone do not prove submission access.
- [ ] Record and attach a demo video showing all three functional flows and their Solana outcomes.
- [ ] Attach a short technical overview covering architecture, record-date logic, entitlement calculations, settlement flow and Solana components; [ARCHITECTURE](ARCHITECTURE.md) and [TZ §§8–9,18–20](TZ.md#8-test-bond-model) supply the covered material.
- [ ] Clearly distinguish implemented program/client functionality from mock money, simulated KYC, conceptual fiat rails and unhosted Post-MVP integrations in the submitted overview and video.

## Scope of the reference-driven extension

Reviewed 2026-10-06 against the local Coupon program/client/tests and the linked upstream repository documentation. [Reference assessment](ARCHITECTURE.md#reference-assessment-and-adaptation) distinguishes documented patterns from tested Recorda behavior. The requirements below remain design/acceptance obligations; current implementation and evidence are tracked in ROADMAP, not inferred from their inclusion here.

MVP remains **Coupon + Full Redemption + Bondholder Voting**. FR-43–48 and NFR-13–15 refine the typed MVP action contracts. UC-PR-01, UC-MD-01, UC-EV-01, FR-49–58, NFR-16–19 and TC-30–38 are explicitly Post-MVP. They do not expand the hackathon DoD. Existing Coupon implementation and its golden dataset remain the baseline to preserve.

## Checklist legend and business domains

The supplied KASE brief takes precedence for track obligations; [TZ](TZ.md) and this annex define the selected solution and explicitly scoped Recorda additions. This annex preserves existing requirement IDs and wording. The checklist annotations below are a view of [audit-coverage.json](audit-coverage.json), not a change to normative scope. `[x]` means source implementation (UC/FR/NFR) or executable test coverage (TC) is mapped; `[ ]` means the mapped status remains partial or undelivered. These marks do not claim that the current revision passed its suites or that the live hackathon DoD is complete. Fresh execution evidence belongs in [ROADMAP](ROADMAP.md#verification-and-gaps), [security audit](SECURITY-AUDIT.md) and the separate DoD at the end of this file.

**Central axis from TZ §§3,7,9,18:** Instrument → Holder → Record-date Right → Authorized Action → Receipt. The domains below group existing obligations; they introduce no new features or IDs.

| Business domain | TZ basis | UC / functional requirements | Cross-cutting quality requirements |
|---|---|---|---|
| Bond instrument & holder registry | [§8](TZ.md#8-test-bond-model), [§10](TZ.md#10-holder-registry), [§18](TZ.md#18-on-chain-data-model) | Shared by MVP UCs; FR-01–09 | NFR-04,07,11 |
| Record date & immutable rights | [§7](TZ.md#7-main-e2e-scenario), [§9](TZ.md#9-record-date--critical-mechanism) | UC-CP-01 / UC-BR-01 / UC-VOTE-01; FR-10–22 | NFR-01–02,05–06,08 |
| Coupon servicing | [§12](TZ.md#12-required-scenario-a--coupon-payment), [§20](TZ.md#20-settlement-model) | UC-CP-01; FR-16,20–27 | NFR-02–04,07–08 |
| Maturity & partial retirement | [§13](TZ.md#13-required-scenario-b--bond-redemption), [§26](TZ.md#26-development-priorities); Post-MVP refinement in this annex | UC-BR-01 / UC-PR-01; FR-17–18,28–32,45–46,56 | NFR-02–04,07–08,15 |
| Holder decisions | [§14](TZ.md#14-required-scenario-c--bondholder-voting) | UC-VOTE-01; FR-19,33–37,47 | NFR-01,03–04,06,13,15 |
| Authorized lifecycle & eligibility | [§11](TZ.md#11-corporate-action-state-machine), [§15](TZ.md#15-human-in-the-loop--execution-control), [§26](TZ.md#26-development-priorities) | All UCs; FR-43–44,53–55 | NFR-04,11–15 |
| Distribution commitments & source events | [§9.3](TZ.md#93-production-evolution), [§26](TZ.md#26-development-priorities), [§31](TZ.md#31-sources-and-specification-basis); Post-MVP refinements in this annex | UC-MD-01 / UC-EV-01; FR-49–52,57 | NFR-16–19 |
| Audit, role journeys & reproducibility | [§6](TZ.md#6-users-and-roles), [§18](TZ.md#18-on-chain-data-model), [§21](TZ.md#21-ux-requirements), [§24](TZ.md#24-definition-of-done--hackathon-mvp) | All UCs; FR-05,23,38–42,48,58 | NFR-05,08–10,14,17 |

MVP domains remain Coupon, Full Redemption and Voting with shared instrument/registry/rights/audit. Claims, richer governance/eligibility/terms, partial retirement and external proposals remain the specified Post-MVP extension; their implementation does not expand hackathon DoD.

## 6. Users and roles

### Protocol role views — acceptance

`/protocol` must allow Operator / Investor / Auditor view selection without changing the current Action PDA. Operator includes Paying Agent for MVP and sees lifecycle controls, all holders, total obligation and vault. Investor sees the connected holder's current units, record-date units, entitlement, destination, payment status and proof. Auditor can open the action without a wallet and sees all rights, totals, hashes, receipt and transaction links with no mutation controls.

When the browser retains matching demo identities, Investor may explicitly select A/B/C/D in **read-only demo mode**; this selection is not wallet authentication and cannot sign as the selected holder. Role selection never grants authority: wallet identity and on-chain authorization govern mutations. Disconnected or unknown investors see a connect/no-position state, never another holder presented as their own.

Role golden/E2E acceptance uses the same action and `golden/coupon-tz-section-22.json`: A current/snapshot/payout = 6/10/500, B = 9/5/250, C = 2/2/100, D = 0/0/0; Operator/Auditor total = 850. Tests must cover switching without losing the action, field/control visibility, unauthorized wallets and wallet-free audit. Coupon role views and this golden acceptance are implemented and locally verified in ROADMAP M1.7; Redemption/Voting expectations follow their own implemented action-specific fixtures.

### R1. Market / Corporate Actions Operator
A representative of KASE, depository infrastructure or an authorized operator.

Can:
- create/register a test instrument;
- create a corporate action;
- set the record date;
- initiate a snapshot;
- review calculated entitlements;
- approve the action;
- initiate settlement;
- finalize the event;
- view the audit trail.

### R2. Issuer / Paying Agent
Can:
- view obligation parameters;
- fund the settlement vault;
- confirm payment readiness;
- view the final report.

For MVP, this role may be combined with Operator.

### R3. Holder / Investor
Can:
- view their tokens;
- view record-date eligibility;
- view their entitlement;
- view payment/redemption status;
- verify the Solana transaction;
- participate in bondholder voting.

### R4. Auditor / Observer
Read-only role.

Can verify:
- instrument parameters;
- snapshot;
- the formula;
- entitlement;
- settlement transaction;
- burn/retirement;
- the final receipt.

## 12. Required Scenario A — Coupon Payment

### UC-CP-01: Coupon payment

- [x] Source implementation mapped for **UC-CP-01**; current execution/live acceptance is a separate evidence gate.

#### Preconditions
- instrument active;
- coupon action scheduled;
- record date reached;
- snapshot finalized;
- entitlements calculated;
- settlement vault sufficiently funded.

#### Flow
1. The Operator opens the Coupon Action.
2. The system displays the record date and snapshot holders.
3. Coupon entitlement is calculated for each holder.
4. The system displays `total_due`.
5. The Operator approves the action.
6. The program transfers mock payment tokens to each holder or creates an on-chain settlement instruction per holder.
7. Each holder's `paid/initiated` status and transaction reference are recorded.
8. After complete processing, action = `FINALIZED`.

#### Acceptance
- a holder with 10 bonds receives exactly 500 units using the example parameters;
- a holder who received tokens after the record date does not receive entitlement for those units;
- a holder who sold tokens after the snapshot retains entitlement for this action;
- the same entitlement cannot be settled twice;
- the sum of individual entitlements matches `total_due`.

## 13. Required Scenario B — Bond Redemption

### UC-BR-01: Bond redemption at maturity

- [x] Source implementation mapped for **UC-BR-01**; current execution/live acceptance is a separate evidence gate.

#### Flow
1. Maturity date reached.
2. The redemption snapshot is created/finalized.
3. Principal due is calculated for each holder.
4. A final coupon is added if required.
5. The Operator approves settlement.
6. The holder receives payment tokens / a settlement record.
7. The corresponding bond tokens are burned/retired/locked.
8. `redeemed_supply` increases.
9. When `redeemed_supply == eligible outstanding supply`, the instrument receives `MATURED/REDEEMED` status.
10. ActionReceipt records the final outcome.

#### Acceptance
- 10 bonds × 1,000 = 10,000 principal;
- the final coupon is accounted for separately and visible in the UI;
- the same token unit cannot be redeemed twice;
- redeemed units can no longer circulate as active bonds;
- total redeemed principal matches the snapshot obligation.

### Redemption rules for UC-BR-01

Maturity and execution readiness use Solana Clock. Beginning a maturity snapshot establishes an instrument-level redemption restriction that persists after snapshot finalization and through partial processing; clearing the ordinary snapshot flag must not reopen transfers. Block transfers, new issuance and conflicting actions until full redemption completes.

For MVP use **holder-signed atomic redemption**: after Operator approval and full funding, the holder authorizes thaw → burn of exactly that holder's snapshot units → principal/final-coupon payment → rights/supply update in one Solana transaction; re-freeze any remaining balance. The holder signature is required because the existing mint has no Permanent Delegate. An operator alone cannot burn holder-owned accounts with the current authorities. Zero-unit rights can be completed without a burn/payment, with once-only processing. A failed CPI rolls back payment, burn and counters. A future operator-mediated burn requires a separately specified authority/mint migration, not an assumed delegate.

Final coupon is explicit (`include_final_coupon`, coupon period identifier), separately calculated and included at most once. A period already paid by a Coupon action cannot be paid again during redemption. The principal is due only for unredeemed units; finalization reconciles burned/retired units with snapshot supply, remaining mint supply and outstanding/redeemed counters.

## 14. Required Scenario C — Bondholder Voting

Selected additional corporate action: **Bondholder Voting**.

Why this action:
- uses the same record-date/holder snapshot;
- shows that the engine serves more than payments;
- demonstrates generic lifecycle infrastructure;
- adds innovation without requiring an external payment rail.

### UC-VOTE-01: Bondholder voting

- [x] Source implementation mapped for **UC-VOTE-01**; current execution/live acceptance is a separate evidence gate.

#### Example proposal

> “Approve modification of maturity date / coupon terms.”

#### Flow
1. The Operator creates a Proposal.
2. The Operator sets the record date and voting window.
3. A holder snapshot is recorded.
4. `voting_power = snapshot_balance`.
5. The holder chooses `YES / NO / ABSTAIN`.
6. The program prevents voting twice with the same voting power.
7. After the deadline, totals and quorum are calculated.
8. The result is recorded on-chain and linked to the instrument/action.

#### Acceptance
- voting power does not change after a post-record token transfer;
- double voting is impossible;
- total used voting power does not exceed snapshot supply;
- the result and quorum are independently verifiable.

### Voting rules for UC-VOTE-01

Voting opens only after snapshot finalization and explicit Operator approval, with `opens_at <= Clock < closes_at`. Proposal parameters are immutable once approved: content hash, window, quorum bps and decision rule. A VoteReceipt is unique for `(proposal, holder)` and requires that holder's signature; Operator/demo view selection cannot vote for them.

Quorum uses snapshot supply: `(yes + no + abstain) * 10_000 >= snapshot_supply * quorum_bps`. A proposal passes only when quorum is met and `yes > no`; abstentions count toward quorum, zero decisive votes and ties fail. Reject zero-supply proposals and zero-power votes. Finalization is allowed at/after closing, only once, and records all totals and the rule. Voting records a decision; changing instrument terms requires a separate approved modification workflow and is outside MVP.

### UC-PR-01: Early / partial redemption (Post-MVP, P2)

- [x] Source implementation mapped for **UC-PR-01**; current execution/live acceptance is a separate evidence gate.

Preconditions: active instrument, no conflicting snapshot/redemption, explicit Operator proposal/approval, fixed fraction in bps and funded obligation. Flow: record holdings → calculate integer units to retire → preview allocations and remainder → approve → holders sign atomic retire/payment → reconcile supply → finalize receipt. Freeze affected positions until completion so units used to calculate principal cannot move away.

For whole bonds, `retire_units = floor(snapshot_units * redemption_bps / 10_000)` per holder. Show the resulting aggregate; do not promise an exact aggregate percentage when rounding produces a remainder. Zero allocations are processed without payment/burn. Test 100/300/600 units at 20% → 20/60/120 units retired; at face value 1,000, principal = 20,000/60,000/120,000, total 200,000, remaining supply 800. Reject duplicate/overlapping redemption of the same units. Partial completion leaves the instrument active with reduced supply; full early redemption marks it redeemed. Final coupon policy is separately explicit.

### UC-MD-01: Holder claims a committed distribution (Post-MVP, P1)

- [x] Source implementation mapped for **UC-MD-01**; current execution/live acceptance is a separate evidence gate.

Preconditions: historical holder data at a declared finalized record slot, eligibility inputs, reproducible entitlement manifest and sufficiently funded distributor. Operator reviews and approves the commitment; claimant obtains a proof, signs a claim to the bound destination, and the program verifies root/leaf/action and unclaimed status before atomic payment and claim marking. Auditor can independently reconstruct the manifest/root and reconcile paid/unclaimed totals. Duplicate, wrong-action, wrong-destination and altered-amount claims fail.

A Merkle proof establishes membership in an approved commitment; it does not prove historical ownership, eligibility or a correct formula. Root acceptance therefore requires a separately documented data-source/reconciliation trust model. A current RPC balance queried after the record date is not a historical snapshot. Redemption must additionally secure ownership/retirement of units; a payout proof alone cannot authorize burn.

### UC-EV-01: Normalize an external event (Post-MVP, P3)

- [x] Source implementation mapped for **UC-EV-01**; current execution/live acceptance is a separate evidence gate.

An adapter receives source evidence → normalizes a versioned action payload → validates instrument/type/dates/parameters → proposes once using a stable source event ID → Operator reviews provenance and approves → existing action flow executes → receipt links outcome and evidence hash. Retries map to the same action; conflicting revisions are rejected or explicitly superseded before approval. Source feeds/attesters cannot bypass execution authority. Source evidence authenticity and availability are stated separately from its content hash.

## 16. Functional Requirements (FR)

### Instrument

- [x] **FR-01** Create a tokenized bond instrument.
- [x] **FR-02** Store face value, currency, coupon rate, frequency, maturity, issuer and mint.
- [x] **FR-03** Issue a Token-2022 test supply.
- [x] **FR-04** Distribute tokens among test holders.
- [x] **FR-05** Display outstanding / redeemed supply.

### Registry & transfer control

- [x] **FR-06** Create a holder registry.
- [x] **FR-07** Approve/revoke test holder.
- [x] **FR-08** Prevent registry bypass during instrument transfers.
- [x] **FR-09** Display each registered holder's current balance.

### Record date

- [x] **FR-10** Create a corporate action with a record date.
- [x] **FR-11** Allow only an authorized role to initiate a snapshot.
- [x] **FR-12** Record each eligible holder's balance.
- [x] **FR-13** Finalize an immutable snapshot.
- [x] **FR-14** Store snapshot timestamp/slot/hash.
- [x] **FR-15** Do not use post-record transfers to recalculate an already finalized snapshot.

### Entitlements

- [x] **FR-16** Calculate coupon entitlement.
- [x] **FR-17** Calculate redemption principal.
- [x] **FR-18** Calculate the final coupon separately.
- [x] **FR-19** Calculate voting power.
- [x] **FR-20** Use fixed-point/integer math.
- [x] **FR-21** Store per-holder entitlement on-chain.
- [x] **FR-22** Store aggregate total obligation.

### Coupon

- [x] **FR-23** Preview coupon distribution.
- [x] **FR-24** Require explicit approval.
- [x] **FR-25** Execute/initiate settlement.
- [x] **FR-26** Prevent double payment.
- [x] **FR-27** Finalize the coupon action.

### Redemption

- [x] **FR-28** Initiate redemption at maturity.
- [x] **FR-29** Execute/initiate principal settlement.
- [x] **FR-30** Burn/retire/lock redeemed bond units.
- [x] **FR-31** Prevent double redemption.
- [x] **FR-32** Mark the instrument redeemed after full redemption.

### Voting

- [x] **FR-33** Create a proposal.
- [x] **FR-34** Set voting record date/window/quorum.
- [x] **FR-35** Vote YES/NO/ABSTAIN.
- [x] **FR-36** Prevent double voting.
- [x] **FR-37** Finalize the tally on-chain.

### Audit

- [x] **FR-38** Give each action a unique ID/PDA.
- [x] **FR-39** Log key state transitions.
- [x] **FR-40** Display transaction signatures.
- [x] **FR-41** Create a final ActionReceipt.
- [x] **FR-42** Provide the Auditor with a read-only verification view.

### Shared engine — MVP completion

- [x] **FR-43** Store an immutable action kind (`Coupon`, `Redemption`, `Voting`), schema version and action-specific parameters; dispatch calculation/execution by kind and reject cross-kind instructions.
- [x] **FR-44** Validate action-specific transitions on-chain: payments require approval/funding; Voting requires approval/window but no payment vault/funding stage. Cancellation is only available while Scheduled, before snapshot begins, for MVP.
- [x] **FR-45** Persist the maturity-redemption lock through snapshot completion and settlement; reject conflicting actions and release it only according to the redemption completion rule.
- [x] **FR-46** Require holder authorization for atomic burn/payment with the existing mint, reconcile supply counters, and enforce explicit final-coupon period deduplication across actions.
- [x] **FR-47** Store proposal rules/content hash and unique holder-signed VoteReceipts; calculate deadline, quorum and decision on-chain using the specified rule.
- [x] **FR-48** Bind final receipts to action kind/version/parameters/snapshot and action-specific outcomes (payment components, retired units or voting totals/result); independently verify these fields in the Auditor view.

### Scale, additional actions and integrations — Post-MVP

- [x] **FR-49** Build a replayable holder/eligibility index at a declared finalized slot; reconcile indexed units with mint/registry supply before proposing a distribution.
- [x] **FR-50** Produce a versioned manifest, deterministic leaf ordering/encoding, entitlement totals, root and data hash; retain retrievable data/proofs.
- [x] **FR-51** Support an explicitly approved/funded claim distributor with on-chain proof validation, per-leaf replay protection, destination binding and paid/unclaimed accounting (UC-MD-01).
- [x] **FR-52** Define claim deadline, dust/residual accounting and authorized reclaim only after deadline; never reclaim while claims remain valid or claim completion as full payout when obligations are unclaimed.
- [x] **FR-53** Separate instrument administration, registry approval, action approval and funding authorities; support configured multisig without treating frontend role selection as authorization.
- [x] **FR-54** Evaluate versioned transfer eligibility policies (approval expiry, freeze, group/jurisdiction), preserving the eligibility captured for prior finalized actions; keep private KYC data off-chain.
- [x] **FR-55** Bind instrument metadata/terms URI and hash/version to actions; apply term modifications through a distinct approved workflow without rewriting historical rights.
- [x] **FR-56** Execute early/partial redemption with specified integer allocation, explicit coupon policy, atomic retirement/payment and reconciled reduced supply (UC-PR-01).
- [x] **FR-57** Normalize and deduplicate external events with versioned payloads, source/evidence hashes and explicit proposal/approval boundaries (UC-EV-01).
- [x] **FR-58** Provide paginated/indexed audit history and export of input parameters, rights, outcomes and signatures; recover without browser storage and disclose unavailable historical evidence.

## 17. Non-Functional Requirements (NFR)

Unchecked partial requirements retain explicit limits:

| Requirement | Remaining acceptance boundary |
|---|---|
| NFR-05 | RPC trust, pruned history and historical destination verification limits remain disclosed |
| NFR-10 | A complete human Phantom three-action Devnet PASS must be retained |
| NFR-12 | The embedded-key scan is bounded; it is not a complete source/history secret review |

- [x] **NFR-01 Determinism:** identical snapshot inputs always produce identical entitlement outputs.
- [x] **NFR-02 Precision:** no floating-point monetary calculations.
- [x] **NFR-03 Idempotency:** repeated settle/redeem calls do not create repeated payments.
- [x] **NFR-04 Authorization:** privileged actions are restricted to the corresponding authority.
- [ ] **NFR-05 Auditability:** every finalized action is linked to on-chain state and transaction signatures.
- [x] **NFR-06 Immutability:** a finalized snapshot cannot be changed.
- [x] **NFR-07 Atomicity where possible:** irreversible token state changes and corresponding settlement state must be linked by one transaction or a strict state machine.
- [x] **NFR-08 Recoverability:** partial batch failures can be resumed safely without double settlement.
- [x] **NFR-09 UX clarity:** users see record date, formula, snapshot balance, entitlement, status and transaction proof.
- [ ] **NFR-10 Devnet reproducibility:** judges can reproduce the demo from README.
- [x] **NFR-11 Separation:** UI/backend are not the source of truth for finalized entitlement; critical state is stored/validated by the Solana program.
- [ ] **NFR-12 Security:** admin keys are not hardcoded in the frontend/repository.

### MVP extension

- [x] **NFR-13 Type safety:** enforce instruction/action-kind compatibility and action-specific transition tables on-chain; test cross-kind and cross-action account substitution.
- [x] **NFR-14 Compatibility:** account layout/version changes require an explicit migration or new-account strategy, regenerated IDL/client/auditor and Coupon regression acceptance. Existing Devnet receipts must remain readable through a supported historical decoder.
- [x] **NFR-15 Lifecycle isolation:** one instrument cannot concurrently execute actions that conflict over ownership, retirement or the same coupon period; immutable action parameters determine historical calculations.

### Post-MVP extension

- [x] **NFR-16 Snapshot provenance:** record commitment data source, finalized slot, eligibility/policy version and reconciliation checks; fail closed on gaps, inconsistent supply or unavailable historical state.
- [x] **NFR-17 Proof availability:** manifests/proofs must remain independently retrievable beyond browser/indexer restart; approval cannot depend on an operator-only copy. Storage retention and recovery targets must be specified before rollout.
- [x] **NFR-18 Measured scalability:** benchmark holder counts, transaction count, compute, account rent and proof size; define the supported envelope from measurements before claiming 100,000-holder support.
- [x] **NFR-19 Reuse provenance:** before incorporating third-party code, pin repository commit, exact files, license/notice obligations and dependency versions; port with independent fixtures and negative tests. Upstream README/test-count/audit claims do not constitute Recorda acceptance or a security review.

## 23. Test cases / acceptance matrix

### Coupon

- [x] TC-01 exact formula for 10 bonds = 500.
- [x] TC-02 zero balance = zero entitlement.
- [x] TC-03 post-record transfer does not alter entitlement.
- [x] TC-04 cannot settle same entitlement twice.
- [x] TC-05 aggregate total = sum(holder entitlements).

### Redemption

- [x] TC-06 10 bonds = 10,000 principal.
- [x] TC-07 final coupon can be included separately.
- [x] TC-08 token units are retired/burned after redemption.
- [x] TC-09 redeemed token cannot be redeemed again.
- [x] TC-10 instrument final state correct after full redemption.

### Voting

- [x] TC-11 voting power equals snapshot units.
- [x] TC-12 post-record transfer does not change voting power.
- [x] TC-13 no double vote.
- [x] TC-14 tally equals sum of valid VoteReceipts.

### Security/state
- [x] TC-15 unauthorized wallet cannot approve/settle.
- [x] TC-16 finalized snapshot cannot mutate.
- [x] TC-17 invalid state transition rejected.
- [x] TC-18 insufficient settlement funding blocks execution.
- [x] TC-19 partial batch can resume safely.

### MVP extension acceptance

- [x] **TC-20** Wrong-kind instruction and wrong-action/instrument entitlement/receipt are rejected (FR-43–44,48; NFR-13).
- [x] **TC-21** Post-finalization and mid-redemption transfers/issuance/conflicting actions remain blocked (FR-45; NFR-15).
- [x] **TC-22** Failure of either burn or payment rolls back both token balances and all supply/progress counters; retry succeeds once (FR-46; NFR-07–08).
- [x] **TC-23** Missing holder signature/wrong bond owner is rejected; zero-unit rights complete without burn/payment (FR-46).
- [x] **TC-24** No final coupon when disabled; enabled coupon displayed separately; previously paid period cannot be paid twice (FR-18,46).
- [x] **TC-25** Vote before opening/at closing, unauthorized signer and zero voting power are rejected (FR-47).
- [x] **TC-26** Quorum exactly at threshold, below threshold, abstentions, ties and repeated tally yield the specified outcome (FR-47).
- [x] **TC-27** Voting completes without a settlement vault; Voting cannot settle Coupon/Redemption funds (FR-43–44).
- [x] **TC-28** Old Coupon golden/audit receipts stay readable after versioned account/client changes; new action-specific forged receipts fail verification (FR-48; NFR-14).
- [x] **TC-29** Snapshot capture/calculation/settlement resume from chain after reload; cancellation after snapshot begins is rejected; incomplete capture cannot finalize (FR-44; NFR-08).

### Post-MVP acceptance

- [x] **TC-30** Index replay/restart at the same finalized slot reproduces registry/supply/eligibility and root; missing historical data blocks approval (FR-49–50; NFR-16).
- [x] **TC-31** Altered amount/holder/destination, wrong root/action/mint and duplicate Merkle claims fail without payment (FR-51).
- [x] **TC-32** Proof retrieval survives browser/indexer loss; reconstructed manifest totals/root match on-chain commitment (FR-50; NFR-17).
- [x] **TC-33** Reclaim before expiry/wrong authority fails; expiry, zero claims, partial claims and dust reconcile to funded/paid/reclaimed/residual amounts (FR-52).
- [x] **TC-34** Partial-redemption fixture and small-holder rounding preserve integer units/supply; overlap and duplicate retirement fail (FR-56).
- [x] **TC-35** Expired/revoked/frozen transfer eligibility blocks new transfers without rewriting prior rights; each separated authority is tested (FR-53–54).
- [x] **TC-36** Duplicate/reordered source delivery proposes once; altered payload/evidence and unauthorized attester cannot bypass approval (FR-57).
- [x] **TC-37** Historical terms survive modification; paginated export reconciles receipts/signatures and exposes unavailable history (FR-55,58).
- [x] **TC-38** Publish scale measurements and pinned code/license inventory for any adopted implementation (NFR-18–19).

## 24. Definition of Done — Hackathon MVP

The MVP is complete only if the live demo can show the following in sequence:

Checked foundation/Coupon items were demonstrated by the human-signed Devnet golden on 2026-10-06 (action `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx`). Redemption/Voting and Post-MVP FR-49–58 are now implemented in source and exercised by local suites; full human-signed three-action Devnet acceptance remains open. Local implementation checklists are in ROADMAP; this live-demo DoD is not closed by local tests.

- [x] A Token-2022 test bond exists on-chain.
- [x] There are 3+ registered holders.
- [x] Balances are allocated.
- [x] A Coupon corporate action is created.
- [x] A record-date snapshot is actually recorded.
- [x] Entitlements are actually calculated.
- [x] Coupon settlement actually executes through Solana or settlement initiation is clearly demonstrated.
- [x] The transaction/receipt can be verified.
- [ ] Redemption calculates principal.
- [ ] Redemption actually burns/retires/locks the corresponding units.
- [ ] A second redemption is impossible.
- [ ] Bondholder Voting works as the third action.
- [ ] Voting power is based on the record-date snapshot.
- [ ] Each scenario has a final on-chain record.
- [ ] The UI clearly distinguishes IMPLEMENTED and SIMULATED.
- [x] README enables judges to reproduce the demo.
- [ ] The demo video shows complete E2E beyond the interface.
