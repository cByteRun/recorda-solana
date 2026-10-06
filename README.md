# Recorda

**Corporate actions for tokenized bonds on Solana.**

Tokenizing a bond records ownership, but servicing it still requires determining who held it on the record date, calculating what each investor is owed, approving payment and reconciling the result. When these steps use separate records, errors are harder to prevent and outcomes harder to verify.

Recorda connects them in one reproducible process: **Record Date → Right → Controlled Execution → Verifiable Proof**. The operator reviews and approves execution; investors and auditors can trace each outcome back to the recorded holdings and formula.

Investor A held **10 bonds** on the record date, then sold 4. A now holds **6**, but the coupon remains **10 × 1,000 × 10% ÷ 2 = 500**. Recorda preserves that right through the transfer and links the payment to its receipt. This reduces reconciliation between ownership, calculations and payments, and makes the result independently explainable.

The target product uses the same lifecycle for **coupons, redemption and voting**. Coupon is implemented and locally verified; redemption and voting remain open. [Product context](docs/PRODUCT.md) explains the domain and positioning; [ROADMAP](docs/ROADMAP.md) tracks delivery.

## Quick start

Requires Node **22.12+** and npm.

```bash
npm ci
npm run dev
```

Open http://localhost:4444. You can see the product flow and golden example without connecting a wallet.

## Quick validation — see the business rule

1. On the home page, follow the coupon pipeline and scroll to **Golden black-box oracle / Known input → logic → expected output**.
2. Compare **Input → Expected → Actual** for the [required golden dataset](golden/coupon-tz-section-22.json), specified in [TZ §22](docs/TZ.md#22-demo-dataset).
3. Check **PASS**: A's current holdings decrease after the transfer, while the coupon still uses A's record-date holdings. This is the business rule the product preserves.

The oracle is labelled **SIMULATED**: it demonstrates the calculation without a wallet or payment. To replay the client lifecycle and its failure cases automatically:

```bash
npx playwright install --with-deps chromium
npm run test:e2e:golden
```

These tests use a controlled wallet/RPC. For actual program execution, payment and receipt verification, continue with Coupon Core below. The [coverage matrix](docs/ROADMAP.md#verification-and-gaps) distinguishes each kind of evidence.

## Build and verify Coupon Core

Also requires host Rust **1.90**, C build tools/system development libraries, and Solana CLI/SBF tools **2.3.0** on PATH. Anchor crates/client are pinned to **0.32.1**; Anchor CLI is optional because IDL scripts compile Anchor macros directly.

```bash
npm run protocol:test:rust
npm run protocol:build
npm run protocol:idl:check
npm run build
npm run protocol:test:ui
```

Playwright system dependency installation may require sudo on Linux. After changing the program interface, run `npm run protocol:idl` and include both generated files; `protocol:idl:check` checks them without rewriting.

`protocol:test:ui` starts a fresh validator, runs actual PDA/token-account integration checks and browser E2E, then stops it. Keep RPC **18899**, faucet **19900** and Vite **4445** free. It prints the retained `/tmp` ledger path and generates `target/protocol-evidence/` plus Playwright reports/traces. R1 tests run Vite on **4444** with controlled wallet/RPC.

Local audit on **2026-10-06**: production/SBF build and IDL check passed; Rust **4/4**, client **36/36**, validator **16/16**, protocol browser/audit **4/4**. See [verification and gaps](docs/ROADMAP.md#verification-and-gaps) for requirement mapping. Local checks do not establish remote CI or human Devnet acceptance.

## Configuration and runtime boundaries

The `/` page is the Browser/Memo reference: snapshot, entitlement and lifecycle state belong to the browser. `/protocol` uses Anchor accounts for finalized rights and outcomes; [ARCHITECTURE](docs/ARCHITECTURE.md#runtime-and-trust) explains both flows.

Optional: copy `.env.example` to `.env.local` and set the public browser-accessible `VITE_SOLANA_RPC_URL`. All `VITE_*` configuration is exposed to the browser; keep secrets out of it.

Real reference operations require Phantom on **Devnet**, fee SOL and explicit signing. Use a fresh browser origin/profile for the required fixture; historical deployments are not converted. Mock USD and disposable holder identities are demo assets. Holder keys are stored locally; the operator key stays in Phantom.

To build and serve the production bundle:

```bash
npm run build
npm run preview
```

## Manual acceptance

For human local Coupon replay, build the program and start:

```bash
solana-test-validator --reset --ledger /tmp/recorda-manual-ledger \
  --bpf-program Fg6PaFpoGXkYsidMpWxTWqkZ7FEfcYkgMQHGhUhF9J3x target/deploy/recorda.so
```

In a second terminal:

```bash
VITE_SOLANA_RPC_URL=http://127.0.0.1:8899 npm run dev
```

Use a wallet compatible with the local RPC, fund its public address with local SOL and open `/protocol`:

1. Create the demo instrument from the [required golden fixture](golden/coupon-tz-section-22.json) and schedule a future record time.
2. After record time, begin/capture/finalize the snapshot; transfer A→B:4.
3. Compare current units, fixed snapshot units and calculated coupons with the fixture’s expected output.
4. Explicitly approve, fund the vault, settle and finalize.
5. Reopen `/protocol?action=<Action PDA>` without wallet/local cache; audit formula, totals, hashes, destinations and paid amounts.

For **Devnet**, first deploy the matching program and synchronize `declare_id!`, `Anchor.toml`, generated IDL, deployment keypair and `VITE_RECORDA_PROGRAM_ID`. The default address does not prove a Devnet deployment. Set the Devnet RPC, connect Phantom with fee SOL and repeat the flow with human approvals.

Retain network/program/mint/action/receipt addresses, record/capture metadata/hash, all stage signatures and payment-token before/after balances. Pass requires exact golden payouts/total, fixed snapshot rights, successful approval and a verifiable FINALIZED receipt. Human signing evidence remains open.

For the `/` reference, replay deploy → snapshot → A→B:4 → calculate → approve → settle → Memo receipt. Retain its six stage signatures and payout deltas separately; a Memo receipt is not an Anchor receipt. After ambiguous broadcast confirmation, reconcile the saved signature and destination deltas before retrying; clearing local state is not reconciliation.

## CI, deployment and troubleshooting

PR CI in `.github/workflows/e2e.yml` checks build/client tests and Coupon protocol, cancels stale runs and retains evidence. Production workflow `.github/workflows/deploy.yml` handles merged same-repository PRs to `main`, rechecks build/tests and deploys Vercel prebuilt output. `vercel.json` disables Git auto-deployments. Configure GitHub secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; remote execution and the first merge deployment remain unverified.

RPC 429: requests are serialized with bounded Retry-After backoff; use a browser-accessible Devnet endpoint if throttling persists. Phantom error: check network/account, unlock/reconnect and inspect simulation logs. Simulation failure must not submit a transaction; a known broadcast signature must be reconciled before another payment.

## Documentation

| File | Purpose |
| --- | --- |
| [TZ](docs/TZ.md) | Source of truth: scope, rules and acceptance |
| [REQUIREMENTS](docs/REQUIREMENTS.md) | Normative annex: roles, UC, FR/NFR, TC and full MVP DoD |
| [ROADMAP](docs/ROADMAP.md) | Verification/gaps, current focus, phases and milestone feature checklists |
| [CHANGELOG](docs/CHANGELOG.md) | Compact change history |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Runtime, accounts, trust boundaries and test artifacts |
| [PRODUCT](docs/PRODUCT.md) | Problem, users, value and demo narrative |

The [historical regression](golden/coupon-happy-path.json) remains separate from the required demo. TZ takes precedence; roadmap checkmarks do not amend requirements.

All rights reserved: [LICENSE](LICENSE). Third-party licenses remain applicable.
