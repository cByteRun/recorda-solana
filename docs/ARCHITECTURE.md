# Architecture

Current source architecture. [TZ](TZ.md) and [REQUIREMENTS](REQUIREMENTS.md) define scope; [ROADMAP](ROADMAP.md) owns delivery status; [SECURITY-AUDIT](SECURITY-AUDIT.md) owns attack coverage and evidence. Installation and deployment: [README](../README.md).

## Frameworks and runtime

```text
React screens → typed Anchor client → Phantom signature → Solana RPC
  → Recorda Rust program → Token-2022 CPI / program accounts
  → validated chain reads → independent audit / receipt / export
```

| Layer | Frameworks / libraries | Purpose |
|---|---|---|
| Interface | React 19, TypeScript, Tailwind CSS 4, Lucide, local UI primitives | Shared Operator / Investor / Auditor screens |
| Development | Vite 8 | Local browser app |
| Production shell | Next 16 App Router | Loads the same browser screens client-side; separate `next-app` directory avoids a route conflict with FSD `src/pages` |
| Chain client | Anchor JS 0.32.1, web3.js 1.99.0, SPL Token 0.4.15 | Typed instructions, account reads and Token-2022 operations |
| On-chain execution | Rust, Anchor 0.32.1, Solana / Token-2022 | Authority, lifecycle, rights and atomic settlement |
| Verification | Playwright, Node test runner, Rust tests, local validator | Feature, attack, browser and native program coverage |

There is no application API server or database. Business state lives in Solana accounts; indexing, proof generation and event normalization are CLI/library capabilities. Vite and Devnet scripts read root `.env.local` (Node falls back to `.env`, preserving shell overrides). Next requires `next-app/.env.local` or explicit public build-time values. Public configuration contains no private keys.

Dependency versions/integrity are pinned in `package-lock.json` and `Cargo.lock`. Anchor JS uses MIT OR Apache-2.0; web3.js, React and Next use MIT; SPL Token and Playwright use Apache-2.0. Preserve dependency license/notice files. `vendor/bigint-buffer` supplies unsigned JS conversions without a native binding; overrides do not establish a clean vulnerability scan.

## Project structure

This is the single project map; requirements and test-to-feature paths live in [audit-coverage.json](audit-coverage.json).

| Path | Responsibility |
|---|---|
| `src/app/`, `src/pages/`, `src/features/`, `src/shared/` | React/FSD composition, screens, corporate-action controllers and shared UI; layers are used where present |
| `src/shared/solana/` | Legacy and v2 clients, governance/distribution, independent audit/export, transaction integrity, RPC recovery and cached references |
| `src/shared/solana/idl/` | Compiler-generated JSON/TypeScript ABI |
| `programs/recorda/src/` | `lib.rs`: entrypoints/registry/legacy Coupon; `engine.rs`: typed actions/rights/votes/receipts; `governance.rs`: roles/eligibility/terms; `distributor.rs`: claims/reclaim; `external.rs`: source binding |
| `next-app/` | Production shell reusing the React screens |
| `scripts/`, `scripts/lib/` | Build/IDL, Devnet demonstration, audit orchestration, authenticated archive replay, proposals and measurements |
| `tests/`, `protocol-tests/`, `protocol-ui-tests/`, `next-ui-tests/` | Client, native-validator, browser and production-shell checks |
| `golden/`, `public/distributions/` | Business fixtures and public retained manifests/proofs; generated distribution archives are ignored by Git |
| `docs/`, `vendor/` | Specification/design/delivery/evidence documents and explicitly vendored dependency |
| `target/` | Generated binaries, IDL/build artifacts, audit/Devnet evidence and benchmarks |

## Key decisions

The central model is **Instrument → Holder → Record-date Right → Authorized Action → Receipt**. Screen routes and user workflows are described once in [README](../README.md#product-screens-and-manual-acceptance).

### Accounts and lifecycle

PDAs are deterministic program addresses without private keys. The program validates ownership/seeds and signs permitted CPI; calculating an address does not create or authorize state.

| Account group | Responsibility |
|---|---|
| Instrument / HolderPosition | Issuance terms, registered custody, supply and lifecycle barriers |
| ActionV2 / RightV2 / VoteV2 / ReceiptV2 | Copied contract, immutable per-holder rights, unique votes and typed outcomes |
| PeriodV2 | Coupon-period reservation and permanent consumption |
| Governance / intent / policy | Four role sets, exact instruction approvals, eligibility and versioned current terms |
| Distributor / claim / external binding | Approved root, claim accounting/replay prevention and unique event provenance |
| Token-2022 accounts | Bond custody, payment vaults and holder destinations |
| Legacy CorporateAction / EntitlementPosition / ActionReceipt | Compatible historical Coupon layout and decoding |

Coupon/retirement: schedule → snapshot → calculate → approve → fund → per-holder execution → receipt. Voting: schedule → snapshot → calculate → approve → votes → tally → receipt; no payment vault. `executing` with processed rights represents partial settlement. Failed transactions roll back. Cancellation is Scheduled-only; a started snapshot must resume.

Coupon periods are explicitly reserved while Scheduled and permanently consumed at settlement. After Scheduled cancellation, a separate authorized release closes an unconsumed period PDA. Full redemption checks maturity at creation, snapshot and execution. New versioned seeds preserve legacy decoding; historical coupon periods require explicit reconciliation rather than inference or automatic migration.

### Custody, rights and settlement

- Frozen bond custody permits only authorized atomic thaw/transfer/freeze or burn/payment. Transfers require a holder signature and eligible registered endpoints.
- Record-date barriers and complete registry/supply checks fix rights independently of later transfers. Issuance seals at the first snapshot. An active v2 action reserves the instrument; legacy scheduling respects that lock. Coupon/Voting release transfer restrictions after capture; retirement retains them through settlement.
- Checked integer calculations floor once per holder, then sum allocations. Payment rails support plain two-decimal Token-2022 mints; ordinary SPL/USDC and transfer-fee tokens require separate support.
- Coupon requires approval/funding. Retirement requires each nonzero holder's signature and atomic burn/payment/counters; Operator may complete zero allocations. Replay/substituted accounts fail closed.
- Voting uses fixed power, one vote per holder, `[opens, closes)`, abstention-inclusive quorum and strict YES > NO. Voting never automatically changes terms.

### Authority and recovery

Frontend role selection changes presentation, not authority. Phantom holds real keys; browser storage caches references/demo identities. Action PDAs restore state after storage loss. The adapter fixes compute/priority instructions before simulation/signing, checks wallet identity across awaits, normalizes returned wire data and verifies unchanged message/partial signatures. Signed bytes/signature are captured before broadcast. RPC forwarding retries reuse identical signed bytes; confirmation errors trigger exact-signature history reconciliation. Uncertain submissions never automatically rebuild/re-sign a payment. Near-expired signatures are rebuilt only before broadcast.

Clients validate canonical PDAs, ownership, custody and supply. Independent audits recompute commitments, formulas and outcomes. Current balances alone do not prove historical payments. RPC/archive responses remain trust boundaries; client hashes do not authenticate fabricated provider data. History uses stable address/signature cursors and reports pruned transaction bodies. Closed/reassigned destinations require retained historical evidence.

`/reference` is a separately labelled browser/Memo calculation reference: Memo attests bytes without enforcing rights or once-only settlement. The human Devnet runner creates fresh instruments by default; explicit `--resume` is restricted to a reconciled pre-payment Coupon with zero processed/paid rights and no vault. It never automatically retries payments. Demonstration and full feature/attack verification are separate [README paths](../README.md#feature-and-attack-audit).

### Operations and supported scope

Post-MVP extends the controlled snapshot engine with committed distributions, threshold roles, eligibility/terms and external proposals (FR-49–58). These are implemented local/program capabilities; hosted provider availability and production capacity require separate evidence.

**Archive and proofs.** `scripts/lib/distribution.mjs` replays a complete, ordered, finalized journal from genesis to record slot; rejects gaps/duplicates/post-record data, unavailable banks, supply/registry mismatch and excluded nonzero holdings. A separately pinned provider key verifies Ed25519 attestation of the canonical payload hash. This authenticates the provider assertion, not independent Solana consensus.

```bash
npm run distribution:index -- journal.json parameters.json public/distributions
```

Parameters contain `archiveProvider`, `distribution`, `paymentMint`, `face`, `rateBps`, `frequency`, `policyVersion`, holder-bound `destinations`. Journal fields: `version`, `source`, `instrument`, `mint`, `finality`, `completeFromGenesis`, ordered `events`, finalized `bank`, `attestation {provider,hash,signature}`. Hash excludes attestation; base64 Ed25519 signature covers its 32 bytes. Provider keys stay outside the browser/repository. Schema examples/checks: `scripts/post-mvp.test.mjs`.

Content-addressed manifests and individual leaf/proof files are served from shared `public/distributions`; deployment must explicitly copy generated archives. `/claims` verifies hash/domain/formula/order/proof/obligation against the approved distributor, then requests the bound holder signature. Claims require funding and Clock strictly before deadline; authorized reclaim at/after deadline accounts for donations/dust and closes the empty vault. Partial claims are never full payment.

**Retention.** Keep manifests/proofs through the claim window and ≥365 days after expiry, alongside journal/attestation/configuration, in two independent copies. Verify content-hash recovery and independent public holder access before approval. Local targets: RPO zero after successful writes, RTO process restart plus retrieval; no hosted SLA. Missing archives block verification rather than substituting current balances.

**Governance and eligibility.** Four independent roles (administration, registry, approval, funding) have ≤5 owners each and configurable thresholds. Configure before sealing, without active action/pending record barrier. Program-owned intents bind exact instruction/account metas, expiry, approvals and replay flag; a System-owned PDA pays CPI rent. Intents recover from chain; only allowlisted Recorda CPI executes, excluding arbitrary instructions and legacy unversioned Coupon creation. Transfers require canonical eligibility, approval/expiry/freeze/group/jurisdiction checks; snapshot capture uses record-time policy. Active actions block policy changes. KYC documents/PII remain off-chain.

**Terms and migration.** Approved administration intents update version/URI/hash/financial terms copied into new actions. Historical rights/receipts and legacy terms stay immutable. Sealed historical instruments cannot acquire governed configuration; use new issuance or an explicit attested period/authority migration strategy.

**External proposals.** Durable `(source,eventId)` deduplication returns identical retries and rejects conflicting payload/evidence. Canonical Borsh hashes bind one Operator-authorized source/event/evidence commitment to a Scheduled action. Feeds cannot approve or execute; authenticity of referenced evidence still requires source review.

**Measurement envelope.** Offline distribution benchmarks cover 1–10,000 holders; native acceptance covers up to four registered holders per instrument. Neither establishes production throughput. `scripts/measure-protocol.mjs` records scoped evidence transactions, compute/fees and live program-account rent in `target/benchmarks/protocol.json`; unrecorded helper/setup calls are excluded. Larger batches/intent limits require measurement before support. Dated results belong in [CHANGELOG](CHANGELOG.md).

### Reference assessment and adaptation

The 2026-10-06 review used Hashgraph ATS/mass payouts, ERC-3643/T-REX, CMTA CMTAT/CMTAT-Solana, Upside OS, CorpAction, CorpShift and Fractional Bond Trading as conceptual references. They are not installed frameworks or incorporated engine code, and their results are not Recorda evidence. Future source reuse requires a pinned component/license review. Current delivery and remaining acceptance are maintained in [ROADMAP](ROADMAP.md).
