# Requirements — normative TZ annex

This file is part of [TZ](TZ.md), with the same authority. Original section numbers and UC/FR/NFR/TC IDs are retained. Delivery status belongs in [ROADMAP](ROADMAP.md); evidence is maintained in [ROADMAP](ROADMAP.md#verification-and-gaps).

Phase 1 Devnet reproduction for **UC-CP-01 / NFR-10** is described in [README](../README.md#phase-1-golden-on-devnet--real-phantom). Airdrop supplies test SOL for fees/rent; it is a setup aid, not coupon funding or a new business requirement. Human Devnet golden evidence supplements the local acceptance matrix; it does not replace TC-04/15–19 negative tests or extend delivery to redemption/voting. The connected human demo wallet is R1 Operator; R3 demo holder identities remain disposable.

## 6. Users and roles

### Protocol role views — planned acceptance

`/protocol` must allow Operator / Investor / Auditor view selection without changing the current Action PDA. Operator includes Paying Agent for MVP and sees lifecycle controls, all holders, total obligation and vault. Investor sees the connected holder's current units, record-date units, entitlement, destination, payment status and proof. Auditor can open the action without a wallet and sees all rights, totals, hashes, receipt and transaction links with no mutation controls.

For judge demos, Investor may explicitly select A/B/C/D in **read-only demo mode**; this selection is not wallet authentication and cannot sign as the selected holder. Role selection never grants authority: wallet identity and on-chain authorization govern mutations. Disconnected or unknown investors see a connect/no-position state, never another holder presented as their own.

Role golden/E2E acceptance uses the same action and `golden/coupon-tz-section-22.json`: A current/snapshot/payout = 6/10/500, B = 9/5/250, C = 2/2/100, D = 0/0/0; Operator/Auditor total = 850. Tests must cover switching without losing the action, field/control visibility, unauthorized wallets and wallet-free audit. These role views are planned, not implemented acceptance; Redemption/Voting expectations follow their own fixtures when delivered.

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

## 24. Definition of Done — Hackathon MVP

The MVP is complete only if the live demo can show the following in sequence:

Checked foundation/Coupon items were demonstrated by the human-signed Devnet golden on 2026-10-06 (action `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx`). Redemption, Voting and full three-action acceptance remain open.

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
