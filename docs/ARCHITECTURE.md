# Recorda architecture

## Current scope

React Browser/Memo reference at `/` plus Anchor Coupon Core at `/protocol`. Product axis:
**Record Date → Right → Controlled Execution → Verifiable Proof**.
Requirements authority: [TZ](TZ.md). Delivery: [ROADMAP](ROADMAP.md).

## Stack and purpose

| Component | Purpose |
| --- | --- |
| React 19 + TypeScript | Dashboard, holder views, workflow controls and typed state |
| Vite | Local development and static production bundle |
| Tailwind v4 / @tailwindcss/vite | Utility CSS compiled through npm |
| Local shadcn-style Button/Card, CVA, clsx, tailwind-merge | Reusable UI variants and class composition; no Radix runtime installed |
| Lucide React | Icons |
| @solana/web3.js | Devnet RPC, keypairs, transaction construction and confirmation |
| @solana/spl-token | Token-2022 mint, ATA and checked transfer instructions |
| Phantom injected provider | Operator connection and explicit transaction signing |
| buffer | Browser-compatible instruction data |
| localStorage | Disposable Devnet holder keys and deployment/action resume references |
| Playwright | Domain oracle and real browser UI checks without wallet signing |
| GitHub Actions | npm ci → TypeScript/Vite build → Chromium tests → report artifacts |
| Vercel | Prebuilt production deployment only after a merged PR; Git auto-deployments disabled |

## Folder and file responsibilities

| Path | Responsibility |
| --- | --- |
| `index.html`, `src/main.tsx` | Browser entry and React mount |
| `src/app/App.tsx`, `src/app/styles/globals.css` | Application composition and styles |
| `src/pages/dashboard/ui/dashboard-page.tsx` | Operator dashboard and lifecycle controls |
| `src/widgets/holder-grid/` | A/B/C/D ownership, snapshot and entitlement cards |
| `src/widgets/pipeline/` | Ordered workflow step component |
| `src/widgets/golden-oracle/` | Expected/actual deterministic model comparison |
| `src/features/corporate-action/model/use-recorda-controller.ts` | Coupon orchestration, signing, RPC refresh and resume state |
| `src/features/corporate-action/model/coupon.ts` | Checked BigInt coupon products, per-holder minor-unit rounding and aggregate overflow validation |
| `src/features/corporate-action/model/golden.ts` | Input-derived offline model and full output comparison |
| `src/features/corporate-action/model/types.ts` | Client action state types |
| `src/entities/holder/`, `src/entities/instrument/` | Holder types and demo instrument parameters |
| `src/shared/solana/config.ts` | Devnet connection and Explorer links |
| `src/shared/solana/phantom.ts` | Injected wallet interface |
| `src/shared/solana/transactions.ts` | Simulate/sign/send/confirm adapter |
| `src/shared/solana/persistence.ts` | v4-compatible localStorage keys and disposable identities |
| `src/shared/ui/`, `src/shared/lib/` | Button/Card and shared helpers |
| `golden/coupon-happy-path.json` | Historical three-holder regression; existing expected output retained |
| `golden/coupon-tz-section-22.json` | Required TZ four-holder scenario, supply 17, coupon total 850 USD |
| `tests/bridge-lifecycle.spec.ts`, `tests/helpers/bridge.ts` | Browser → controller → decoded transaction → controlled RPC token-account results, with a test wallet |
| `tests/coupon-precision.spec.ts` | TZ dataset, minor-unit precision and invalid/overflow inputs |
| `docs/R1_TEST_COVERAGE.md` | Requirement-to-test coverage and remaining protocol/manual boundaries |
| `tests/golden-domain.spec.ts`, `tests/golden-ui.spec.ts` | Domain and browser regression checks |
| `docs/MANUAL_DEVNET_ACCEPTANCE.md` | Human-signed real-chain acceptance |
| `docs/TZ.md`, `docs/PRODUCT.md`, `docs/plan.md` | Requirements, product interpretation and implementation plan |
| `docs/PHASE_1_AUDIT.md` | Traceability, evidence and remaining gaps |
| `prototype/` | Frozen v4 HTML behavioral reference |
| `.github/workflows/e2e.yml`, `.github/workflows/deploy.yml`, `playwright.config.ts` | PR CI, merge-only production deployment and browser test configuration |
| `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts` | npm dependencies, reproducible resolution, typing and bundling |
| `components.json`, `vercel.json` | UI generator aliases and hosting configuration |

Layers follow FSD direction: app → pages → widgets → features → entities → shared.
This is FSD-style organization, with direct imports rather than enforced public slice APIs.
No application backend/database is required. `programs/recorda/src/lib.rs` owns Coupon Core truth; generated IDL/types live in `src/shared/solana/idl/`. `protocol.ts` constructs instructions/reads PDAs; `protocol-audit.ts` independently verifies formula, totals and hashes. The protocol controller/page orchestrate explicit signing, chain recovery and read-only history. See [Coupon Core](COUPON_PROTOCOL.md).

## Data flow and trust boundary

Dashboard invokes controller → controller reads Devnet accounts → operator reviews
and signs in Phantom → checked Token-2022 transaction executes → confirmed signature
and client workflow references are persisted → holder cards refresh from RPC.

Token balances and transaction signatures are real-chain data. Snapshot metadata,
entitlements and lifecycle status are browser-owned and attested using Memo.
Memo proves submitted bytes, not the correctness or immutability of domain rules.
Offline oracle calculates the TZ §22 distribution; its SIMULATED/PASS label is not a Devnet receipt. Tests intercept RPC and use a test wallet; their token movements are harness state, not validator evidence.

Holder private keys are disposable Devnet identities stored locally, not operator
keys. Storage is scoped to browser origin: localhost, 127.0.0.1 and each Vercel
preview do not share state. Never use this storage model for production custody.

## Coupon Core architecture

Implemented: Instrument, HolderPosition, CorporateAction, EntitlementPosition
and ActionReceipt PDAs. Immutable snapshot fields are stored inside
EntitlementPosition as permitted by TZ §§9/18; snapshot_index records commitment
order. Scheduled record timestamps block ownership/registry changes even when
begin_snapshot is late. Token-2022 bond accounts remain frozen except during
atomic protocol-mediated transfers; Instrument PDA also controls close authority.
Coupon calculation, approval, funding, resumable settlement and receipt execute
on-chain. React reads the generated contract and verifies outcomes independently.
One scheduled/pending snapshot per instrument; issuance is sealed after the first
snapshot; approval changes require zero units. Issuer/operator share one authority.
Plain two-decimal Token-2022 Mock USD is the test payment rail.

The browser caches addresses and disposable holder keys, never finalized amounts
or operator secrets. Payment history records destination, paid amount and slot;
RPC signatures link to events. Current holder balances are separate from past
snapshot rights and past paid amounts. Instrument history links each action URL.
Validator golden tests read actual PDA/token state; the protocol browser suite
uses a controlled signer with real validator RPC. Real Phantom/Devnet acceptance
remains separate. Phase 2 Redemption/Voting is still pending.

## Transaction verification

The shared TypeScript transaction adapter adds a compute budget for Memo attestations, simulates against Devnet before requesting Phantom signing, checks the connected account and avoids automatic retry after a known broadcast signature. Snapshot acquisition reads validated holder accounts directly and fails on RPC errors. `tests/transactions.spec.ts` covers these boundaries with mocked RPC and wallet responses; actual Phantom/Devnet execution remains manual acceptance.

## R1 calculation and recovery contract

New deployments target A/B/C/D = 10/5/2/0. Existing holder keys are retained and D is added. Start a fresh origin/profile for the new 17-unit demo; a historical 35-unit deployment is not overwritten or redistributed. The historical golden expected output remains unchanged.

Financial products and totals use BigInt, validated integer inputs and checked conversion to safe integer minor units. The client rounds down once per holder in minor units; USD formatting divides the result only for display. Stored entitlements include amountMinor and totalMinor. Settlement validates each amount against its snapshot and sends integer Token-2022 amounts rather than rounding USD floats.

Unavailable token balances render as unknown (—). Deployment cannot treat unavailable balances as zero and mint again; settlement cannot use unknown pre-payment balances. Snapshot reads fail closed and validate token-account owner and mint.

The transaction adapter invokes onSubmitted immediately after broadcast and before confirmation. Settlement saves pendingSettlementSignature at that point. Failure/ambiguous confirmation leaves payment blocked across reload; only successful confirmation promotes it to the confirmed settlement signature. This is a browser safeguard, not protocol idempotency or automatic reconciliation.
