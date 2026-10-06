# Architecture

Authority: [TZ](TZ.md) + [REQUIREMENTS](REQUIREMENTS.md). Delivery: [ROADMAP](ROADMAP.md). Evidence: [verification and gaps](ROADMAP.md#verification-and-gaps).

## Runtime and trust

```text
React page → controller → generated Anchor client → signed transaction
→ Recorda program → Token-2022 CPI → PDA/token state
→ RPC reads → independent audit → holder rights / receipt / history
```

There is no application backend/database. Coupon Core at `/protocol` stores finalized truth in Solana accounts. Phantom holds the operator key and signs explicitly. LocalStorage caches addresses and disposable demo-holder keys, scoped by RPC/program; losing it does not erase protocol rights. Holder keys are a test custody model.

The `/` Browser/Memo reference uses real Token-2022 instructions but browser-owned snapshot/entitlement/lifecycle state. Memo attests bytes; it does not enforce rights, immutability or once-only payment. Its offline oracle and mocked tests are simulation evidence.

## Stack and code map

React 19/TypeScript/Vite, Tailwind v4, local shadcn-style primitives, Lucide; Anchor 0.32.1, Solana web3.js/spl-token and Token-2022. FSD import direction: app → pages → widgets → features → entities → shared.

| Path | Responsibility |
| --- | --- |
| `programs/recorda/src/lib.rs` | Coupon instructions, authority/account constraints, math, state and events |
| `src/shared/solana/idl/` | Compiler-generated IDL and TypeScript contract |
| `src/shared/solana/protocol.ts` | PDAs, instructions, validated chain reads and history |
| `src/shared/solana/protocol-audit.ts` | Independent formula, snapshot and receipt reconciliation |
| `src/pages/protocol/`, protocol controller in `src/features/corporate-action/` | Operator lifecycle, holder rights, restore and read-only proof |
| `src/features/corporate-action/model/` | R1 controller, checked client coupon math and offline golden model |
| `src/shared/solana/transactions.ts`, `rpc-fetch.ts`, `persistence.ts` | Simulation/sign/send/confirm, bounded RPC retry and local resume references |
| `golden/`, `tests/`, `protocol-tests/`, `protocol-ui-tests/` | Independent fixtures, client checks and real-validator integration/browser checks |
| `scripts/`, `.github/workflows/` | IDL/build/validator orchestration, PR CI and merged-PR deployment |
| `prototype/` | Historical HTML reference |

Dependency overrides keep the Solana/Anchor versions pinned while using jayson 5 and toml 5. `vendor/bigint-buffer/` provides the four unsigned conversion functions in JS, avoiding the vulnerable native binding; `tests/coupon-precision.spec.ts` verifies exact endian bytes and limits in CJS/ESM.

## Coupon accounts and lifecycle

| PDA | Stored truth |
| --- | --- |
| Instrument | Combined issuer/operator authority, terms, mint/payment mint, outstanding/redeemed supply and transfer/snapshot barriers |
| HolderPosition | Instrument, wallet, registered token account and approval |
| CorporateAction | Unique ID/instrument, scheduled/capture dates, stage, counts/totals, hash and approval |
| EntitlementPosition | Immutable snapshot units/index, calculated coupon, preparatory principal/final coupon/voting power, paid amount/destination/slot |
| ActionReceipt | Final status, settled total, processed count, final slot/time and summary hash |

SnapshotPosition is embedded in EntitlementPosition. Snapshot commitment follows stored holder order; audit recomputes it. Signatures are fetched from RPC, not stored inside the PDA.

Implemented successful stages follow TZ §11. PARTIALLY_SETTLED is represented by EXECUTING plus per-holder progress; insufficient funds/invalid calls reject and roll back rather than persisting separate FAILED/INSUFFICIENT_FUNDS states. CANCELLED is supported for scheduled coupons only. This is a representation difference to track against TZ, not additional implemented action types.

## Correctness and restrictions

- Instrument PDA controls bond mint/freeze/registered-account close authority. Accounts stay frozen outside atomic thaw → checked transfer → freeze; transfers require holder signature and approved sender/recipient.
- Scheduled record time blocks ownership/registry changes even if snapshot starts late. Capture accounts for every approved holder and outstanding unit; finalize makes rights immutable and releases coupon transfer restrictions.
- One scheduled/pending snapshot per instrument. Registration/issuance seals at first snapshot; approval changes require zero units. No post-begin snapshot-abort recovery is implemented.
- Mock payment mint is plain two-decimal Token-2022; extensions that alter credits are rejected. Amounts are u64 minor units, checked u128 products, floor once per holder; aggregate is the sum of rounded amounts. R1 uses checked BigInt and safe integer conversion.
- Authority approves after calculation; vault funding is checked. Payment CPI and paid-state update are atomic; failed calls roll back. Restart reads unpaid entitlements; repeats are rejected. Finalization requires every holder, including zero holders, and exact settled/obligation totals.
- Audit checks account owner/canonical PDAs, formula, snapshot order/hash, units/counts/totals, historical paid amounts/destinations and final receipt identity/hash. Current payment balance can change after payment and is not treated as its historical amount.
- Action history currently queries up to 100 signatures; archival/paginated history is not implemented. Principal/final-coupon/voting-power fields do not execute Redemption or Voting.

## R1 recovery and RPC

The shared adapter simulates before signing, validates connected account, preserves partial holder signatures and adds Memo compute budget. Snapshot reads fail on bad accounts/RPC errors. Unknown balances display `—`; allocation/settlement fail closed. Broadcast payment signature is saved before confirmation; uncertain confirmation blocks another submission across reload and requires manual reconciliation. It is not durable protocol idempotency. Partial R1 settlement-rail setup has no safe-resume guarantee.

## Requirements deviations and verification boundary

TZ §19 requires **Next.js + TypeScript**; implementation is **React + Vite**. Keep this open until implementation conforms or TZ is explicitly revised. Issuer/operator is one authority (allowed by MVP role rules); a separate issuer identity and full role-specific journeys are unfinished.

Local-validator tests execute actual Anchor/Token-2022 state transitions with a controlled signer; client tests mock wallet/RPC. Neither proves Phantom extension compatibility, Devnet deployment, remote CI success or a complete security review. See [verification and gaps](ROADMAP.md#verification-and-gaps) and [README acceptance](../README.md#manual-acceptance).

## Test evidence

Local verification on **2026-10-06**: build/SBF/IDL pass; Rust 4/4; client golden 36/36; validator 16/16; protocol browser/audit 4/4. Dependency follow-up also verified clean npm ci and npm audit with 0 vulnerabilities. Agent-browser checked both pages without runtime errors or Vite overlays. Rust count includes generated `test_id`; integration count includes its parent test, so counts are not requirement counts.

Evidence generated by `protocol:test:ui`: `target/protocol-evidence/coupon.json` (expected/actual, signatures, source/binary/IDL hashes), `coupon-ui.json`, `coupon-ui.png`, Playwright reports/traces. Ignored artifacts are local evidence, not checked-in release proof. `.github/workflows/e2e.yml` defines CI; remote execution was not checked in this audit.
