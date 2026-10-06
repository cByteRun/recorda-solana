# Recorda

### Holder rights and corporate actions on Solana

![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
[![Rights](https://img.shields.io/badge/Rights-All%20rights%20reserved-555555?style=flat-square)](LICENSE)

[Product](#business-problem) · [Demo](#demonstrate-the-idea-in-3060-seconds) · [Quick start](#run-locally) · [Documentation](#documentation-and-source-of-truth)

> **“Tokenization tells you who owns the asset. We determine what that ownership entitled them to on the record date, execute the corporate action and prove what happened next.”**

**Recorda** links ownership of a tokenized security on the record date to a holder's entitlement, controlled corporate-action execution and a verifiable outcome.

**Central product axis: Record Date → Right → Controlled Execution → Verifiable Proof.**

## Business problem

A tokenized bond continues its lifecycle after issuance: coupons must be paid, principal redeemed, votes conducted and each investor's entitlement explained.

The current balance shows ownership today. Corporate actions require answers to different questions:

- Who owned the instrument **on the record date**, and how many units did they hold?
- What right arose: a coupon amount, redemption payment or vote?
- Which parameters determined that entitlement?
- Who authorized execution, and what actually happened?
- Where can the investor and auditor verify the outcome?

Without a shared link between the registry, calculation, execution and history, these questions require separate data reconciliation. Recorda creates one process for servicing rights after instrument issuance.

## Solution and domain features

| Central-axis stage | Product function | User outcome |
| --- | --- | --- |
| Record Date | Identifies eligible holders and records their positions at the required date | The entitled holders are known |
| Right | Calculates coupon, principal or voting power from the snapshot and instrument terms | Each holder knows what they are entitled to and why |
| Controlled Execution | Previews the distribution, requires authority approval and executes the action | Payment, redemption or voting follows defined rules |
| Verifiable Proof | Links the action to its outcome, transactions and receipt | Users can verify who acquired which right, when and how it was executed |

Required MVP scenarios from the [technical specification](docs/TZ.md):

1. **Coupon Payment:** snapshot → coupon → approval → payment → proof.
2. **Bond Redemption:** snapshot → principal and final coupon → execution → burn/retire/lock → proof.
3. **Bondholder Voting:** snapshot → voting power → vote → double-vote protection → result.

A shared registry/snapshot/entitlement layer must serve all three scenarios.

## Users and value

| User | Task | Recorda value |
| --- | --- | --- |
| Corporate-actions operator / market infrastructure | Identify holders, verify calculations and execute an event | One reproducible workflow with less manual reconciliation |
| Issuer / paying agent | Determine obligations and prepare payment or redemption | Transparent amounts, approvals and execution status |
| Holder / investor | Understand their entitlement and verify the outcome | Record-date position, formula, amount and proof |
| Auditor | Verify inputs and actual results | A linked snapshot → entitlement → execution → receipt chain |

Economic hypothesis: fewer fragmented operations and errors, faster verification and audit, and engine reuse for new events. Savings percentages require separate measurement.

## Our edge

**Linking historical ownership to entitlement and proven execution is Recorda's core.**

Token-2022 provides basic asset operations. Recorda's domain layer adds:

- one record-date mechanism for payments, redemption and voting;
- holder rights that survive a post-record transfer;
- explainable calculations from the snapshot and instrument terms;
- explicit execution approval and protection against repeated processing;
- corporate-action history and a verifiable ActionReceipt.

These are target product capabilities. Implemented scope and limitations appear below; detailed milestones and current focus are in [ROADMAP](docs/ROADMAP.md).

## Demonstrate the idea in 30–60 seconds

Investor A held **10 bonds on the record date**. A then transferred 4 bonds to B: A currently holds **6**, but the coupon entitlement remains based on the recorded **10**.

| TZ §22 coupon metric | A | B | C | D | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Record-date position | 10 | 5 | 2 | 0 | 17 |
| Current ownership after A → B: 4 | 6 | 9 | 2 | 0 | 17 |
| Snapshot-based coupon, KUSD-DEV | 500 | 250 | 100 | 0 | 850 |

A's formula: **10 × 1000 × 10% ÷ 2 = 500**. The operator reviews the distribution and approves execution in Phantom; the outcome must then be verifiable through transactions and a receipt.

> **If the demo does not make this idea obvious in 30–60 seconds, simplify the UI or scope.**

The [TZ §22 golden dataset](golden/coupon-tz-section-22.json) fixes the required four-holder demo, including zero-balance D. The [historical golden](golden/coupon-happy-path.json) preserves 10/20/5 → 6/24/5 and 1750 as a separate regression. Coupon calculations use checked BigInt products in settlement minor units; USD numbers are display values only.

## Implementation and evidence boundaries

| Layer | Implemented | Still required for the full MVP |
| --- | --- | --- |
| Client | React + TypeScript + Vite, Tailwind v4, local shadcn-style components, FSD-style structure | Complete Operator / Investor / Auditor journeys |
| Coupon bridge | Phantom signing, Token-2022 operations and RPC, browser snapshot/calculation, Memo attestations | Repeat manual React Devnet acceptance with signatures and payout deltas |
| Automated verification | R1 client golden plus real-validator Coupon protocol golden, security, browser recovery and independent audit | Remote CI and manual Phantom/Devnet replay |
| Protocol core | Anchor Coupon PDAs, immutable snapshot, integer math, authority, once-only payment and receipt; local golden acceptance | Devnet deployment/acceptance and security coverage for the remaining MVP scenarios |
| Other corporate actions | Requirements and plan | Redemption and Voting |

**Offline oracle PASS verifies the scenario model.** The offline oracle calculates expected amounts without executing payment. Actual outcomes are verified by reading Solana state and transactions.

The Browser/Memo bridge still stores domain state in the browser; Memo records submitted data but does not enforce entitlement correctness or prevent double payment. The `/protocol` Coupon Core uses Recorda-owned Anchor state for finalized rights and outcomes. See [Coupon Core](docs/COUPON_PROTOCOL.md) for setup, local verification and restrictions.

## Run locally

Requires Node.js **22.12+**, npm and repository access.

```bash
git clone https://github.com/cByteRun/recorda-solana.git
cd recorda-solana
npm ci
npm run dev
```

Open the URL printed in the terminal, usually http://localhost:4444. The interface and offline golden are available without a wallet. Start the TZ §22 demo in a fresh browser origin/profile; old 35-unit deployments cannot be resumed into the 17-unit scenario. Existing A/B/C holder keys are preserved and D is added, but old three-holder actions are not converted into four-holder settlement. Real operations require Phantom, Solana Devnet, SOL for gas and manual transaction approval. A/B/C/D are disposable Devnet identities.

To view the built version:

```bash
npm run build
npm run preview
```

## Verify implementation

```bash
npm run build
npx playwright install --with-deps chromium
npm run test:e2e:golden
```

On Linux, `--with-deps` installs the system libraries required by Chromium as well as the browser. This may require a sudo password; installing only the browser can leave UI tests failing at launch with missing libraries such as `libnspr4.so`.

See the [R1 requirement coverage matrix](docs/R1_TEST_COVERAGE.md) for UC/FR/NFR/TC mappings and manual boundaries.

Verification chain: **Specification and its axis → milestone/features → golden input/expected → implementation → Playwright and protocol tests → actual output/proof**.

R1 Playwright checks the model and bridge using controlled wallet/RPC. Coupon Core tests also execute actual Anchor/Token-2022 transactions on a local validator with a controlled signer. Follow [Manual Devnet Acceptance](docs/MANUAL_DEVNET_ACCEPTANCE.md) for the real flow. The full MVP requires Coupon, Redemption and Voting, authorization checks and protection against repeated execution.

For the on-chain Coupon Core, install host Rust 1.90, Solana CLI/SBF 2.3.0
and C build tools, then:

```bash
npm run protocol:test:rust
npm run protocol:build
npm run protocol:idl:check
npm run protocol:test:ui
```

Local verification on 2026-10-06: Rust **4/4**, validator integration **16/16**,
protocol browser/audit **4/4**, R1 golden **35/35**. Both coupon golden fixtures
produce exact on-chain payments and receipts. See [Coupon Core setup and
coverage](docs/COUPON_PROTOCOL.md). This does not establish a Devnet deployment
or real Phantom acceptance. Redemption and Voting execution remain pending.

## Documentation and source of truth

1. [Technical specification](docs/TZ.md) — central idea, UC, FR/NFR and acceptance; takes precedence in a conflict.
2. [ROADMAP](docs/ROADMAP.md) — phases, milestones, FEATURES, current focus and verified progress.
3. [PRODUCT](docs/PRODUCT.md) — business-problem explanation.
4. [ARCHITECTURE](docs/ARCHITECTURE.md) — stack, file structure and responsibility boundaries.
5. [Implementation plan](docs/plan.md) — technical implementation sequence.
6. [Operations](docs/OPERATIONS.md) — CI/deployment configuration and troubleshooting.
7. [TZ golden dataset](golden/coupon-tz-section-22.json), [historical regression](golden/coupon-happy-path.json), [audit](docs/PHASE_1_AUDIT.md) and [reference prototype](prototype/kase-real-devnet-v4-kusd.html) — verification and evidence.

Specification success metric: **100% correctly and reproducibly processed holder entitlements with verifiable on-chain outcomes**. MVP targets: 0 mismatches, 0 repeated executions, 0 unauthorized executions, and 3/3 scenarios with proof.

## Rights

All rights reserved. See [LICENSE](LICENSE). Third-party dependencies retain their own licenses.
