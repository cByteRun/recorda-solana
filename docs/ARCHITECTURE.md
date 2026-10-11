# Architecture

Authority: [TZ](TZ.md) and [REQUIREMENTS](REQUIREMENTS.md). Implemented feature mapping: [ROADMAP](ROADMAP.md) and [FR checklist](implementation/fr-checklist.md). This document describes the current source architecture; historical delivery/test results belong in [CHANGELOG](CHANGELOG.md).

## Runtime and trust

```text
Shared React screens (Vite / Next App Router)
  → corporate-action controller → typed Anchor instruction
  → Phantom signature → Solana RPC → deployed Recorda Rust program
  → Token-2022 CPI + program accounts
  → validated chain reads → independent audit → rights / receipt / export
```

The product's central axis is **Instrument → Holder → Record-date Right → Authorized Action → Receipt**. `/protocol` provides instrument/registry setup and legacy Coupon; `/actions` serves typed Coupon, Voting, Full/Partial Redemption; `/claims` verifies prepared distributions and allows holder-signed claims. Operator/Investor/Auditor selection changes presentation, not authority.

There is no application API server or database in this repository. The primary business state is in Solana program/token accounts. Off-chain archive replay, manifest retention and event normalization are CLI/library capabilities; they are not an already hosted production indexer or integration service. Deployment/storage responsibilities are described in [operations](implementation/operations-v2.md).

Phantom keeps the real Operator/investor keys. The full Devnet demo uses three real holder accounts; legacy setup also supports disposable browser-local demo holders. Browser storage caches references/demo identities, not authoritative v2 rights. An Action PDA restores business state after storage loss. RPC/archive providers remain trust boundaries; consistent fabricated data is not independently proven authentic by client hashes.

`/reference` is a separately labelled Browser/Memo reference. Its snapshot/calculation/lifecycle are browser-owned; Memo attests bytes without enforcing corporate-action rights or once-only payments. It is not the primary acceptance path.

## Stack and code map

The current stack is React 19 + TypeScript, Vite development, a Next App Router production shell, Tailwind v4, local UI primitives and Lucide; Rust/Anchor, Solana web3.js/SPL Token and Token-2022 provide chain execution. Exact versions/integrities are in `package-lock.json` and `Cargo.lock`; [operations](implementation/operations-v2.md#measured-envelope-and-code-provenance) documents provenance. The React code uses FSD layers where present; the repository does not require every conceptual layer to have a directory.

| Path | Responsibility |
|---|---|
| `programs/recorda/src/lib.rs` | Entrypoints, legacy Coupon, instrument/registry and controlled transfers |
| `programs/recorda/src/engine.rs` | Typed actions, immutable contracts, snapshots, rights, retirement, voting and receipts |
| `programs/recorda/src/governance.rs` | Threshold role intents, eligibility and approved terms changes |
| `programs/recorda/src/distributor.rs`, `external.rs` | Merkle claims/reclaim and source-event binding |
| `src/shared/solana/idl/` | Compiler-generated JSON/TypeScript ABI |
| `src/shared/solana/protocol.ts`, `protocol-audit.ts` | Legacy client and independent Coupon reconciliation |
| `src/shared/solana/actions-v2.ts`, `governance.ts`, `distribution.ts`, `audit-history.ts` | Typed clients, canonical account reads, hash/formula/proof verification and export |
| `src/features/corporate-action/model/`, `src/pages/` | Controllers, setup/action/claim screens and reference UI |
| `src/shared/solana/transactions.ts`, `rpc-fetch.ts`, `persistence.ts` | Simulation, message/signature integrity, bounded read retries and cached references |
| `next-app/`, `next-ui-tests/` | Client-loaded shared React screens and production runtime checks |
| `scripts/lib/`, `public/distributions/` | Authenticated archive replay, durable manifests/proofs and external proposals |
| `scripts/devnet-actions.mjs`, `security-audit.mjs` | Human Devnet MVP demonstration and feature/attack audit orchestration |

`vendor/bigint-buffer/` supplies unsigned JS conversions without the native binding. Dependency overrides and lockfiles are implementation details, not evidence of a current vulnerability scan.

## Accounts and lifecycle

A PDA is a deterministic address derived from program ID and seeds, without a private key. The program validates ownership/seeds and signs permitted CPI through those seeds. Computing a PDA in the client does not create or authorize its state.

| Accounts | Stored responsibility |
|---|---|
| Instrument / HolderPosition | Base issuance terms, mint/payment mint, registered custody, supply and lifecycle barriers |
| Legacy CorporateAction / EntitlementPosition / ActionReceipt | Historical Coupon lifecycle, fixed rights and receipt decoding |
| ActionV2 / RightV2 / VoteV2 / ReceiptV2 | Copied contract/parameters, per-holder rights, unique votes and typed outcomes |
| PeriodV2 | Instrument/coupon-period reservation and permanent consumed status |
| Governance and intent/policy accounts | Four role sets, exact instruction approval, eligibility and versioned current terms |
| Distributor and claim accounts | Approved root, funding/deadline/accounting and per-index replay protection |
| External binding accounts | Unique source/event provenance bound to an action |
| Token-2022 accounts | Bond custody, payment vaults and holder destinations |

New actions use separate versioned seeds/layouts; legacy Coupon decoders remain supported. Signatures/history are fetched from RPC, not embedded wholesale in receipts. Historical periods cannot be inferred from legacy Coupon; migration must explicitly reconcile those payments.

Coupon and retirement follow schedule → snapshot → calculate → approve → fund → per-holder execution → receipt. Voting follows schedule → snapshot → calculate → approve → votes → tally → receipt, with no payment vault. `executing` plus processed rights represents partial settlement. Runtime failures roll back instead of creating a persistent generic FAILED state. Cancellation is Scheduled-only; an incomplete started snapshot must be resumed, not aborted.

For a payable v2 coupon, the Operator explicitly reserves the period while Scheduled, before approval. Final settlement consumes it permanently. Full redemption additionally requires maturity at creation, snapshot and execution. [The v2 contract](implementation/action-engine-v2.md) defines commitments, overlap rules and compatibility.

## Correctness and restrictions

- Bond custody is frozen outside authorized atomic thaw/transfer/freeze or thaw/burn/payment operations. Transfers require holder authorization and eligible registered endpoints; governed instruments add versioned policy checks.
- Record-date barriers prevent late snapshots from silently capturing post-record transfers. Capture checks eligible registry/supply completeness. Snapshot rights remain immutable after later transfers.
- An active v2 action reserves the instrument through terminal completion. Coupon/Voting release transfer restrictions after capture; retirement keeps them through settlement. Issuance seals at the first snapshot.
- Financial calculations use checked integers, floor once per holder and sum rounded allocations. Payment rails accept supported plain two-decimal Token-2022 mints; ordinary SPL/USDC or transfer-fee tokens are not implicitly supported.
- Coupon payments require approval/funding. Retirement requires each nonzero holder's signature, with burn/payment/counters atomic; zero allocations permit Operator completion. Replays and substituted action/right accounts fail closed.
- Votes use fixed snapshot power, unique holder receipts, `[opens, closes)`, abstention-inclusive quorum and strict YES > NO. Voting approval/results do not themselves modify terms.
- Governance executes only committed allowlisted instructions after the configured role threshold. External events create/bind proposals without granting execution authority.
- Distributor claims require a domain-bound proof, holder signature and bound destination before the deadline. Reclaim is authority-controlled after expiry. A Merkle proof establishes membership, not independent truth of historical ownership.

## Recovery and RPC

The shared transaction adapter sets compute limit and priority price before simulation/signing, checks the active wallet across awaits, normalizes wallet-returned wire data and compares it with the captured message. Existing partial signatures must remain unchanged. It captures signed bytes and the signature before sending and does not automatically resubmit after an uncertain broadcast.

Typed clients validate program ownership, canonical PDAs, token custody, mint/supply and rights. Independent audits recompute copied contract/snapshot/receipt commitments, formulas and outcomes. Current destination balances are not treated as proof of historical payment amounts. History/export uses stable cursors and discloses pruned transaction bodies.

The `/reference` cache does not gain protocol-level idempotency from these guards. Real actions recover from chain; uncertain confirmations still require signature/balance reconciliation. The full human Devnet runner creates fresh instruments and has no automatic resume.

Vite and Devnet scripts load root `.env.local`; Node scripts fall back to `.env` and preserve shell overrides. Next uses `next-app` as project directory and requires its own environment file or explicit public build-time values. Neither runtime receives private keys through public environment settings.

## Verification boundary and test evidence

Two supported entrypoints are documented in [README](../README.md#feature-and-attack-audit):

- `test:e2e:actions:devnet`: real human Phantom Coupon → Voting → Full Redemption; per-run `target/devnet-evidence/actions-<id>/run.json`, screenshots and signatures.
- `test:audit`: requirement mapping plus MVP/Post-MVP feature/attack suites, Rust, actual local Token-2022 execution, browser recovery and Next runtime; source hashes/exit codes in `target/security-audit/run.json`.

Historical results are recorded in [CHANGELOG](CHANGELOG.md). Any source change requires fresh matching evidence before claiming current acceptance. Local disposable signers do not prove human Phantom compatibility, remote CI or production readiness. The user reported a Devnet upload; a successful full human run and independent deployed-binary verification remain distinct evidence gates. See [security audit](SECURITY-AUDIT.md) and [roadmap](ROADMAP.md#verification-and-gaps).

## Reference assessment and adaptation

The 2026-10-06 upstream review informed the requirement extension. Hashgraph ATS/mass payouts, ERC-3643/T-REX, CMTA CMTAT/CMTAT-Solana, Upside OS, CorpAction, CorpShift and Fractional Bond Trading were conceptual references, not frameworks installed or copied into Recorda. Their documented scope is not Recorda acceptance evidence.

No external engine source files were incorporated. The earlier missing-feature/reuse plan has been superseded by the implemented typed action, governance, distributor and external-binding modules above. Runtime dependencies/licenses, archive trust and supported measurement envelope are maintained once in [operations](implementation/operations-v2.md); current feature delivery is maintained in [ROADMAP](ROADMAP.md). Future source reuse requires a pinned component and license review.
