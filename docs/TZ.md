# Technical Specification (TZ)
## KASE Corporate Actions Engine — lifecycle infrastructure for tokenized securities on Solana

**Status:** Hackathon MVP / KASE Side Track  
**Source of truth:** this specification and its normative [REQUIREMENTS annex](REQUIREMENTS.md) → architecture → implementation. UC/FR/NFR/TC and DoD are defined once in the annex; its requirements retain the authority of this TZ.
**MVP network:** Solana Devnet / Local Validator.  
**Principle:** corporate-action correctness first, then UX and infrastructure.

---

# 1. Challenge context

KASE and Superteam Kazakhstan require a working prototype that automates corporate actions for tokenized financial instruments on Solana.

Required chain:

> **Identify eligible holders → Calculate entitlements → Execute/initiate action → Record outcome on-chain**

Required scenarios:
1. Coupon Payment.
2. Bond Redemption.
3. At least one additional corporate action.

At minimum, the prototype must include:
- a test tokenized financial instrument;
- holder registry;
- record-date mechanism;
- entitlement calculation;
- coupon payment;
- bond redemption;
- an additional corporate action;
- a verifiable on-chain outcome record.

External/fiat payment rails may be simulated, but entitlement logic and the Solana corporate-action flow must actually work.

---

# 2. Core business problem

## 2.1 High-level problem

**Tokenizing a financial instrument does not by itself solve post-issuance servicing.**

After issuance, a bond continues its lifecycle: record dates, coupons, redemption, early events, voting, changes of terms and the need to prove who was entitled to what and what ultimately happened.

If these processes remain fragmented or manual, blockchain becomes only a new asset-accounting format, while the lifecycle still requires separate reconciliation of registries, calculations, payment instructions and audit records.

### The problem in one sentence

> **A shared deterministic mechanism is needed to link a tokenized instrument's state at the record date to a specific holder's right and a provable corporate-action outcome.**

---

# 3. Core product goal

Build a **Corporate Actions Engine** for tokenized securities that turns a corporate event into a reproducible end-to-end process on Solana:

> **Instrument → Record Date Snapshot → Eligible Holders → Entitlements → Approval → Settlement/Execution → Redemption/State Change → On-chain Receipt**

The product must prove that a tokenized bond's lifecycle can be serviced programmatically, transparently and verifiably beyond issuance and transfer.

---

# 4. Value and expected impact

## 4.1 For KASE / market infrastructure
- one standard workflow for corporate actions on tokenized instruments;
- less manual reconciliation between holder state, calculations and actual execution;
- an immutable audit trail of key stages;
- independent verification of calculations and outcomes;
- a reusable engine for different issuers and event types;
- a foundation for scaling tokenized securities beyond issuance.

## 4.2 For the issuer
- automatic calculation of each holder's obligation;
- reduced risk of incorrect entitlement;
- transparent event status: Draft → Snapshotted → Approved → Funded → Settled → Finalized;
- one source of corporate-action outcome data.

## 4.3 For the investor
- a clear explanation of eligibility or ineligibility;
- visible record-date snapshot balance;
- visible entitlement formula and amount;
- verifiable transaction signature / on-chain receipt;
- verifiable voting power and result for voting actions.

## 4.4 Economic impact

The MVP makes no unproven savings-percentage claims. The prototype must demonstrate mechanisms that generate economic value:

1. **fewer operational steps** between registry capture and execution;
2. **less reconciliation** between independent tables/systems;
3. **less human-error risk** in calculations and allocations;
4. **faster verification and audit**, because input parameters, snapshot, entitlement and outcome are linked on-chain;
5. **scalability:** new corporate actions build on the shared registry/snapshot/entitlement/audit layer.

---

# 5. Product thesis

**We are not building an exchange, a DeFi protocol or a bond merely to issue a token.**

We are building a **lifecycle servicing layer** for tokenized securities.

The prototype's key value is the provable chain rather than the SPL token itself:

> **who owned → on what date → what right arose → by which formula → what executed → what happened to the instrument → where is the proof.**

---

# 6. Users and roles

See [Users and roles](REQUIREMENTS.md#6-users-and-roles). This normative section is maintained in the TZ annex.

---

# 7. Main E2E scenario

1. The Operator creates a test bond.
2. The system creates a Token-2022 mint and on-chain `Instrument` state.
3. Tokens are distributed among 3–5 test holders.
4. The Operator creates a corporate action and sets its record date.
5. At snapshot time, the system records eligible holders and their balances.
6. Once finalized, the snapshot becomes immutable for that action.
7. The program calculates each holder's entitlement using a deterministic formula.
8. The UI previews holders, balances, amounts and total obligation.
9. The Operator explicitly approves execution.
10. Settlement uses an on-chain mock payment token or creates a verifiable settlement instruction.
11. For redemption, the corresponding bond-token units are burned/retired/locked.
12. The program creates/updates the on-chain `ActionReceipt`.
13. The Investor/Auditor can open the action and independently verify the outcome.

---

# 8. Test bond model

Use the challenge parameters for the baseline demo:

| Field | MVP value |
|---|---:|
| Face value | 1,000 |
| Currency | Mock USD / Mock KZT |
| Annual coupon | 10% |
| Frequency | Semi-annual |
| Coupon periods/year | 2 |
| Maturity | configurable |
| Bond token | Token-2022 |
| Bond unit | 1 token = 1 bond |

### Coupon formula

```text
coupon_per_holder =
  snapshot_balance
  × face_value
  × annual_coupon_bps / 10_000
  ÷ payments_per_year
```

Example:

```text
10 bonds × $1,000 × 10% ÷ 2 = $500
```

### Redemption formula

```text
principal_due = snapshot_balance × face_value
```

With a final coupon:

```text
final_settlement = principal_due + final_coupon_due
```

All financial calculations must use integer/fixed-point arithmetic. Floating-point arithmetic is prohibited.

---

# 9. Record Date — critical mechanism

## 9.1 Requirement

Entitlement must be determined by **the balance at the fixed record date**, rather than the current balance at payment time.

## 9.2 MVP mechanism

Use a controlled snapshot flow:

1. `Action` contains `record_timestamp` in advance.
2. When the record date arrives, the Operator calls `begin_snapshot`.
3. Instrument transfers are temporarily blocked (`Paused/SnapshotPending`).
4. The system records holder balances in `SnapshotPosition / Entitlement` accounts.
5. The sum of snapshot balances is checked against eligible outstanding supply.
6. The snapshot hash/root is calculated and stored.
7. The Operator calls `finalize_snapshot`.
8. The snapshot becomes immutable.
9. For coupon actions, transfers may be enabled again.
10. For maturity redemption, the instrument remains restricted until redemption is complete.

This makes the demo deterministic and prevents a post-record token transfer from changing payment entitlement.

## 9.3 Production evolution

In production, a short transfer pause may be replaced by slot-based snapshots/indexing with a cryptographic commitment/Merkle root and external registry/depository integration.

For the hackathon, this is Post-MVP and must not complicate the required working flow.

---

# 10. Holder Registry

The system must maintain an unambiguous registry of participants permitted to hold the instrument.

For MVP:
- holder = Solana public key;
- each holder has a corresponding Token-2022 token account;
- a protocol-level `HolderPosition`/registry account is created;
- the holder must be approved for that instrument;
- arbitrary wallets outside the registry must not be included;
- transfer control must prevent registry bypass.

Recommended implementation:
- Token-2022;
- Allowlist/Default Frozen State for the permissioned-security flow;
- Transfer Hook or equivalent protocol-level validation for the controlled transfer lifecycle;
- Permanent Delegate only for strictly defined admin/redemption operations.

The MVP simulates a KYC/AML provider with `approved=true`; real KYC is outside the hackathon MVP.

---

# 11. Corporate Action State Machine

```text
DRAFT
  ↓
SCHEDULED
  ↓
SNAPSHOT_PENDING
  ↓
SNAPSHOTTED
  ↓
CALCULATED
  ↓
AWAITING_APPROVAL
  ↓
APPROVED
  ↓
FUNDED / READY
  ↓
EXECUTING
  ↓
SETTLED
  ↓
FINALIZED
```

Error branches:

```text
FAILED
CANCELLED (only before irreversible execution)
INSUFFICIENT_FUNDS
PARTIALLY_SETTLED
```

Every transition must have:
- authority check;
- timestamp/slot;
- transaction signature;
- event log;
- protection against invalid state transitions.

---

# 12. Required Scenario A — Coupon Payment

See [UC-CP-01: Coupon payment — preconditions, flow and acceptance](REQUIREMENTS.md#12-required-scenario-a--coupon-payment). This normative section is maintained in the TZ annex.

---

# 13. Required Scenario B — Bond Redemption

See [UC-BR-01: Bond redemption — flow and acceptance](REQUIREMENTS.md#13-required-scenario-b--bond-redemption). This normative section is maintained in the TZ annex.

---

# 14. Required Scenario C — Bondholder Voting

See [UC-VOTE-01: Bondholder voting — rationale, flow and acceptance](REQUIREMENTS.md#14-required-scenario-c--bondholder-voting). This normative section is maintained in the TZ annex.

---

# 15. Human-in-the-Loop / execution control

No monetary or irreversible corporate action may execute automatically merely because a date has arrived.

The MVP must require explicit Operator approval before:
- settlement;
- burn/retirement;
- closing an action early;
- changing instrument status.

Automation calculates and prepares the action; the authority approves execution.

---

# 16. Functional Requirements (FR)

See [FR-01–58: Functional requirements (MVP and explicitly scoped Post-MVP)](REQUIREMENTS.md#16-functional-requirements-fr). This normative section is maintained in the TZ annex.

---

# 17. Non-Functional Requirements (NFR)

See [NFR-01–19: Non-functional requirements (MVP and explicitly scoped Post-MVP)](REQUIREMENTS.md#17-non-functional-requirements-nfr). This normative section is maintained in the TZ annex.

---

# 18. On-chain data model

Minimum PDAs/accounts:

## `Instrument`
```text
instrument_id
issuer_authority
mint
face_value_minor
currency_code
coupon_bps
payments_per_year
maturity_timestamp
outstanding_supply
redeemed_supply
status
```

## `HolderPosition`
```text
instrument
holder_wallet
token_account
approved
```

## `CorporateAction`
```text
action_id
instrument
action_type
record_timestamp
record_slot
status
snapshot_hash
total_eligible_units
total_obligation_minor
created_by
approved_by
```

## `Entitlement`
```text
action
holder
snapshot_units
amount_minor
settlement_status
settlement_tx/reference
redeemed_units
```

## `Proposal` / `VoteReceipt`
```text
proposal
holder
snapshot_voting_power
choice
cast_at
```

## `ActionReceipt`
```text
action
final_status
settled_total_minor
processed_holders
finalized_at
summary_hash
```

---

# 19. Solana architecture

## Core
- **Anchor program (Rust)** — corporate-action state machine, entitlement validation, redemption/voting logic.
- **Token-2022** — tokenized bond.
- **Token-2022 extensions** as appropriate:
  - Transfer Hook / access controls;
  - Default frozen / permissioned holder flow;
  - Permanent Delegate for controlled retirement/burn where required;
  - Pausable control where practical.
- **Mock settlement token** — SPL/Token-2022 token representing test fiat/stable settlement asset.

## Client
- **Next.js + TypeScript**.
- Solana wallet adapter.
- Operator Console.
- Investor/Auditor views.

## Optional off-chain helper
Allowed only for orchestration/indexing:
- enumerate known holder accounts;
- batch submit snapshot/settlement transactions;
- cache UI data;
- generate technical report.

It must **not** be the final source of truth for finalized entitlement/outcome.

---

# 20. Settlement model

## MVP preferred path — fully demonstrable
Use mock settlement token:

```text
Issuer Treasury → Action Vault → Eligible Holder
```

Advantages:
- judge sees actual balance movement;
- settlement is independently verifiable;
- no fake bank integration required;
- satisfies “execute payment on-chain”.

## Alternative / fallback
Fiat settlement can be simulated as:

```text
Entitlement → PaymentInstructionCreated → external_reference_hash → Settled
```

UI must clearly mark it **SIMULATED / INITIATED**, never “paid on-chain”.

---

# 21. UX requirements

## Screen 1 — Instruments
- instrument status;
- token supply;
- coupon/maturity;
- next action;
- holders count.

## Screen 2 — Holder Registry
- holder wallet;
- approved status;
- current units;
- test transfer controls.

## Screen 3 — Corporate Actions
Timeline/cards:
- Coupon #1;
- Redemption;
- Voting proposal.

Each card shows:
- action type;
- record date;
- state;
- eligible holders;
- total obligation;
- on-chain proof.

## Screen 4 — Action Detail
The most important screen.

Must visually show:

```text
Record Date
↓
Snapshot
↓
Holder × Units
↓
Formula
↓
Entitlement
↓
Approval
↓
Settlement / Burn / Vote
↓
On-chain Receipt
```

## Screen 5 — Investor
- “You held X units on record date”;
- “Your entitlement = Y”;
- formula;
- state;
- transaction link.

## Screen 6 — Audit
- inputs;
- snapshot hash;
- calculated totals;
- processed totals;
- mismatches = 0;
- tx signatures;
- final receipt.

---

# 22. Demo dataset

At least 4 wallets:

| Holder | Record-date units | Coupon due |
|---|---:|---:|
| A | 10 | 500 |
| B | 5 | 250 |
| C | 2 | 100 |
| D | 0 | 0 |

After the snapshot:
- A transfers 4 bonds to B.

Expected result:
- The Coupon action still uses snapshot A=10, B=5.
- New current balances do not change the already recorded entitlement.

This is a required demo edge case because it visibly demonstrates the purpose of record date.

---

# 23. Test cases / acceptance matrix

See [TC-01–19: Test cases / acceptance matrix](REQUIREMENTS.md#23-test-cases--acceptance-matrix). This normative section is maintained in the TZ annex.

---

# 24. Definition of Done — Hackathon MVP

See [Hackathon MVP Definition of Done](REQUIREMENTS.md#24-definition-of-done--hackathon-mvp). This normative section is maintained in the TZ annex.

---

# 25. Outside MVP scope

Do not spend hackathon time on:
- a full matching/trading engine;
- order book;
- production-grade CSD replacement;
- real bank-rail integration;
- production KYC/AML vendor;
- legal recognition of the token as a real security;
- mainnet deployment;
- a complex RWA marketplace;
- secondary trading UI;
- multi-chain;
- a general-purpose DAO/governance framework;
- AI/LLM;
- a large microservice architecture.

These are outside the challenge's core.

---

# 26. Development priorities

## P0 — required
1. Instrument + Token-2022.
2. Holder registry.
3. Record-date snapshot.
4. Entitlement engine.
5. Coupon settlement.
6. Redemption + token retirement.
7. On-chain receipts.
8. Bondholder voting.
9. Operator UI + audit view.

## P1 — after P0 is stable
- batch processing;
- richer transfer controls;
- Merkle snapshot commitment;
- downloadable action report;
- role separation issuer/operator/auditor;
- event timeline.

## P2 — post-MVP
- partial/early redemption;
- dividends;
- tender offer/buyback;
- modification workflow;
- real KYC/AML;
- external fiat rails;
- depository integrations;
- production-grade compliance/custody.

---

# 27. Mapping to judging criteria

## Technical Execution — 30%
Demonstrate real Solana transactions, a state machine, Token-2022, snapshots, settlement, burn/retirement and tests rather than a mockup.

## Corporate Action Logic — 25%
This is the core product layer:
- record date;
- immutable snapshot;
- eligibility;
- deterministic entitlement;
- no double settlement;
- correct redemption.

## Product & UX — 20%
The UI must explain complex financial mechanics through a simple visual pipeline and provide auditability.

## Real-World Applicability — 15%
Emphasize:
- permissioned holders;
- explicit operator approval;
- separation of on-chain entitlement and external settlement;
- audit trail;
- ability to integrate with CSD/KASE/issuer systems later.

## Innovation — 10%
Do not pitch “blockchain because blockchain”.

Innovation:
> **a universal programmable lifecycle engine**, where one record-date/snapshot/entitlement layer serves payments, redemption and governance events.

---

# 28. Primary MVP success metric

Neither TVL, wallet count nor UI speed.

### Primary Product Metric

> **100% correctly and reproducibly processed corporate-action entitlements for all holders in the test scenario, with verifiable on-chain outcomes.**

### Demo KPIs
- entitlement mismatch: **0**;
- double settlement: **0**;
- unauthorized execution: **0**;
- corporate actions demonstrated E2E: **3/3**;
- each finalized action has verifiable on-chain proof: **100%**.

---

# 29. Critical demo narrative

Do not open the presentation with “we issued a token on Solana”.

Start with the problem:

> “Issuing a tokenized bond is not enough. Six months later, someone must determine exactly who held it on the record date, how much coupon each investor is owed, execute the payment, redeem principal at maturity and prove the outcome. We built that lifecycle layer.”

Then show the live flow:

```text
Bond issued
→ 3 holders
→ record date
→ snapshot
→ entitlement = 500 / 250 / 100
→ holder transfers bonds after snapshot
→ entitlement does NOT change
→ approve
→ on-chain coupon settlement
→ maturity redemption
→ burn/retire
→ voting from the same snapshot engine
→ audit receipt
```

This directly demonstrates the track's business purpose.

---

# 30. Architectural decision principle

When deciding what to add, use this order:

1. Does it improve correctness of **Record Date → Entitlement → Execution → Proof**?
2. Is it required by Required Scenarios / Minimum Prototype Requirements?
3. Does it improve Technical Execution / Corporate Action Logic / Product UX / Real-World Applicability?
4. Can it be shown in a live demo?

If the answer is no, the feature is outside MVP scope.

---

# 31. Sources and specification basis

Reference repository assessment, verified scope and adaptation decisions are maintained in [ARCHITECTURE](ARCHITECTURE.md#reference-assessment-and-adaptation). Original MVP IDs remain stable; appended requirements and their MVP/Post-MVP boundary are defined in [REQUIREMENTS](REQUIREMENTS.md#scope-of-the-reference-driven-extension) and scheduled in [ROADMAP](ROADMAP.md#reference-driven-delivery-order).

1. Superteam Kazakhstan x KASE Side Track — Corporate Actions on Blockchain  
   https://superteam.fun/earn/listing/superteam-kazakhstan-x-kase-side-track-corporate-actions-on-blockchain

2. KASE — Corporate Events  
   https://kase.kz/ru/information/corporate-events

3. Solana — Asset Issuance & Tokenization  
   https://solana.com/docs/tokenization

4. Solana — Token Extensions  
   https://solana.com/docs/tokens/extensions

5. Solana — Permanent Delegate  
   https://solana.com/docs/tokens/extensions/permanent-delegate

6. Solana — Default Account State  
   https://solana.com/docs/tokens/extensions/default-state

7. Solana — Permissioned Tokens / Token ACL  
   https://solana.com/docs/tokenization/token-acl

---

# 32. Final product definition

**KASE Corporate Actions Engine** is a prototype infrastructure layer on Solana for servicing tokenized financial instruments throughout their lifecycle: it records eligible holders at the record date, deterministically calculates rights, executes or initiates the corporate action and leaves a verifiable on-chain outcome.

**Primary business value:** make a tokenized security an **operationally serviceable financial instrument throughout its lifecycle**, beyond an asset that can merely be issued and transferred.
