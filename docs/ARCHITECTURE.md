# Recorda architecture

## Current scope

React port of the v4 coupon Devnet prototype. Product axis:
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
| `src/widgets/holder-grid/` | A/B/C ownership, snapshot and entitlement cards |
| `src/widgets/pipeline/` | Ordered workflow step component |
| `src/widgets/golden-oracle/` | Expected/actual deterministic model comparison |
| `src/features/corporate-action/model/use-recorda-controller.ts` | Coupon orchestration, signing, RPC refresh and resume state |
| `src/features/corporate-action/model/golden.ts` | Input-derived offline model and full output comparison |
| `src/features/corporate-action/model/types.ts` | Client action state types |
| `src/entities/holder/`, `src/entities/instrument/` | Holder types and demo instrument parameters |
| `src/shared/solana/config.ts` | Devnet connection and Explorer links |
| `src/shared/solana/phantom.ts` | Injected wallet interface |
| `src/shared/solana/transactions.ts` | Simulate/sign/send/confirm adapter |
| `src/shared/solana/persistence.ts` | v4-compatible localStorage keys and disposable identities |
| `src/shared/ui/`, `src/shared/lib/` | Button/Card and shared helpers |
| `golden/coupon-happy-path.json` | Known input and independent expected output |
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
No backend, database, Anchor program or IDL exists yet.

## Data flow and trust boundary

Dashboard invokes controller → controller reads Devnet accounts → operator reviews
and signs in Phantom → checked Token-2022 transaction executes → confirmed signature
and client workflow references are persisted → holder cards refresh from RPC.

Token balances and transaction signatures are real-chain data. Snapshot metadata,
entitlements and lifecycle status are browser-owned and attested using Memo.
Memo proves submitted bytes, not the correctness or immutability of domain rules.
Offline oracle settlement/status are simulated; its PASS is not a Devnet receipt.

Holder private keys are disposable Devnet identities stored locally, not operator
keys. Storage is scoped to browser origin: localhost, 127.0.0.1 and each Vercel
preview do not share state. Never use this storage model for production custody.

## Target architecture

Next: Anchor Instrument, HolderPosition, CorporateAction, SnapshotPosition,
EntitlementPosition and ActionReceipt PDAs. Protocol validates authority,
immutable snapshots, integer math, allowed transitions and once-only settlement.
React will read accounts via generated IDL rather than trusting localStorage.
See roadmap M1.1–M1.6, then Redemption and Voting in Phase 2.

## Transaction verification

The shared TypeScript transaction adapter adds a compute budget for Memo attestations, simulates against Devnet before requesting Phantom signing, checks the connected account and avoids automatic retry after a known broadcast signature. Snapshot acquisition reads validated holder accounts directly and fails on RPC errors. `tests/transactions.spec.ts` covers these boundaries with mocked RPC and wallet responses; actual Phantom/Devnet execution remains manual acceptance.
