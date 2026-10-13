# Technical Specification (TZ)
## KASE Corporate Actions Engine

**Product supplement:** [Recorda BondOps](PRODUCT.md) frames the same lifecycle around issuer/paying-agent operations: control obligations, execution confirmations and exceptions. Its proposed settlement workspace and long-term Infrastructure API/SDK direction add product intent; they do not replace the KASE scenarios or establish implementation status.

**Authority:** the KASE track brief supplied by the team → this TZ and its [REQUIREMENTS annex](REQUIREMENTS.md) → architecture → implementation. The brief takes precedence for track obligations. Recorda's additional business scope is explicitly separated below and cannot replace required scenarios.

This document defines the product boundary and key business rules. Detailed UC/FR/NFR/TC remain in REQUIREMENTS; technical contracts belong in [ARCHITECTURE](ARCHITECTURE.md); implementation and acceptance status belong in [ROADMAP](ROADMAP.md). Section numbers are retained for existing references.

# 1. Challenge context

KASE and Superteam Kazakhstan require a working prototype for corporate actions on tokenized financial instruments. Core on-chain components must run on Solana.

> **Identify eligible holders → Calculate entitlements → Execute or initiate the action → Record the outcome on-chain.**

Every submission must demonstrate Coupon Payment, Bond Redemption and one additional corporate action. Recorda selects **Bondholder Voting** as the third scenario.

Minimum prototype: test tokenized instrument, holder registry, record-date mechanism, entitlement calculation, coupon payment, redemption, additional action and a verifiable on-chain outcome. External/fiat rails may be simulated; entitlement logic and the Solana action flow must function.

All participating teams must also be officially registered for the main hackathon. [Track coverage](REQUIREMENTS.md#kase-track-source-and-coverage) maps the supplied brief to existing requirements.

# 3. Core product goal

Service tokenized bonds through a shared, verifiable lifecycle:

> **Instrument → Holder → Record-date Right → Authorized Action → Receipt.**

The business domains are instrument/registry, record-date rights, Coupon, Redemption, holder decisions and audit. Recorda adds controlled execution and the explicitly scoped extensions in §26. KASE's other asset classes and the alternative additional actions listed in the brief are not cumulative MVP obligations.

# 6. Users and roles

Recorda defines Operator, Issuer/Paying Agent, Investor and read-only Auditor. Operator and Paying Agent may be combined for MVP. UI role selection does not grant execution authority. Detailed journeys: [roles](REQUIREMENTS.md#6-users-and-roles).

# 7. Main E2E scenario

Create the test instrument and register/distribute holder positions → schedule an action → preserve holdings at its cutoff → finalize a complete snapshot → calculate rights → preview/approve → execute → verify the on-chain outcome.

On one instrument, demonstrate **Coupon → Voting → Full Redemption**. Each action has its own record date, snapshot and receipt; shared machinery does not imply shared historical allocations. Full redemption ends the active supply needed for subsequent voting.

# 8. Test bond model

The brief's example is a bond with face value **$1,000**, annual coupon **10%**, **semi-annual** payments and **2-year** maturity. These illustrate the required calculations rather than prescribe every instrument's terms. Recorda uses whole bonds and mock currency; accelerated demo maturity must be disclosed.

```text
coupon_due = snapshot_units × face_value × annual_coupon_bps / 10_000 / payments_per_year
principal_due = snapshot_units × face_value
redemption_due = principal_due + final_coupon_due (if due)
```

For 10 bonds: coupon = **500**, principal = **10,000**, plus any final coupon due. Recorda uses checked integer/minor-unit arithmetic, rounds down once per holder and sums the individual allocations (FR-16–22). Financial terms used by an action are fixed for its rights.

# 9. Record Date — critical mechanism

Eligibility and rights derive from holdings at the specified record date, not balances at execution time.

Recorda's controlled mechanism schedules an on-chain cutoff barrier: at `Clock >= record_timestamp`, balance-changing operations are blocked even if snapshot capture starts late. Registry/eligibility changes cannot rewrite the cutoff population. Capture reconciles all eligible holdings with supply and finalizes an immutable snapshot with timestamp/slot/hash.

Coupon and Voting may release transfer restrictions after capture; their rights remain unchanged. Redemption retains restrictions through retirement/settlement. Incomplete snapshots cannot finalize. Detailed obligations: FR-10–15,43–46 and TC-16,21,29.

## 9.3 Production evolution

Historical indexing and committed distributions are a separately scoped extension (§26). A current RPC balance or Merkle proof alone does not prove historical ownership.

# 10. Holder Registry

Maintain unambiguous holder identities and instrument balances. Recorda uses registered Solana wallets and controlled Token-2022 custody; transfers cannot bypass the registry. Eligibility is simulated for MVP; real KYC/AML integration is outside MVP. Detailed obligations: FR-06–09.

# 11. Corporate Action State Machine

```text
Coupon / Redemption:
Schedule → Snapshot → Calculate → Approve → Fund → Execute → Finalize receipt

Voting:
Schedule → Snapshot → Calculate → Approve → Vote → Tally → Finalize receipt
```

These are business stages, not literal account enums. Voting requires no funding/vault. Recorda permits cancellation only while Scheduled, before snapshot begins. Failed transactions roll back; partial execution remains visible and resumable and cannot count as full completion (FR-43–44).

# 12. Required Scenario A — Coupon Payment

Identify bondholders at the specified record date, calculate each coupon entitlement, then execute payment on-chain or initiate a clearly demonstrated settlement flow. Recorda's selected path pays mock tokens on Solana.

Post-record transfers cannot change coupon rights; individual amounts reconcile to the total and cannot be paid twice. Detailed flow and acceptance: [UC-CP-01](REQUIREMENTS.md#12-required-scenario-a--coupon-payment).

# 13. Required Scenario B — Bond Redemption

At maturity identify holders, calculate principal and any final coupon due, execute/initiate settlement and burn, retire, lock or otherwise mark the corresponding units redeemed.

Recorda selects holder-signed atomic **burn + payment + supply/rights update** without Permanent Delegate. Maturity uses Solana Clock. Final coupon is shown separately and the same coupon period cannot be paid twice. Full completion requires reconciled retirement and supply; redeemed units cannot circulate or be redeemed again. Detailed flow and acceptance: [UC-BR-01](REQUIREMENTS.md#13-required-scenario-b--bond-redemption).

# 14. Required Scenario C — Bondholder Voting

Recorda selects the brief's Bondholder Voting option: record-date units determine voting power; holders sign unique YES/NO/ABSTAIN votes within the approved window; the program records the final tally and outcome.

Abstentions count toward quorum; passing requires quorum and YES > NO. Voting has no payment stage and does not itself modify instrument terms. Detailed rules and acceptance: [UC-VOTE-01](REQUIREMENTS.md#14-required-scenario-c--bondholder-voting).

# 15. Human-in-the-Loop / execution control

Recorda requires explicit Operator approval before execution and holder authorization where required for voting/retirement. Dates trigger readiness, not execution authority. This is a project control choice, not a separate mandate of the track (FR-24,43–47).

# 18. On-chain data model

Solana state must bind instrument terms and supply, registered positions, action kind/parameters/cutoff, immutable per-holder rights, aggregate obligations, execution progress and final outcomes. Payment, retirement and voting outcomes must be independently verifiable and linked to their action.

Account layouts and commitments: [ARCHITECTURE](ARCHITECTURE.md#accounts-and-lifecycle). Normative details: FR-21–22,38–48.

# 19. Solana architecture

The track requires functional Solana core components. Recorda selects Anchor/Rust, Token-2022 and a wallet-connected client with Operator/Investor/Auditor views; Devnet/local validator are its prototype environments. These choices are not extra track obligations.

Off-chain orchestration and indexing may assist execution; finalized rights/outcomes are enforced and recorded on-chain. Runtime, custody, client and trust boundaries: [ARCHITECTURE](ARCHITECTURE.md).

# 20. Settlement model

Selected MVP path: **Treasury → Action Vault → Holder**, using a plain two-decimal mock Token-2022 payment mint. Movement is real on-chain; the currency has no real fiat value.

The track also permits clearly demonstrated external settlement initiation. An on-chain instruction/reference establishes **INITIATED**, not proof of external payment. Label simulations and do not present them as confirmed payment. Fiat settlement is not a claim of current Recorda implementation.

# 21. UX requirements

Show instrument/holder state, action cutoff, snapshot units, formula, entitlement or voting power, authorization, processing status and verifiable outcome. Investors see their rights; auditors can verify without a wallet. Distinguish implemented functionality, test money, simulated integrations and incomplete execution. Detailed journeys: [REQUIREMENTS](REQUIREMENTS.md#6-users-and-roles); screens: [README](../README.md#product-screens-and-manual-acceptance).

# 22. Demo dataset

Recorda's existing Coupon fixture is A/B/C/D = **10/5/2/0** bonds → **500/250/100/0**, total **850**. A post-snapshot transfer of 4 bonds from A to B changes current balances to 6/9 but keeps Coupon rights at 10/5. Later actions use their own cutoff holdings.

This is project acceptance coverage (TC-01–05), not a prescribed track dataset. The separate three-action Devnet fixture has no post-record transfer; its actual walkthrough/evidence is in [DEVNET-DEMO](DEVNET-DEMO.md).

# 24. Definition of Done — Hackathon MVP

Demonstrate all three functional scenarios and their verifiable Solana outcomes, including correct record-date rights, coupon settlement, maturity principal/final coupon and corresponding token retirement. Clearly separate implemented functionality from simulated integrations.

Submit a **working prototype, demo video, source repository and short technical overview** covering architecture, record-date logic, entitlement calculations, settlement flow and Solana components. Confirm main-hackathon registration.

Detailed gates: [live DoD](REQUIREMENTS.md#24-definition-of-done--hackathon-mvp) and [submission gates](REQUIREMENTS.md#submission-gates). Source coverage or historical tests alone do not close current acceptance.

# 26. Development priorities

**MVP:** instrument/registry → record-date rights → Coupon + Voting + Full Redemption → audit/role journeys → current acceptance and submission artifacts.

**Existing Recorda additions, separately scoped Post-MVP:**

| Business extension | Existing coverage |
|---|---|
| Historical holder index, committed distributions and holder claims | UC-MD-01; FR-49–52 |
| Separated approval roles, eligibility policies and versioned terms modification | FR-53–55 |
| Early/partial redemption | UC-PR-01; FR-56 |
| External corporate-event proposals and provenance | UC-EV-01; FR-57 |
| Recoverable history and verified audit export | FR-58 |

Their detailed rules remain in REQUIREMENTS; delivery status remains in ROADMAP. These extensions cannot expand the track's minimum DoD or replace required scenarios. Dividends/tender offers and other unscoped actions require new requirements. Real fiat/KYC/depository integration, production custody, exchange trading and legal/mainnet rollout remain outside MVP.

# 27. Mapping to judging criteria

| Track criterion | Weight | Demonstration focus |
|---|---:|---|
| Technical Execution | 30% | Functional Solana implementation and completeness |
| Corporate Action Logic | 25% | Holders, cutoff, calculations, settlement and retirement |
| Product & UX | 20% | Clear, usable action and verification journeys |
| Real-World Applicability | 15% | Credible market-infrastructure flow and integration boundaries |
| Innovation | 10% | Shared automation and lifecycle management |

# 31. Sources and specification basis

The **full track brief supplied by the team** is the external baseline for this TZ. Its provenance is the [Superteam Kazakhstan x KASE listing](https://superteam.fun/earn/listing/superteam-kazakhstan-x-kase-side-track-corporate-actions-on-blockchain); this edit does not claim fresh verification of that page.

[REQUIREMENTS](REQUIREMENTS.md) preserves existing UC/FR/NFR/TC IDs and distinguishes track coverage from Recorda additions. Technical references and adaptation decisions belong in [ARCHITECTURE](ARCHITECTURE.md#reference-assessment-and-adaptation). Additional scope must identify its business purpose and requirements without weakening the supplied brief.
