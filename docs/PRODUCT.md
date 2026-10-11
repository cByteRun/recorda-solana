# Recorda BondOps — product direction

This document supplements [TZ](TZ.md) and [REQUIREMENTS](REQUIREMENTS.md). It defines the product value and proposed evolution; it does not amend normative IDs, claim delivered features or close acceptance gates. [ROADMAP](ROADMAP.md) owns delivery status.

## Central value

**A working system for servicing tokenized bonds:** issuers, paying agents and operations specialists control coupon payments, redemptions, errors and confirmations from one workspace.

The recurring job is to identify a financial obligation, reconcile its execution against fixed rights, investigate exceptions and perform an authorized corrective action with evidence. Record-date rights explain who is owed; settlement evidence explains whether the obligation was fulfilled. This recurring operational work is a hypothesis for which a financial organization may pay, to be validated with real users.

Investor signing and Auditor verification support the operator's workflow. Issuance and the holder registry establish the instrument being serviced; Coupon and Redemption are the core servicing tasks. Voting remains the required third KASE scenario.

## Proposed demonstration: missing coupon payment

**Illustrative future feature, not real Recorda data or the current Devnet fixture.** Dollar amounts below describe an example obligation, not actual fiat settlement.

| Investor | Coupon entitlement | Confirmed execution | Unsettled |
|---|---:|---:|---:|
| A | $500 | $0 | $500 |
| B | $1,000 | $1,000 | $0 |
| C | $250 | $250 | $0 |
| Total | $1,750 | $1,250 | $500 |

The proposed action view reads **CORPORATE ACTION / CA-001 · Coupon Settlement · 1 exception** with **Expected $1,750 · Confirmed $1,250 · Unsettled $500**. Its exception row is **Investor A — payment missing**, **Amount due $500**, **Action required: Review settlement**. The right exists, but matching execution confirmation is absent. Missing confirmation alone does not prove a payment never occurred.

Operator flow:

1. Open the exception from the servicing workspace.
2. Inspect the holder's fixed right, cutoff, calculation, amount due, approval/funding state and available execution evidence.
3. Reconcile against the authoritative settlement source. Distinguish an unsubmitted payment, pending/unknown confirmation, a failed transaction and a confirmed payment before deciding what to do.
4. Initiate only a permitted action under the existing lifecycle and signer rules. For an uncertain broadcast, reconcile its retained signature/state before any new payment; prevent duplicates.
5. Refresh authoritative evidence and close the exception only after matching execution is confirmed. Keep the decision and evidence inspectable.

For on-chain settlement, confirm with the transaction and corresponding program/token account state under the documented RPC trust and finality assumptions. Current wallet balances alone cannot establish historical payment. For bank transfers, a separate reliable bank/paying-agent confirmation source and reconciliation integration are required. An external-event proposal is not settlement confirmation. Unknown/unavailable evidence must remain visible, rather than being treated as zero or success.

The operational metric is **expected entitlement minus matched confirmed execution**, in the same currency and units, with unresolved evidence shown separately. Proposed acceptance: the fixture shows one $500 exception, drill-down explains A's right and confirmation gap, an unauthorized/duplicate correction is blocked, an uncertain result remains unresolved, and valid confirmation clears the exception without changing the historical right. These criteria require future implementation and tests.

## Interface progression: simple to complex

Use a **financial operations workspace**: tables, clear amounts, status filters, an action detail page and evidence drill-down. Design around the servicing job; wallet connection and Explorer links belong where signing or evidence requires them.

| Stage | Layout and flow | Delivery boundary |
|---|---|---|
| 1. One action | Instrument setup → action detail; Expected / Confirmed / Unsettled summary, holder reconciliation table, exception detail and one permitted next action | Recommended first BondOps increment; existing lifecycle is the foundation, exception presentation is proposed |
| 2. Servicing workspace | Instruments / Actions / Exceptions / Audit navigation; search, due-date filters and cross-action attention queue → action → holder → evidence | Requires portfolio discovery, aggregation and explicit exception rules |
| 3. Team operations | Calendar, assignments, notifications, approval queue and retained resolution history | Requires operational persistence, organization permissions and new requirements; existing protocol governance does not supply all of these |
| 4. Infrastructure | API/SDK, settlement connectors and embedded servicing views | Long-term integration product; requires reliability, security, support and demand evidence |

Recommended first layout: a compact instrument header; three amount cards; a prominent exception row; a holder table; a detail panel containing right, formula, evidence and permitted action. Show principal and final coupon separately for redemption, together with required holder signature and retired supply. Voting uses its own quorum/tally view rather than payment metrics.

End-to-end servicing flow: **create/select instrument → register/distribute positions → schedule coupon/voting/redemption → fix record-date rights → calculate → approve → fund when required → execute/sign → reconcile confirmations → investigate exceptions → verify/export outcome**. The exception view may expose incomplete progress; it must not bypass finalization conditions.

## Recorda Infrastructure — long-term goal

API and SDK for automating corporate actions on Solana, for exchanges, tokenization platforms, custodians and financial developers. The promise is to connect verified bond-servicing mechanisms to existing systems instead of rebuilding them. Existing typed clients and CLI/library helpers are a foundation, not a supported production API/SDK offering.

Advance after validating recurring BondOps usage, demand for integrations and willingness to pay, and demonstrating reliable recovery, settlement-source trust, supported capacity and production security. Reuse and integration potential are hypotheses, not established market evidence.
