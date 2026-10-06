# Product context — Recorda / KASE Corporate Actions Engine

> This document explains the product in plain language. **`docs/TZ.md` remains the source of truth.**

## 1. The subject area in one example

A company issues a two-year bond:

- face value: `$1,000`;
- annual coupon: `10%`;
- coupon frequency: twice per year.

Investor A owns 10 bonds on the coupon record date.

```text
10 × $1,000 × 10% ÷ 2 = $500
```

The difficult part is not minting a token that represents the bond. The difficult part is servicing that bond correctly for its entire lifecycle.

After issuance, the system must repeatedly answer:

1. **Who** was eligible?
2. **When** was eligibility measured?
3. **What right** did that ownership create?
4. **How much** was due and by which formula?
5. **Who approved** execution?
6. **What was actually executed?**
7. **What happened to the instrument?**
8. **Can an investor/auditor prove the result later?**

That is the corporate-actions domain.

## 2. Why record date exists

Ownership can change every day.

```text
Record date:
A = 10 bonds
B = 20 bonds
C = 5 bonds

After A sells 4 to B:
A = 6
B = 24
C = 5
```

The coupon for the completed record date must still use `10 / 20 / 5`.

Therefore:

```text
current balance ≠ entitlement balance
```

This is the simplest demonstration of why a plain token balance is not enough to operate a financial instrument.

## 3. What exists today vs what the challenge asks

Traditional securities infrastructure already has registries, settlement processes and corporate actions. The KASE challenge is not “replace a broken spreadsheet”.

The challenge asks:

> If a financial instrument becomes tokenized and its ownership lives on Solana, how do we make its post-issuance lifecycle operational on that same programmable infrastructure?

Issuance is only day zero.

A tokenized bond still needs:

- record dates;
- coupon payments;
- redemption;
- voting;
- changes of terms / buybacks / other actions;
- a reliable audit trail.

## 4. Who needs Recorda

### Primary B2B users

- exchange / corporate-actions operator;
- issuer / paying agent;
- depository or servicing infrastructure;
- custodian / broker integration layer;
- auditor.

### Beneficiary

The holder / investor needs a clear explanation:

```text
I held 10 units on the record date
× face value 1,000
× annual coupon 10%
÷ 2 payments per year
= 500 KUSD entitlement
```

and should be able to verify the status and transaction proof.

## 5. The business problem

Tokenization alone solves representation and transfer of ownership. It does not automatically create the operational servicing layer that converts historical ownership into enforceable rights.

Without that layer, a tokenized security still requires separate logic for:

- historical holder state;
- eligibility;
- entitlement calculation;
- approval;
- settlement coordination;
- redemption state changes;
- voting rights;
- audit / proof.

> **A tokenized financial instrument needs a deterministic lifecycle mechanism that binds ownership at a record date to a specific holder right and to a provable execution outcome.**

## 6. The solution

Recorda is a **lifecycle servicing layer for tokenized securities**.

```text
Instrument
→ Record Date
→ Immutable Snapshot
→ Eligible Holders
→ Entitlements
→ Explicit Approval
→ Settlement / Redemption / Voting
→ Instrument State Change
→ ActionReceipt
```

The system creates an auditable causal chain:

> **who owned → on what date → what right arose → by which formula → who approved → what executed → what changed → where is the proof**

## 7. Payroll analogy

```text
PAYROLL
employee state
→ cutoff
→ eligible employees
→ salary calculation
→ approval
→ payment
→ payslip / audit

RECORDA
holder state
→ record date
→ eligible holders
→ entitlement calculation
→ approval
→ settlement
→ ActionReceipt / audit
```

## 8. Economic / operational value

The MVP does not claim an unproven percentage of savings.

It demonstrates mechanisms from which value can arise:

- less reconciliation between independent ownership/calculation/execution datasets;
- deterministic financial calculations;
- fewer manual opportunities for entitlement error;
- explicit execution authority;
- faster audit because snapshot, formula, execution and result are linked;
- reusable infrastructure for multiple instruments and action types;
- programmable integration point for future KASE/CSD/issuer/payment systems.

## 9. What is commodity and what is our edge

### Reusable infrastructure

- Token-2022 mint/accounts/transfers;
- Token ACL / holder permissioning patterns;
- Merkle snapshot/distributor patterns for future scale;
- Squads / multisig patterns for production authorization;
- governance patterns for voting.

### Recorda-owned domain layer

- record-date semantics;
- snapshot immutability;
- corporate-action state machine;
- fixed-point coupon/principal calculations;
- per-holder entitlement state;
- no double settlement / redemption;
- redemption lifecycle and token retirement;
- snapshot-based voting power;
- holder corporate-action history;
- ActionReceipt and verification UX.

This is why Recorda is not “one more RWA minting app”.

## 10. What the current prototype proved

```text
Real Token-2022 bond
A/B/C = 10/20/5
        ↓
Record-date snapshot = 10/20/5
        ↓
Real A → B transfer of 4 bonds
        ↓
Current = 6/24/5
        ↓
Entitlement still calculated from snapshot
A = 500
B = 1000
C = 250
        ↓
Operator approval
        ↓
Real KUSD-DEV settlement
500/1000/250
        ↓
Receipt
        ↓
Black-box E2E PASS
```

This proves the product hypothesis.

It does **not** yet prove protocol enforcement because the browser still performs the corporate-action calculation/state orchestration and writes signed Memo attestations.

## 11. The next product boundary

> **Move Corporate Action Truth On-Chain.**

```text
Browser/React
   ↓ request
Recorda Anchor Program
   ├── validates state
   ├── stores record-date snapshot
   ├── calculates entitlement
   ├── enforces authorization
   ├── prevents double execution
   ├── performs Token-2022 CPI settlement/redemption
   └── finalizes ActionReceipt
```

The browser becomes presentation + transaction initiation rather than the source of financial truth.

## 12. Scope filter

Before adding a feature ask:

> **Does this improve Record Date → Right → Controlled Execution → Verifiable Proof or directly satisfy a required KASE scenario?**

If not, it is probably not MVP.

