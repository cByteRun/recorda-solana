# Recorda — KASE Corporate Actions Engine on Solana

![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF)
![Rights](https://img.shields.io/badge/License-All%20rights%20reserved-red)

**Recorda** is a Solana-native corporate-actions lifecycle engine for tokenized securities, built for the **Superteam Kazakhstan × KASE Corporate Actions on Blockchain** side track.

> **Tokenization tells us who owns the asset. Recorda determines what that ownership entitled the holder to on the record date, controls execution of the corporate action, and leaves a verifiable proof of what happened next.**

## Source of truth

Repository precedence is intentionally explicit:

1. [`docs/TZ.md`](docs/TZ.md) — **authoritative product and technical requirements**.
2. [`docs/PRODUCT.md`](docs/PRODUCT.md) — plain-language interpretation of the business problem and product value.
3. [`ROADMAP.md`](ROADMAP.md) — delivery phases, milestones, UC/FR/NFR coverage and Definition of Done.
4. [`docs/plan.md`](docs/plan.md) — current implementation plan and trust-boundary migration.
5. [`golden/`](golden/) — deterministic E2E input/output oracles.
6. [`prototype/`](prototype/) — reference implementations and evidence, not the final source of protocol truth.

If documents conflict, **`docs/TZ.md` wins**.

---

## The problem in plain language

Issuing a tokenized bond is only **day zero**.

A bond continues to live after issuance. Someone still has to determine:

- who held it on a legally/economically meaningful **record date**;
- how many units each eligible holder had at that moment;
- what coupon, principal, voting power or other right those units created;
- who approved the action;
- what was actually paid / redeemed / voted;
- whether the same entitlement can be executed twice;
- how an investor or auditor can prove the complete result later.

A Token-2022 balance can tell us that an investor owns `6 KZB26` **now**. It does not by itself tell us that the same investor held `10 KZB26` on a past record date and therefore earned a `$500` coupon.

That missing link is the product.

### Useful analogy

Recorda is similar to a **payroll engine for tokenized securities**:

```text
Employee state       → payroll cutoff → salary entitlement → approval → payment → payslip
Token holder state   → record date    → investor right      → approval → settlement → ActionReceipt
```

---

## Product axis

Everything in the project should reinforce one chain:

```text
TOKENIZED INSTRUMENT
        ↓
RECORD DATE
        ↓
IMMUTABLE SNAPSHOT
        ↓
ELIGIBLE HOLDER
        ↓
DETERMINISTIC ENTITLEMENT
        ↓
HUMAN / AUTHORITY APPROVAL
        ↓
SETTLEMENT / REDEMPTION / VOTE
        ↓
VERIFIABLE ON-CHAIN RESULT
```

Or, shorter:

> **Record Date → Right → Controlled Execution → Verifiable Proof**

This is the decision filter for architecture, UX and scope.

---

## Who is this for?

Primary users are **financial-market infrastructure participants**, not retail users first:

- KASE / market or corporate-actions operator;
- issuer / paying agent;
- central-depository / servicing infrastructure;
- custodian / broker integration layer;
- auditor / observer.

The holder / investor is the beneficiary and must be able to understand **why** a right exists and verify the outcome.

---

## Why the product can exist

Traditional market infrastructure already services coupons, redemptions and other corporate actions. The KASE challenge asks a different question:

> **If ownership of the financial instrument itself moves on-chain, what is the blockchain-native servicing layer that keeps its lifecycle operational?**

The value is not “blockchain because blockchain”. The value comes from a reusable lifecycle engine that can reduce duplicated state and reconciliation between ownership, calculations, execution status and audit evidence while making the rules reproducible.

We do **not** claim the existing KASE/KCSD infrastructure is broken. We are prototyping the lifecycle infrastructure required for **tokenized financial instruments**.

---

## Our edge

We are **not** building:

- an exchange;
- an order book;
- a generic RWA marketplace;
- a DeFi protocol;
- “a bond token for the sake of minting a token”.

Commodity / reusable primitives can cover issuance, token accounts, transfers, ACLs or distribution mechanics.

**Recorda owns the domain semantics:**

- record-date truth;
- immutable holder snapshots;
- corporate-action state machine;
- fixed-point financial entitlement logic;
- explicit execution authority / HITL;
- redemption lifecycle and token retirement;
- record-date voting power;
- per-holder corporate-action history;
- final ActionReceipt / auditability.

---

## Current milestone: M0 reference prototype ✅

The current Devnet prototype proves the core coupon story with **real Solana state**:

- real Token-2022 `KZB26` mint;
- real holder keypairs and Token-2022 accounts;
- initial on-chain balances `A=10 / B=20 / C=5`;
- real post-record transfer `A → B: 4 KZB26` producing `6 / 24 / 5`;
- immutable record-date attestation preserving `10 / 20 / 5`;
- deterministic entitlements `$500 / $1,000 / $250`;
- real Phantom operator approval;
- real Token-2022 `KUSD-DEV` settlement `500 / 1000 / 250`;
- final receipt transaction;
- black-box E2E verifier comparing known input → actual chain state → expected output.

The reference HTML is stored at:

[`prototype/kase-real-devnet-v4-kusd.html`](prototype/kase-real-devnet-v4-kusd.html)

### What is still a bridge

The prototype proves the business flow, but the critical middle layer is not yet enforced by our own program:

```text
Token-2022 state                 REAL ON-CHAIN
        ↓
Browser record-date orchestration / entitlement math
        ↓
Solana Memo attestations        REAL TX, NOT DOMAIN ENFORCEMENT
```

The next milestone moves this truth into Anchor:

```text
React / client
        ↓
Recorda Anchor Program
        ├── Instrument PDA
        ├── HolderPosition PDA
        ├── CorporateAction PDA
        ├── SnapshotPosition PDA
        ├── EntitlementPosition PDA
        └── ActionReceipt PDA
        ↓
Token-2022 / KUSD settlement CPI
```

---

## Golden coupon scenario

The first protocol implementation must reproduce the exact known fixture in [`golden/coupon-happy-path.json`](golden/coupon-happy-path.json):

```text
Initial ownership       10 / 20 / 5 KZB26
Record-date snapshot    10 / 20 / 5
Post-record transfer    A → B : 4
Current ownership        6 / 24 / 5
Coupon entitlement      500 / 1000 / 250 KUSD
Total entitlement        1750 KUSD
Final state              FINALIZED
```

The most important invariant is:

> **Post-record-date transfers must never change an already finalized entitlement.**

---

## Required hackathon scenarios

The final MVP must demonstrate all three through the same lifecycle engine:

1. **Coupon Payment** — holder snapshot → entitlement → approval → settlement → proof.
2. **Bond Redemption** — snapshot → principal/final coupon → settlement → burn/retire → proof.
3. **Bondholder Voting** — snapshot → voting power → vote → no double vote → final tally.

See [`ROADMAP.md`](ROADMAP.md) for milestone-level UC/FR/NFR coverage and DoD.

---

## Repository layout

```text
recorda-solana/
├── README.md
├── ROADMAP.md
├── LICENSE
├── docs/
│   ├── TZ.md
│   ├── PRODUCT.md
│   └── plan.md
├── golden/
│   └── coupon-happy-path.json
└── prototype/
    └── kase-real-devnet-v4-kusd.html
```

The React/Vite app is implemented in `src/`. The Anchor workspace is still planned. See [ARCHITECTURE.md](ARCHITECTURE.md) for the current structure and trust boundary.

---

## Run React and verify

Requires Node 22.12+ and npm.

```bash
npm install
npm run build
npx playwright install chromium
npm run test:e2e:golden
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:4444. Phantom signing is manual; automated tests do not send transactions. The golden oracle is a deterministic domain simulation, **not proof of real-chain settlement**. Follow [manual Devnet acceptance](tests/MANUAL_DEVNET_ACCEPTANCE.md) for chain validation.

[PR audit and requirement coverage](docs/PHASE_1_AUDIT.md) · [Architecture](ARCHITECTURE.md).

---

## Current implementation direction

The React port is available on `feat/phase-1-react`; it retains the Browser/Memo bridge. Current focus: reliable React checks, then Anchor Coupon Core (M1.1–M1.6).

The next engineering objective is:

> **Move Corporate Action Truth On-Chain.**

The existing HTML is frozen as a behavioral reference and golden oracle. The Anchor implementation must reproduce the same outputs while making the validator/program — not browser JavaScript — responsible for finalized snapshot, entitlement, authorization, idempotency and receipt state.

See [`docs/plan.md`](docs/plan.md).

---

## Challenge success metric

The primary product metric from the source-of-truth TZ is:

> **100% correctly and reproducibly processed corporate-action entitlements for all holders in the test scenario, with a verifiable on-chain outcome.**

Target demo KPIs:

- entitlement mismatch: **0**;
- double settlement: **0**;
- unauthorized execution: **0**;
- required corporate actions demonstrated E2E: **3/3**;
- finalized actions with verifiable proof: **100%**.

---

## License

All rights reserved. See [LICENSE](LICENSE). Third-party dependencies retain their own licenses.

