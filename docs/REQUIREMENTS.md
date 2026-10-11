# Requirements — normative TZ annex

This file is part of [TZ](TZ.md), with the same authority. Original section numbers and UC/FR/NFR/TC IDs are retained; new IDs are appended. Delivery status belongs in [ROADMAP](ROADMAP.md); evidence is maintained in [ROADMAP](ROADMAP.md#verification-and-gaps).

Current human Devnet MVP reproduction for Coupon, Voting and Redemption is described in [the demo guide](DEVNET-DEMO.md) and [README](../README.md#devnet-demo--coupon--voting--redemption), using a real Operator and A/B/C Phantom accounts. `test:e2e:actions:devnet` supplies happy-path evidence; `test:audit` retains feature and attack coverage, including TC-04/15–19 negative scenarios and Post-MVP. Airdrop supplies test SOL for fees/rent, not coupon funding. Historical v1 evidence does not establish current v2 acceptance.

## Scope of the reference-driven extension

Reviewed 2026-10-06 against the local Coupon program/client/tests and the linked upstream repository documentation. [Reference assessment](ARCHITECTURE.md#reference-assessment-and-adaptation) distinguishes documented patterns from tested Recorda behavior. New requirements below are design obligations, not delivered features; roadmap checkboxes/evidence remain authoritative for delivery.

MVP remains **Coupon + Full Redemption + Bondholder Voting**. FR-43–48 and NFR-13–15 refine the remaining MVP implementation. UC-PR-01, UC-MD-01, UC-EV-01, FR-49–58, NFR-16–19 and TC-30–38 are explicitly Post-MVP. They do not expand the hackathon DoD. Existing Coupon implementation and its golden dataset remain the baseline to preserve.

## 6. Users and roles

### Protocol role views — acceptance

`/protocol` must allow Operator / Investor / Auditor view selection without changing the current Action PDA. Operator includes Paying Agent for MVP and sees lifecycle controls, all holders, total obligation and vault. Investor sees the connected holder's current units, record-date units, entitlement, destination, payment status and proof. Auditor can open the action without a wallet and sees all rights, totals, hashes, receipt and transaction links with no mutation controls.

When the browser retains matching demo identities, Investor may explicitly select A/B/C/D in **read-only demo mode**; this selection is not wallet authentication and cannot sign as the selected holder. Role selection never grants authority: wallet identity and on-chain authorization govern mutations. Disconnected or unknown investors see a connect/no-position state, never another holder presented as their own.

Role golden/E2E acceptance uses the same action and `golden/coupon-tz-section-22.json`: A current/snapshot/payout = 6/10/500, B = 9/5/250, C = 2/2/100, D = 0/0/0; Operator/Auditor total = 850. Tests must cover switching without losing the action, field/control visibility, unauthorized wallets and wallet-free audit. Coupon role views and this golden acceptance are implemented and locally verified in ROADMAP M1.7; Redemption/Voting expectations follow their own fixtures when delivered.

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

Preconditions: active instrument, no conflicting snapshot/redemption, explicit Operator proposal/approval, fixed fraction in bps and funded obligation. Flow: record holdings → calculate integer units to retire → preview allocations and remainder → approve → holders sign atomic retire/payment → reconcile supply → finalize receipt. Freeze affected positions until completion so units used to calculate principal cannot move away.

For whole bonds, `retire_units = floor(snapshot_units * redemption_bps / 10_000)` per holder. Show the resulting aggregate; do not promise an exact aggregate percentage when rounding produces a remainder. Zero allocations are processed without payment/burn. Test 100/300/600 units at 20% → 20/60/120 units retired; at face value 1,000, principal = 20,000/60,000/120,000, total 200,000, remaining supply 800. Reject duplicate/overlapping redemption of the same units. Partial completion leaves the instrument active with reduced supply; full early redemption marks it redeemed. Final coupon policy is separately explicit.

### UC-MD-01: Holder claims a committed distribution (Post-MVP, P1)

Preconditions: historical holder data at a declared finalized record slot, eligibility inputs, reproducible entitlement manifest and sufficiently funded distributor. Operator reviews and approves the commitment; claimant obtains a proof, signs a claim to the bound destination, and the program verifies root/leaf/action and unclaimed status before atomic payment and claim marking. Auditor can independently reconstruct the manifest/root and reconcile paid/unclaimed totals. Duplicate, wrong-action, wrong-destination and altered-amount claims fail.

A Merkle proof establishes membership in an approved commitment; it does not prove historical ownership, eligibility or a correct formula. Root acceptance therefore requires a separately documented data-source/reconciliation trust model. A current RPC balance queried after the record date is not a historical snapshot. Redemption must additionally secure ownership/retirement of units; a payout proof alone cannot authorize burn.

### UC-EV-01: Normalize an external event (Post-MVP, P3)

An adapter receives source evidence → normalizes a versioned action payload → validates instrument/type/dates/parameters → proposes once using a stable source event ID → Operator reviews provenance and approves → existing action flow executes → receipt links outcome and evidence hash. Retries map to the same action; conflicting revisions are rejected or explicitly superseded before approval. Source feeds/attesters cannot bypass execution authority. Source evidence authenticity and availability are stated separately from its content hash.

## 16. Functional Requirements (FR)

### Instrument
- **FR-01** Create a tokenized bond instrument.
- **FR-02** Store face value, currency, coupon rate, frequency, maturity, issuer and mint.
- **FR-03** Issue a Token-2022 test supply.
- **FR-04** Distribute tokens among test holders.
- **FR-05** Display outstanding / redeemed supply.

### Registry & transfer control
- **FR-06** Create a holder registry.
- **FR-07** Approve/revoke test holder.
- **FR-08** Prevent registry bypass during instrument transfers.
- **FR-09** Display each registered holder's current balance.

### Record date
- **FR-10** Create a corporate action with a record date.
- **FR-11** Allow only an authorized role to initiate a snapshot.
- **FR-12** Record each eligible holder's balance.
- **FR-13** Finalize an immutable snapshot.
- **FR-14** Store snapshot timestamp/slot/hash.
- **FR-15** Do not use post-record transfers to recalculate an already finalized snapshot.

### Entitlements
- **FR-16** Calculate coupon entitlement.
- **FR-17** Calculate redemption principal.
- **FR-18** Calculate the final coupon separately.
- **FR-19** Calculate voting power.
- **FR-20** Use fixed-point/integer math.
- **FR-21** Store per-holder entitlement on-chain.
- **FR-22** Store aggregate total obligation.

### Coupon
- **FR-23** Preview coupon distribution.
- **FR-24** Require explicit approval.
- **FR-25** Execute/initiate settlement.
- **FR-26** Prevent double payment.
- **FR-27** Finalize the coupon action.

### Redemption
- **FR-28** Initiate redemption at maturity.
- **FR-29** Execute/initiate principal settlement.
- **FR-30** Burn/retire/lock redeemed bond units.
- **FR-31** Prevent double redemption.
- **FR-32** Mark the instrument redeemed after full redemption.

### Voting
- **FR-33** Create a proposal.
- **FR-34** Set voting record date/window/quorum.
- **FR-35** Vote YES/NO/ABSTAIN.
- **FR-36** Prevent double voting.
- **FR-37** Finalize the tally on-chain.

### Audit
- **FR-38** Give each action a unique ID/PDA.
- **FR-39** Log key state transitions.
- **FR-40** Display transaction signatures.
- **FR-41** Create a final ActionReceipt.
- **FR-42** Provide the Auditor with a read-only verification view.

### Shared engine — MVP completion

- **FR-43** Store an immutable action kind (`Coupon`, `Redemption`, `Voting`), schema version and action-specific parameters; dispatch calculation/execution by kind and reject cross-kind instructions.
- **FR-44** Validate action-specific transitions on-chain: payments require approval/funding; Voting requires approval/window but no payment vault/funding stage. Cancellation is only available while Scheduled, before snapshot begins, for MVP.
- **FR-45** Persist the maturity-redemption lock through snapshot completion and settlement; reject conflicting actions and release it only according to the redemption completion rule.
- **FR-46** Require holder authorization for atomic burn/payment with the existing mint, reconcile supply counters, and enforce explicit final-coupon period deduplication across actions.
- **FR-47** Store proposal rules/content hash and unique holder-signed VoteReceipts; calculate deadline, quorum and decision on-chain using the specified rule.
- **FR-48** Bind final receipts to action kind/version/parameters/snapshot and action-specific outcomes (payment components, retired units or voting totals/result); independently verify these fields in the Auditor view.

### Scale, additional actions and integrations — Post-MVP

- **FR-49** Build a replayable holder/eligibility index at a declared finalized slot; reconcile indexed units with mint/registry supply before proposing a distribution.
- **FR-50** Produce a versioned manifest, deterministic leaf ordering/encoding, entitlement totals, root and data hash; retain retrievable data/proofs.
- **FR-51** Support an explicitly approved/funded claim distributor with on-chain proof validation, per-leaf replay protection, destination binding and paid/unclaimed accounting (UC-MD-01).
- **FR-52** Define claim deadline, dust/residual accounting and authorized reclaim only after deadline; never reclaim while claims remain valid or claim completion as full payout when obligations are unclaimed.
- **FR-53** Separate instrument administration, registry approval, action approval and funding authorities; support configured multisig without treating frontend role selection as authorization.
- **FR-54** Evaluate versioned transfer eligibility policies (approval expiry, freeze, group/jurisdiction), preserving the eligibility captured for prior finalized actions; keep private KYC data off-chain.
- **FR-55** Bind instrument metadata/terms URI and hash/version to actions; apply term modifications through a distinct approved workflow without rewriting historical rights.
- **FR-56** Execute early/partial redemption with specified integer allocation, explicit coupon policy, atomic retirement/payment and reconciled reduced supply (UC-PR-01).
- **FR-57** Normalize and deduplicate external events with versioned payloads, source/evidence hashes and explicit proposal/approval boundaries (UC-EV-01).
- **FR-58** Provide paginated/indexed audit history and export of input parameters, rights, outcomes and signatures; recover without browser storage and disclose unavailable historical evidence.

## 17. Non-Functional Requirements (NFR)

- **NFR-01 Determinism:** identical snapshot inputs always produce identical entitlement outputs.
- **NFR-02 Precision:** no floating-point monetary calculations.
- **NFR-03 Idempotency:** repeated settle/redeem calls do not create repeated payments.
- **NFR-04 Authorization:** privileged actions are restricted to the corresponding authority.
- **NFR-05 Auditability:** every finalized action is linked to on-chain state and transaction signatures.
- **NFR-06 Immutability:** a finalized snapshot cannot be changed.
- **NFR-07 Atomicity where possible:** irreversible token state changes and corresponding settlement state must be linked by one transaction or a strict state machine.
- **NFR-08 Recoverability:** partial batch failures can be resumed safely without double settlement.
- **NFR-09 UX clarity:** users see record date, formula, snapshot balance, entitlement, status and transaction proof.
- **NFR-10 Devnet reproducibility:** judges can reproduce the demo from README.
- **NFR-11 Separation:** UI/backend are not the source of truth for finalized entitlement; critical state is stored/validated by the Solana program.
- **NFR-12 Security:** admin keys are not hardcoded in the frontend/repository.

### MVP extension

- **NFR-13 Type safety:** enforce instruction/action-kind compatibility and action-specific transition tables on-chain; test cross-kind and cross-action account substitution.
- **NFR-14 Compatibility:** account layout/version changes require an explicit migration or new-account strategy, regenerated IDL/client/auditor and Coupon regression acceptance. Existing Devnet receipts must remain readable through a supported historical decoder.
- **NFR-15 Lifecycle isolation:** one instrument cannot concurrently execute actions that conflict over ownership, retirement or the same coupon period; immutable action parameters determine historical calculations.

### Post-MVP extension

- **NFR-16 Snapshot provenance:** record commitment data source, finalized slot, eligibility/policy version and reconciliation checks; fail closed on gaps, inconsistent supply or unavailable historical state.
- **NFR-17 Proof availability:** manifests/proofs must remain independently retrievable beyond browser/indexer restart; approval cannot depend on an operator-only copy. Storage retention and recovery targets must be specified before rollout.
- **NFR-18 Measured scalability:** benchmark holder counts, transaction count, compute, account rent and proof size; define the supported envelope from measurements before claiming 100,000-holder support.
- **NFR-19 Reuse provenance:** before incorporating third-party code, pin repository commit, exact files, license/notice obligations and dependency versions; port with independent fixtures and negative tests. Upstream README/test-count/audit claims do not constitute Recorda acceptance or a security review.

## 23. Test cases / acceptance matrix

### Coupon
- TC-01 exact formula for 10 bonds = 500.
- TC-02 zero balance = zero entitlement.
- TC-03 post-record transfer does not alter entitlement.
- TC-04 cannot settle same entitlement twice.
- TC-05 aggregate total = sum(holder entitlements).

### Redemption
- TC-06 10 bonds = 10,000 principal.
- TC-07 final coupon can be included separately.
- TC-08 token units are retired/burned after redemption.
- TC-09 redeemed token cannot be redeemed again.
- TC-10 instrument final state correct after full redemption.

### Voting
- TC-11 voting power equals snapshot units.
- TC-12 post-record transfer does not change voting power.
- TC-13 no double vote.
- TC-14 tally equals sum of valid VoteReceipts.

### Security/state
- TC-15 unauthorized wallet cannot approve/settle.
- TC-16 finalized snapshot cannot mutate.
- TC-17 invalid state transition rejected.
- TC-18 insufficient settlement funding blocks execution.
- TC-19 partial batch can resume safely.

### MVP extension acceptance

- **TC-20** Wrong-kind instruction and wrong-action/instrument entitlement/receipt are rejected (FR-43–44,48; NFR-13).
- **TC-21** Post-finalization and mid-redemption transfers/issuance/conflicting actions remain blocked (FR-45; NFR-15).
- **TC-22** Failure of either burn or payment rolls back both token balances and all supply/progress counters; retry succeeds once (FR-46; NFR-07–08).
- **TC-23** Missing holder signature/wrong bond owner is rejected; zero-unit rights complete without burn/payment (FR-46).
- **TC-24** No final coupon when disabled; enabled coupon displayed separately; previously paid period cannot be paid twice (FR-18,46).
- **TC-25** Vote before opening/at closing, unauthorized signer and zero voting power are rejected (FR-47).
- **TC-26** Quorum exactly at threshold, below threshold, abstentions, ties and repeated tally yield the specified outcome (FR-47).
- **TC-27** Voting completes without a settlement vault; Voting cannot settle Coupon/Redemption funds (FR-43–44).
- **TC-28** Old Coupon golden/audit receipts stay readable after versioned account/client changes; new action-specific forged receipts fail verification (FR-48; NFR-14).
- **TC-29** Snapshot capture/calculation/settlement resume from chain after reload; cancellation after snapshot begins is rejected; incomplete capture cannot finalize (FR-44; NFR-08).

### Post-MVP acceptance

- **TC-30** Index replay/restart at the same finalized slot reproduces registry/supply/eligibility and root; missing historical data blocks approval (FR-49–50; NFR-16).
- **TC-31** Altered amount/holder/destination, wrong root/action/mint and duplicate Merkle claims fail without payment (FR-51).
- **TC-32** Proof retrieval survives browser/indexer loss; reconstructed manifest totals/root match on-chain commitment (FR-50; NFR-17).
- **TC-33** Reclaim before expiry/wrong authority fails; expiry, zero claims, partial claims and dust reconcile to funded/paid/reclaimed/residual amounts (FR-52).
- **TC-34** Partial-redemption fixture and small-holder rounding preserve integer units/supply; overlap and duplicate retirement fail (FR-56).
- **TC-35** Expired/revoked/frozen transfer eligibility blocks new transfers without rewriting prior rights; each separated authority is tested (FR-53–54).
- **TC-36** Duplicate/reordered source delivery proposes once; altered payload/evidence and unauthorized attester cannot bypass approval (FR-57).
- **TC-37** Historical terms survive modification; paginated export reconciles receipts/signatures and exposes unavailable history (FR-55,58).
- **TC-38** Publish scale measurements and pinned code/license inventory for any adopted implementation (NFR-18–19).

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
