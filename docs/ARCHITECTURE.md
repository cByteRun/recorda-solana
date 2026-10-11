# Architecture

Authority: [TZ](TZ.md) + [REQUIREMENTS](REQUIREMENTS.md). Delivery: [ROADMAP](ROADMAP.md). Evidence: [verification and gaps](ROADMAP.md#verification-and-gaps).

## Runtime and trust

```text
React page → controller → generated Anchor client → signed transaction
→ Recorda program → Token-2022 CPI → PDA/token state
→ RPC reads → independent audit → holder rights / receipt / history
```

There is no application backend/database. Coupon Core at `/` and `/protocol` stores finalized truth in Solana accounts. Phantom holds the operator key and signs explicitly. LocalStorage caches addresses and disposable demo-holder keys, scoped by RPC/program; losing it does not erase protocol rights. Holder keys are a test custody model.

The `/reference` Browser/Memo reference uses real Token-2022 instructions but browser-owned snapshot/entitlement/lifecycle state. Memo attests bytes; it does not enforce rights, immutability or once-only payment. Its offline oracle and mocked tests are simulation evidence.

## Stack and code map

React 19/TypeScript/Vite, Tailwind v4, local shadcn-style primitives, Lucide; Anchor 0.32.1, Solana web3.js/spl-token and Token-2022. FSD import direction: app → pages → widgets → features → entities → shared.

| Path | Responsibility |
| --- | --- |
| `programs/recorda/src/lib.rs` | Coupon instructions, authority/account constraints, math, state and events |
| `src/shared/solana/idl/` | Compiler-generated IDL and TypeScript contract |
| `src/shared/solana/protocol.ts` | PDAs, instructions, validated chain reads and history |
| `src/shared/solana/protocol-audit.ts` | Independent formula, snapshot and receipt reconciliation |
| `src/pages/protocol/`, protocol controller in `src/features/corporate-action/` | Coupon Operator/Investor/Auditor presentation, authority gating, holder rights, restore and read-only proof |
| `src/features/corporate-action/model/` | R1 controller, checked client coupon math and offline golden model |
| `src/shared/solana/transactions.ts`, `rpc-fetch.ts`, `persistence.ts` | Simulation/sign/send/confirm, bounded RPC retry and local resume references |
| `golden/`, `tests/`, `protocol-tests/`, `protocol-ui-tests/` | Independent fixtures, client checks and real-validator integration/browser checks |
| `scripts/`, `.github/workflows/` | IDL/build/validator orchestration, PR CI and merged-PR deployment |
| `prototype/` | Historical HTML reference |

Dependency overrides keep the Solana/Anchor versions pinned while using jayson 5 and toml 5. `vendor/bigint-buffer/` provides the four unsigned conversion functions in JS, avoiding the vulnerable native binding; `tests/coupon-precision.spec.ts` verifies exact endian bytes and limits in CJS/ESM.

## Coupon accounts and lifecycle

A PDA is a deterministic address derived from the program ID and seeds. For example, `entitlement + action address + holder address` identifies exactly one holder's right for one action; changing the action gives a different right. A PDA has no private key. The deployed Rust program validates the account and controls permitted changes; it can authorize token CPI using its PDA seeds. This connects record-date ownership to payment and a durable receipt, reducing manual reconciliation. Merely computing the address in React creates no on-chain account or enforcement; a successful program instruction does.

Airdrop supplies disposable Devnet SOL for transaction fees/account rent. It does not determine entitlement or fund mock USD coupons. `scripts/devnet-golden.mjs` drives existing `/protocol` controls through a real human-signed Phantom browser and checks the required fixture through independent RPC. Client regression, local-validator execution and human Devnet acceptance are separate evidence layers; see [README](../README.md#phase-1-golden-on-devnet--real-phantom).

The Devnet runner does not request an airdrop; it uses the Operator's existing Devnet SOL. Its live browser/network flow is not yet accepted. Official Devnet RPC had no account at either this checkout's declared program ID or its deployment keypair public address during the 2026-10-06 follow-up; deployment IDs must be synchronized before upload.

Later on 2026-10-06, after the user's upload, CLI `program show` confirms program `CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF`, deployment slot 508134659 and 542,864 bytes of data. Rust/Anchor/IDL are synchronized to that ID. Existence is verified; full human golden acceptance and on-chain/local binary hash comparison are separate pending checks. The runner's busy/stage/resume regressions now pass as part of client golden 40/40; these controlled DOM tests are not Devnet evidence.

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
- Legacy reads keep their bounded signature list; the v2 history/export adds stable action and native signature cursors with pruning disclosure. Typed Redemption/Voting execute through new accounts; see implementation/action-engine-v2.md.

## R1 recovery and RPC

The shared adapter simulates before signing, validates connected account before signing/broadcast, compares the returned message with immutable simulated intent, preserves partial holder signatures and adds Memo compute budget. Instructions and wire bytes are copied to isolate provider mutations across awaits/retries. Snapshot reads fail on bad accounts/RPC errors. Unknown balances display `—`; allocation/settlement fail closed. The locally derived payment signature is saved before sending to RPC; uncertain broadcast/confirmation blocks another reference submission across reload and requires manual reconciliation. It is not durable protocol idempotency. Partial R1 settlement-rail setup has no safe-resume guarantee. Reference snapshot commitment/identity checks reject inconsistent caches but do not authenticate a wholly rewritten cache against historical Memo transactions.

## Requirements deviations and verification boundary

TZ §19 is addressed by the production Next App Router shell in next-app, using the same FSD React screens as Vite development. V2 copies issuer/terms identity into immutable contracts; governed instruments separate four role sets and threshold intents. See implementation/operations-v2.md for trust, recovery and new-account migration.

Local-validator tests execute actual Anchor/Token-2022 state transitions with a controlled signer; client tests mock wallet/RPC. Neither proves Phantom extension compatibility, Devnet deployment, remote CI success or a complete security review. See [verification and gaps](ROADMAP.md#verification-and-gaps) and [README acceptance](../README.md#manual-acceptance).

## Test evidence

The 2026-10-10 [adversarial audit](SECURITY-AUDIT.md) adds all-ID traceability, wallet/RPC/cache attacks, an enforced Coupon transition table, actual failed-runtime rollback evidence and snapshot/calculation/payment browser reload recovery. [Machine-readable mapping](audit-coverage.json) maps the complete FR-01–58 source scope and explicit external acceptance gates. `test:audit` records exit codes and stable source/test/IDL/binary hashes; final results are in CHANGELOG. Earlier counts below are historical, not a claim about the current revision.

Coupon UX/role follow-up (2026-10-06): build and IDL check pass; Rust 4/4, golden/client/runner 45/45, validator 16/16, protocol browser/audit/usability 6/6 and Devnet setup 6/6. The browser lifecycle checks role switching on one action, connected/unknown investors, unauthorized approval, exact golden rights, wallet-free reopening, partial-payment recovery and corrupted proof. Usability checks cover form gating, keyboard focus and no page-wide overflow at 320/390 px. Mobile screenshots are retained as `target/protocol-evidence/coupon-mobile.png` and `coupon-entry-mobile.png`; counts below describe earlier runs.

Local verification on **2026-10-06**: build/SBF/IDL pass; Rust 4/4; client golden 36/36; validator 16/16; protocol browser/audit 4/4. Dependency follow-up also verified clean npm ci and npm audit with 0 vulnerabilities. Agent-browser checked both pages without runtime errors or Vite overlays. Rust count includes generated `test_id`; integration count includes its parent test, so counts are not requirement counts.

Evidence generated by `protocol:test:ui`: `target/protocol-evidence/coupon.json` (expected/actual, signatures, source/binary/IDL hashes), `coupon-ui.json`, `coupon-ui.png`, Playwright reports/traces. Ignored artifacts are local evidence, not checked-in release proof. `.github/workflows/e2e.yml` defines CI; remote execution was not checked in this audit.

Follow-up on 2026-10-06 rechecked saved local evidence against current Rust source, IDL and SBF binary: all three hashes match. Required TZ scenario totals 85,000 minor units with four processed holders; historical regression totals 175,000 with three. This validates the saved evidence's correspondence to these files; it is not a fresh validator run or Devnet proof. Recent client golden replay passed 36/36; the optional faucet guard tests passed 3/3, but the live funding request returned `Internal error`.

Human Phantom-signed Coupon golden passed on 2026-10-06: action `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx`, receipt `8gYnbCDU6buFyL7mKyxi5szCuivvEuP6DDp1FCJMMjbR`, snapshot 10/5/2/0, current units 6/9/2/0, payment deltas 500/250/100/0, total 850. Public evidence: `target/devnet-evidence/coupon.json` and `coupon.png` (local ignored artifacts). This supersedes earlier pending Coupon acceptance notes; negative cases remain covered by local suites, and on-chain/local binary comparison remains separate.

## Reference assessment and adaptation

The gap table below records the 2026-10-06 pre-implementation review. Current v2 delivery supersedes its missing-feature entries; see ROADMAP and implementation/operations-v2.md. No upstream engine files were copied.

Review date: **2026-10-06**. Local source inspected: `programs/recorda/src/lib.rs`, shared Solana client/auditor and protocol acceptance structure. Upstream primary repository pages/README/specification were checked for the capabilities below. Upstream tests, deployed contracts, security audits and complete source were **not independently executed or audited**. Some direct raw-file requests were unavailable; exact implementation imports remain an explicit roadmap gate. Stars and Reddit discussion are not acceptance evidence. Centrifuge/AFRX lack a specific component/source in the supplied research and are not selected implementation dependencies.

### Sources and reuse decisions

| Reference | Verified documented scope / locations to inspect | Recorda adaptation / boundary |
| --- | --- | --- |
| [Hashgraph ATS](https://github.com/hashgraph/asset-tokenization-studio) | Hedera securities toolkit and mass payouts; `packages/ats/{contracts,sdk}`, `packages/mass-payout/{contracts,sdk}`, `apps/mass-payout`, `docs/ats`, `docs/mass-payout` | Domain and payout orchestration reference for M2/P1. Preserve our Solana registry/rights/receipt; do not import Hedera runtime or mass-payout backend into the working MVP. Documented toolkit breadth is not proof of Recorda acceptance. |
| [Tokeny T-REX](https://github.com/TokenySolutions/T-REX) / [ERC-3643](https://github.com/ERC-3643/ERC-3643) | T-REX archived/deprecated, points to ERC-3643; Solidity identity/claims/compliance architecture, `contracts/`, `docs/`, `test/`. T-REX declares GPL-3.0. | Use ERC-3643 as the preferred conceptual eligibility reference for P1/P3. Map policy to HolderPosition; current boolean approval already covers MVP. No Solidity identity/proxy system or real KYC claim is implied. Check exact upstream license before incorporation into this repository's reserved-rights code. |
| [CMTA CMTAT](https://github.com/CMTA/CMTAT) | Distinct Snapshot, HolderList, Debt and DebtEngine variants described in README; `contracts/`, documentation and tests | Compare debt/snapshot/terms responsibilities for M2/P1; algorithms and fixtures require inspection before porting. Security-token variants alone do not prove a ready payout engine. |
| [CMTAT-Solana](https://github.com/CMTA/CMTAT-Solana) | Solana specification and Token-2022 deployment guide, including freeze, delegate and metadata semantics | Reference authority/metadata mapping for redemption/P1. It is not a ready Anchor corporate-action engine. Existing Recorda mint lacks a delegate; do not assume guide extensions are enabled locally. |
| [Upside OS Solana RWA](https://github.com/upsideos/upsideos-solana-rwa) | `programs/`, `clients/`, `deploy/dividends/upload-merkle-tree-to-ipfs.ts`; off-chain snapshot/tree and on-chain distributor/claims. README permits SPL/Token-2022 payout and excludes transfer-fee payout configuration; declares MIT. | P1 reference for manifest/root, proof claims and operations. Keep current on-chain rights for MVP. Existing Recorda rail accepts only plain two-decimal Token-2022, so ordinary SPL/USDC is a future compatibility change. |
| [CorpAction Engine](https://github.com/wangyangmingsss/corpaction-engine) | `packages/`, `docs/`; documented event → normalized intent → registry/executor → attestation flow on Robinhood/Arbitrum; declares MIT | Adapt typed action contracts/dispatch in M2 and external event provenance in P3. Do not port EVM oracle/executor/timelock runtime wholesale; no production-maturity claim from its README. |
| [CorpShift](https://github.com/tang-vu/corpshift) | `packages/core`: canonical schema/hashing; `packages/contracts`: registry/policies/attestation; `apps/indexer`: normalization/reconciliation | M2 typed parameters/receipts and P3 source deduplication/provenance reference. EIP-712 signatures and stock exposure multipliers are not Solana bond execution logic. Documented test counts were not rerun. |
| [Fractional Bond Trading](https://github.com/whanyu1212/fractional-bond-trading) | README documents TokenizedBond coupon/redemption methods and BondMarketPlace batch methods, burn/payment flow; explicitly a proof of concept | M2.1 reference for principal/final coupon and atomic retirement; inspect contracts/tests at a pinned commit before adopting formulas. Do not copy marketplace/oracles or replace record-date rights with current balances. |

### Local gap map

| Concept from research | Actual local evidence | Decision / missing work |
| --- | --- | --- |
| Holder registry, permissioned transfers | `register_holder`, `set_holder_approved`, `transfer_bonds`; thaw/transfer/freeze with approved positions | Already delivered. Not a Transfer Hook implementation; no real KYC, jurisdiction/expiry policy or separated admin roles. FR-53–54 → P1/P3. |
| Record date and entitlement | `create_coupon`, `begin_snapshot`, `snapshot_holder`, `finalize_snapshot`, `calculate_entitlement` | Already delivered with per-holder accounts, supply completeness and ordered SHA-256 commitment. Commitment is not a Merkle root. Retain for MVP; FR-49–51 → P1. |
| Mass payout/idempotency/recovery | `approve_action`, `mark_funded`, `settle_holder`; per-holder paid state; controller resumes | Coupon delivered. No self-service Merkle claim/deadline/reclaimer. Sequential per-holder calls provide resumable processing; no single unbounded batch transaction. |
| Generic action registry/state machine | `CorporateAction`, `Stage`, `transition`, events | Coupon lifecycle exists, but no kind/version/date-specific payload. `transition` records changes; callers enforce guards. FR-43–44 and typed receipt → M2.0/M2.3. |
| Bond redemption | `principal_minor`, `final_coupon_minor`, instrument supply/redeemed fields | Preparatory data only: no redeem/burn instruction, permanent delegate or persistent redemption restriction. FR-45–46 → M2.1. |
| Additional corporate action | `voting_power` field | No Proposal/VoteReceipt/tally implementation. FR-47 → M2.2. Voting remains selected MVP action; partial redemption UC-PR-01 → P2. |
| Audit and attestation | `ActionReceipt`, transition events, `protocol-audit.ts` | Coupon public verification exists. No typed burn/tally receipt, external event/evidence schema, source attester or complete archival history. FR-48 → M2/M3; FR-57–58 → P3/P1. |
| Full-stack platform/API | Existing React/Vite + Anchor client, no application backend | Reuse existing FSD. Backend/indexer justified for P1/P3, not required merely because another repo has one. Next.js mismatch stays tracked. |

### Implementation contract for the remaining MVP

Extend the current Anchor program and FSD client; do not fork an entire reference platform. Candidate program modules are instrument/registry, action/state, snapshot/rights, coupon, redemption, voting and receipts; extract them when implementing shared dispatch while preserving constraints. Candidate client changes belong in `src/shared/solana/`, `src/features/corporate-action/` and `src/pages/protocol/`; fixtures and E2E stay in existing test directories.

Action payload must bind kind, schema version, instrument, action ID, record timestamp, execution/window dates and action parameters. Store an immutable parameter hash and type/version in the final receipt. Coupon/Redemption follow approved/funded execution; Voting follows approved/open/closed/tallied completion without fake payout states. A common envelope does not require identical state transitions. No automated feed can approve a monetary operation.

The existing `finalize_snapshot` clears instrument barriers for Coupon. Redemption must add a separate persistent restriction. Bond accounts are holder-owned and frozen; Instrument PDA has mint/freeze/close authority, **not holder burn authority**. M2.1 therefore uses holder-signed atomic burn/payment rather than silently adding a Permanent Delegate. A delegate alternative needs mint-extension compatibility/migration and explicit authority tests.

Account layout additions can break deployed decoding and change receipt hashes. Choose a new versioned layout/address or a tested migration and maintain historical Coupon reads. Regenerate IDL/types, extend the independent auditor, retain golden regression, then add action-specific validator/browser fixtures. Source inspection alone does not mark any new checkbox complete.

For P1, canonical leaves must bind schema version, program/network domain, instrument/action, mint, index, holder, destination and integer amount; define exact encoding/hash/tree ordering before implementation. Persist record-slot ownership/eligibility inputs and totals with the manifest. Approval establishes trust in a reconciled commitment; proof verification alone establishes only membership. Measure account/compute/proof costs and data availability before choosing the production scale envelope.
