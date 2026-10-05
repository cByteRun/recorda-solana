# Recorda — holder rights and corporate actions on Solana

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

These are target product capabilities. Implemented scope and limitations appear below; detailed milestones and current focus are in [ROADMAP](ROADMAP.md).

## Demonstrate the idea in 30–60 seconds

Investor A held **10 bonds on the record date**. A then transferred 4 bonds to B: A currently holds **6**, but the coupon entitlement remains based on the recorded **10**.

| Golden coupon metric | A | B | C | Total |
| --- | ---: | ---: | ---: | ---: |
| Record-date position | 10 | 20 | 5 | 35 |
| Current ownership after A → B: 4 | 6 | 24 | 5 | 35 |
| Snapshot-based coupon, KUSD-DEV | 500 | 1000 | 250 | 1750 |

A's formula: **10 × 1000 × 10% ÷ 2 = 500**. The operator reviews the distribution and approves execution in Phantom; the outcome must then be verifiable through transactions and a receipt.

> **If the demo does not make this idea obvious in 30–60 seconds, simplify the UI or scope.**

The [golden dataset](golden/coupon-happy-path.json) fixes known inputs and expected outputs. Its numerical scenario does not replace the specification's other acceptance cases.

## Implementation and evidence boundaries

| Layer | Implemented | Still required for the full MVP |
| --- | --- | --- |
| Client | React + TypeScript + Vite, Tailwind v4, local shadcn-style components, FSD-style structure | Complete Operator / Investor / Auditor journeys |
| Coupon bridge | Phantom signing, Token-2022 operations and RPC, browser snapshot/calculation, Memo attestations | Repeat manual React Devnet acceptance with signatures and payout deltas |
| Automated verification | Playwright: golden model, UI, wallet gating, runtime errors | Real protocol E2E and negative on-chain checks |
| Protocol core | Target architecture documented | Anchor PDAs, immutable snapshot, integer math, authority and idempotency |
| Other corporate actions | Requirements and plan | Redemption and Voting |

**Offline oracle PASS verifies the scenario model.** Settlement and FINALIZED are simulated in this oracle. Actual outcomes are verified by reading Solana state and transactions.

The Browser/Memo bridge still stores domain state in the browser; Memo records submitted data but does not enforce entitlement correctness or prevent double payment. The target source of finalized state is the Recorda Anchor program.

## Run locally

Requires Node.js **22.12+**, npm and repository access.

```bash
git clone --branch feat/phase-1-react https://github.com/cByteRun/recorda-solana.git
cd recorda-solana
npm ci
npm run dev
```

Open the URL printed in the terminal, usually http://localhost:4444. The interface and offline golden are available without a wallet. Real operations require Phantom, Solana Devnet, SOL for gas and manual transaction approval. A/B/C are disposable Devnet identities.

To view the built version:

```bash
npm run build
npm run preview
```

## Verify implementation

```bash
npm run build
npx playwright install chromium
npm run test:e2e:golden
```

Verification chain: **Specification and its axis → milestone/features → golden input/expected → implementation → Playwright and protocol tests → actual output/proof**.

Playwright automatically checks the model and browser interface without signing transactions. Follow [Manual Devnet Acceptance](tests/MANUAL_DEVNET_ACCEPTANCE.md) for the real flow. The full MVP requires Coupon, Redemption and Voting, authorization checks and protection against repeated execution.

## Documentation and source of truth

1. [Technical specification](docs/TZ.md) — central idea, UC, FR/NFR and acceptance; takes precedence in a conflict.
2. [ROADMAP](ROADMAP.md) — phases, milestones, FEATURES, current focus and verified progress.
3. [PRODUCT](docs/PRODUCT.md) — business-problem explanation.
4. [ARCHITECTURE](ARCHITECTURE.md) — stack, file structure and responsibility boundaries.
5. [Implementation plan](docs/plan.md) — technical implementation sequence.
6. [Golden dataset](golden/coupon-happy-path.json), [audit](docs/PHASE_1_AUDIT.md) and [reference prototype](prototype/kase-real-devnet-v4-kusd.html) — verification and evidence.

Specification success metric: **100% correctly and reproducibly processed holder entitlements with verifiable on-chain outcomes**. MVP targets: 0 mismatches, 0 repeated executions, 0 unauthorized executions, and 3/3 scenarios with proof.

## Rights

All rights reserved. See [LICENSE](LICENSE). Third-party dependencies retain their own licenses.

## CI and merge-only deployment

GitHub Actions runs build and Playwright on PR updates to `main`, with one run per PR and stale-run cancellation. `ubuntu-latest` is a GitHub-managed VM: provisioning can queue; it is not a separately configured server. Local checks are available through the commands above.

Production deployment runs only when a same-repository PR is merged into `main`. `.github/workflows/deploy.yml` checks out the merge commit, reruns build/tests, then uses the official Vercel CLI to build and deploy prebuilt production artifacts. Direct pushes and unmerged closed PRs do not deploy. `vercel.json` disables Vercel Git auto-deployments to avoid duplicate builds.

Before the first merge deployment, configure GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` for the existing Vercel project. The workflow reports missing secret names without exposing their values. No production deployment is performed by editing this branch.

### Phantom transaction troubleshooting

Set Phantom to **Solana Devnet**, unlock the wallet and connect the operator account with Devnet SOL for transaction fees. Prefer Phantom's namespaced injected provider when multiple wallet extensions are installed.

Signed Memo attestations receive an explicit compute budget. RPC simulation runs before signing and surfaces program logs on failure. If simulation passes but Phantom returns `Unexpected error`, reconnect and check its selected network/account. Signing remains manual. Snapshot reads fail rather than recording an RPC-error fallback as a zero balance. After a transaction is broadcast, an ambiguous confirmation never triggers an automatic re-sign/payment; inspect its signature and balances before retrying.

### Public Devnet RPC throttling

Snapshot acquisition uses one contextual batch read for all holder token accounts, without the redundant full dashboard refresh. Shared RPC requests are serialized and 429 responses honor Retry-After with bounded backoff. If the shared endpoint remains throttled, copy `.env.example` to `.env.local`, set `VITE_SOLANA_RPC_URL` to your browser-accessible **Devnet** endpoint and restart Vite. VITE variables are public client configuration, not a place for private secrets.

RPC 429 and Phantom signing failure are separate: a successful application simulation does not prove the wallet's internal signing/simulation succeeded. A continuing wallet error requires the Phantom version and account type (normal software wallet, hardware or watch-only) to diagnose; no transaction is sent when signing fails.
