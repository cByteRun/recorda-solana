# Recorda BondOps — product direction

This document supplements [TZ](TZ.md) and [REQUIREMENTS](REQUIREMENTS.md). It defines product value and evolution; it does not amend protocol IDs or close acceptance gates. BO-01–10 now specify the operational layer; current source delivery and live limits are documented in BONDOPS-OPERATIONS and ROADMAP. [ROADMAP](ROADMAP.md) owns delivery status.

## Central value

**A working system for servicing tokenized bonds:** issuers, paying agents and operations specialists control coupon payments, redemptions, errors and confirmations from one workspace.

The recurring job is to identify a financial obligation, reconcile its execution against fixed rights, investigate exceptions and perform an authorized corrective action with evidence. Record-date rights explain who is owed; settlement evidence explains whether the obligation was fulfilled. This recurring operational work is a hypothesis for which a financial organization may pay, to be validated with real users.

Investor signing and Auditor verification support the operator's workflow. Issuance and the holder registry establish the instrument being serviced; Coupon and Redemption are the core servicing tasks. Voting remains the required third KASE scenario.

### Operator control in the current overview

The dashboard turns the shared lifecycle into a next-step queue: fix rights → calculate → approve → fund when required → execute/vote → finalize the receipt → inspect evidence. Filters group actions by the work still required, with uncertain results prioritized for reconciliation. Each action exposes its own cutoff and sourced deadline.

Voting has a quorum/tally view without payment funding. Redemption shows principal and final coupon separately after verified calculation, requires holder authorization and tracks retirement alongside payment. Expandable asset details show base instrument terms, authority and outstanding/retired supply; each action retains its own fixed terms. Unknown/pending payments must be reconciled before retry, and execution without a verified final receipt remains incomplete in the overview.

These controls support the recurring servicing job with existing authorized workflows. [Dashboard contract](ONCHAIN-DASHBOARD.md) describes the read model; [asset-tokenization research](ASSET-TOKENIZATION-RESEARCH.md) maps this presentation to TZ and the supplied Chainlink reference.

## Proposed demonstration: missing coupon payment

**Illustrative product scenario, not real Devnet payment data.** The operational frontend/backend now exposes this workflow; live acceptance is separate. The original product example below uses 35 units. The implemented demo is aligned to TZ: 17 units, rights 500/250/100/0, illustrative confirmations 350 and unknown 500 Mock USD. Dollar amounts describe obligations, not actual fiat settlement.

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

The operational metric is **expected entitlement minus matched confirmed execution**, in the same currency and units, with unresolved evidence shown separately. Proposed acceptance: the fixture shows one $500 exception, drill-down explains A's right and confirmation gap, an unauthorized/duplicate correction is blocked, an uncertain result remains unresolved, and valid confirmation clears the exception without changing the historical right. The current local service/API/browser tests cover these criteria with fixtures/injected readers. Real-wallet Devnet acceptance and bank confirmations remain open; see [operational evidence](BONDOPS-OPERATIONS.md#verification).

## Interface progression: simple to complex

Use a **financial operations workspace**: tables, clear amounts, status filters, an action detail page and evidence drill-down. Design around the servicing job; wallet connection and Explorer links belong where signing or evidence requires them.

| Stage | Layout and flow | Delivery boundary |
|---|---|---|
| 1. One action | Instrument setup → action detail; Expected / Confirmed / Unsettled summary, holder reconciliation table, exception detail and one permitted next action | Locally implemented reconciliation/case views; live evidence gate remains open |
| 2. Servicing workspace | Instruments / Actions / Exceptions / Audit navigation; search, due-date filters and cross-action attention queue → action → holder → evidence | Locally implemented portfolio/calendar/queues and source adapter; live indexing acceptance remains open |
| 3. Team operations | Calendar, assignments, notifications, approval queue and retained resolution history | Rust PDA persistence, transaction-signer roles/scopes and on-chain inbox implemented; SQLite is only a filled Test Workspace. Keeper/external delivery/Devnet acceptance remain open |
| 4. Infrastructure | API/SDK, settlement connectors and embedded servicing views | Long-term integration product; requires reliability, security, support and demand evidence |

Recommended first layout: a compact instrument header; three amount cards; a prominent exception row; a holder table; a detail panel containing right, formula, evidence and permitted action. Show principal and final coupon separately for redemption, together with required holder signature and retired supply. Voting uses its own quorum/tally view rather than payment metrics.

End-to-end servicing flow: **create/select instrument → register/distribute positions → schedule coupon/voting/redemption → fix record-date rights → calculate → approve → fund when required → execute/sign → reconcile confirmations → investigate exceptions → verify/export outcome**. The exception view may expose incomplete progress; it must not bypass finalization conditions.

## Recorda Infrastructure — long-term goal

API and SDK for automating corporate actions on Solana, for exchanges, tokenization platforms, custodians and financial developers. The promise is to connect verified bond-servicing mechanisms to existing systems instead of rebuilding them. Existing typed clients and CLI/library helpers are a foundation, not a supported production API/SDK offering.

Advance after validating recurring BondOps usage, demand for integrations and willingness to pay, and demonstrating reliable recovery, settlement-source trust, supported capacity and production security. Reuse and integration potential are hypotheses, not established market evidence.

## Real-world asset assurance and scale

The prototype's instrument, registry, fixed rights and receipts establish the on-chain servicing core. A real-world deployment also needs a verifiable relationship between the tokenized instrument and the issuer's actual obligations/assets, eligible participants and authoritative payment records. These capabilities extend the product beyond the current mock-money prototype; they require new integration requirements and separate acceptance.

| Area | Intended operator workflow | Foundation and remaining boundary |
|---|---|---|
| Participant eligibility / KYC | Review a provider's participant decision, apply expiry/revocation and enforce the policy for new transfers without rewriting historical rights | FR-54 provides versioned eligibility checks. A real KYC/AML provider, operational review and acceptance remain open. Private documents and PII stay off-chain. |
| Asset documents / provenance | Associate issuer and asset identifiers, issuance terms and relevant ownership/custody or collateral documents with the instrument; record reviewer, source, version and validity | FR-55 provides versioned URI/hash commitments and immutable action terms; FR-57 provides external-event provenance. Neither authenticates the underlying document or proves legal rights/backing on its own. External source verification, controlled document access and issuer/custodian review remain to be defined. |
| External settlement | Reconcile authenticated bank/paying-agent evidence to the same fixed obligation and retain conflicting/unknown results for investigation | BO-07 is deferred until provider selection. Confirmation must bind action, holder, asset and amount and resist replay; an external-event proposal is not proof of payment. |
| Larger servicing portfolios | Discover obligations and exceptions reliably, keep proofs available, recover partial execution and measure supported holder/portfolio capacity | Existing historical distribution/claims capabilities and offline benchmarks are a foundation. Native acceptance covers four holders per instrument; 10,000-holder offline calculations are not production throughput. Hosted indexing, retention/recovery, rent/fees and end-to-end load acceptance remain open. |
| Partner integration | Embed rights, authorized actions and inspectable outcomes into exchange, custodian or tokenization-platform systems | Existing clients/helpers are not a supported production API/SDK. Define service ownership, authentication, delivery/recovery contracts and support commitments after demand and reliability validation. |

Reserve or valuation feeds should be selected for the specific asset model. An action vault funds a particular payment; it is not evidence that the entire bond is collateralized. Document, identity and settlement sources must remain distinguishable from verified Solana state in the operator interface.

The [research matrix](ASSET-TOKENIZATION-RESEARCH.md) records reference applicability and source coverage. [Roadmap](ROADMAP.md#future-scope-requiring-new-requirements) owns future delivery; [Architecture operations](ARCHITECTURE.md#operations-and-supported-scope) owns current trust and capacity boundaries. These product directions do not amend TZ or close human Devnet/submission gates.
