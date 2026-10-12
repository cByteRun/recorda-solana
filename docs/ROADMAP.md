# Roadmap

### Workspace separation

- [x] Explicit Welcome → Demo / Test / Devnet selection, fixed RPC binding, scoped caches and environment labels.
- [x] Public read-only Demo fixture; existing SQLite demo editing remains local.
- [ ] Optional local sandbox controls (fund/reset/scenario replay) in the product UI; existing CLI and isolated harness remain available.
- [ ] Separately deploy/upgrade the Rust program in public Devnet and verify with the chosen wallet. Local execution does not satisfy this deployment item.



Source scope **FR-01–58 is implemented**. The current focus is fresh feature/attack evidence, human Phantom three-action Devnet acceptance and release. [TZ](TZ.md) defines the product; [REQUIREMENTS](REQUIREMENTS.md) owns UC/FR/NFR/TC wording and checklists; this file owns delivery and open work.

## BondOps operational product evolution

[PRODUCT](PRODUCT.md) defines the recurring operator job; BO-01–07 in [REQUIREMENTS](REQUIREMENTS.md) specify this increment. Source delivery and live acceptance are separate. [Operational contract and setup](BONDOPS-OPERATIONS.md).

- [x] Define authoritative finality, integer/asset reconciliation, uncertainty and proof-gated case closure.
- [x] Build Expected / Confirmed / Unsettled / Unknown views with holder drill-down, retained references and permitted recovery links.
- [x] Add portfolio discovery, coupon deadline calendar, overdue queue, assignment, retained resolution history, team scope enforcement and in-app reminders/escalations.
- [x] Add action next-step filters, separate Voting/Redemption control, expandable base instrument terms and outstanding/retired supply, and uncertainty-first reconciliation links. [Dashboard contract](ONCHAIN-DASHBOARD.md) and [asset-tokenization coverage](ASSET-TOKENIZATION-RESEARCH.md); 2026-10-12 local UI verification: 19 browser tests and production build passed, without closing live Devnet acceptance.
- [ ] Accept the complete live operator flow with a configured Devnet wallet/portfolio and a reliable RPC; public RPC discovery returned 429 on 2026-10-12.
- [ ] Validate recurring servicing usage, timeliness rules and willingness to pay with issuers/paying agents/operators.
- [ ] Add bank/paying-agent confirmation after provider selection; add external email/messenger delivery and organization SSO separately.
- [ ] Validate persistent production hosting, worker scheduling, backup/retention and measured portfolio indexing capacity before production release.

## Verification and gaps

Two entrypoints: `test:e2e:actions:devnet` for human MVP demonstration and `test:audit` for requirement/feature/attack coverage. Preparation: [README](../README.md). Presentation: [DEVNET-DEMO](DEVNET-DEMO.md). Contracts/operations: [ARCHITECTURE](ARCHITECTURE.md). Attack matrix: [SECURITY-AUDIT](SECURITY-AUDIT.md). Exact requirement→evidence paths: [audit-coverage.json](audit-coverage.json).

| Requirement / feature | Implementation | Executable evidence |
| --- | --- | --- |
| FR-01–16,20–27,38–42; UC-CP-01 | Legacy Coupon plus typed Coupon, frozen controlled registry, immutable snapshot, approval/funding/payment | coupon.test.mjs, actions-v2.test.mjs, coupon.spec.ts, actions.spec.ts |
| FR-17–18,28–32,43–46; UC-BR-01 | Clock maturity, principal/separate final coupon, persistent lock, holder-signed atomic burn/payment, period deduplication | engine.rs unit tests, actions-v2.test.mjs, holder-flows.spec.ts |
| FR-19,33–37,47–48; UC-VOTE-01 | Immutable proposal/window/quorum, YES/NO/ABSTAIN, unique holder receipts, no payment vault, on-chain tally and typed audit | engine.rs unit tests, actions-v2.test.mjs, actions.spec.ts, actions-audit.spec.ts |
| FR-49–52; UC-MD-01 | Authenticated finalized archive replay, deterministic retained manifest/proofs, approved/funded claims and expiry/reclaim | post-mvp.test.mjs (offline/native), holder-flows.spec.ts, distributor.rs |
| FR-53–55 | Separate multisig roles/exact intents, eligibility, immutable copied metadata/terms and approved modification | post-mvp.test.mjs native, governance.ts, actions-audit.spec.ts |
| FR-56; UC-PR-01 | Floor allocation/atomic partial retirement, reduced supply and overlap prevention | actions-v2.test.mjs and engine.rs |
| FR-57; UC-EV-01 | Canonical durable event deduplication, evidence binding, proposal/approval boundary | post-mvp.test.mjs offline and actions-v2.test.mjs native |
| FR-58; NFR-14 | Stable account/signature cursors, loss-of-storage recovery, verified decimal export, pruning disclosure and legacy decoder | actions-audit.spec.ts, actions.spec.ts, coupon.spec.ts |
| TZ React/Next runtime | Shared FSD screens in Vite and production Next App Router | build, build:next, next-ui-tests/runtime.spec.ts |
| NFR-16–19 | Explicit pinned archive trust, proof retention/recovery, measured envelope and dependency/license inventory | ARCHITECTURE.md, post-mvp.test.mjs, benchmark:distribution, measure-protocol.mjs |

The current stable-source full audit on 2026-10-11 passed ten commands and 216 tests; `target/security-audit/run.json` records unchanged input hashes. Traceability covers 121/121 IDs, with 118 implemented and three partial NFRs: NFR-05 (RPC/history trust), NFR-10 (human replay) and NFR-12 (bounded secret scan).

Current Devnet Coupon is finalized with verified payment deltas 50000/25000/10000. Voting was reconciled to finalized with actual tally 10/0/0 through agent-assisted real Phantom; the runner remains failed after holder-B timeout. Devnet Redemption was not started because public RPC 429 blocked further execution. A separate live Chromium/real Phantom run on a Devnet-cloned local validator completed Redemption on a fresh instrument: paid 1785000, supply 17→7→2→0, all rights processed, empty vault, finalized receipt and wallet-free verified audit (`target/live-redemption-evidence/result.json`). This scoped local evidence does not close human three-action Devnet acceptance. Deployed SBF identity matches the audited local binary (`target/devnet-debug/deployment.json`). Remote CI, hosted preview and video remain open; details are in [CHANGELOG](CHANGELOG.md).

## Reference-driven delivery order

The dependency order is **instrument/registry → typed action contracts → Coupon/Redemption/Voting → role journeys/audit → acceptance**. Post-MVP extends this through committed distributions, governance/eligibility/terms, partial retirement and external proposals. Same-instrument demo order is Coupon → Voting → Full Redemption because full redemption ends its active supply.

[Reference scope and provenance](ARCHITECTURE.md#reference-assessment-and-adaptation) describes conceptual references; no external engine code was incorporated. Detailed rules live in the requirements/contracts rather than being repeated as another checklist here.

## MVP source delivery

| Milestone | Status | Delivered capability |
|---|---|---|
| M1.0 | [x] | Separately labelled Browser/Memo reference |
| M1.1 | [x] | Instrument, Token-2022 issuance, registry and controlled transfers |
| M1.2 | [x] | Record-date barrier, complete immutable snapshot and Scheduled cancellation |
| M1.3 | [x] | Integer coupon rights and aggregate obligation |
| M1.4 | [x] | Approval, funded settlement, replay prevention and atomic rollback |
| M1.5 | [x] | Receipt, chain recovery and independent Coupon audit |
| M1.6 | [x] | Coupon acceptance/attack fixtures and historical human Devnet evidence |
| M1.7 | [x] | Operator/Investor/Auditor Coupon journeys, identity and responsive UI |
| M2.0 | [x] | Versioned contracts/accounts and legacy compatibility |
| M2.1 | [x] | Clock maturity, holder-signed atomic burn/payment, separate final coupon and supply reconciliation |
| M2.2 | [x] | Fixed voting power, proposal hash/window/quorum, unique votes and tally |
| M2.3 | [x] | Shared typed engine, conflict/period isolation and action-specific receipts |
| M3.1 | [x] | Chain-backed v2 client/recovery and shared Next/Vite screens |
| M3.2 | [x] | Action-specific holder/operator/auditor journeys and verified export |
| M4.1 | [x] | Local TC-01–29 and authorization/precision/immutability/recovery coverage; live gate below remains open |
| M4.2 | [x] | Local same-instrument three-action fixture and submission documentation; release gates below remain open |

## Post-MVP source delivery

| Milestone | Status | Implemented scope / boundary |
|---|---|---|
| P1 | [x] | Signed finalized-history replay, deterministic manifest/proofs, approved claims/reclaim, threshold roles, eligibility/terms, history/export and measured envelope (FR-49–55,58) |
| P2 | [x] | Per-holder floor partial retirement and atomic settlement; 100/300/600 at 20% retires 20/60/120 and leaves 800 (FR-56) |
| P3 | [x] | Canonical source/event deduplication and provenance-bound proposals; feeds cannot execute actions (FR-57) |

These are implemented CLI/library/program capabilities, not claims of hosted indexer availability, real KYC integration or production-scale throughput. Proof retention, provider trust and supported four-holder native envelope are specified in [Architecture operations](ARCHITECTURE.md#operations-and-supported-scope).

## Remaining acceptance and release work

- [x] Run the full current feature/attack audit and retain matching source/IDL/SBF hashes.
- [ ] Complete human Phantom Coupon → Voting → Full Redemption on Devnet; retain signatures, payment deltas, receipts and zero final supply.
- [x] Independently verify deployed program identity against the intended local binary.
- [ ] Finish the live [hackathon DoD](REQUIREMENTS.md#24-definition-of-done--hackathon-mvp), including clean role journeys and no known P0/P1 issues.
- [ ] Verify remote CI and publish a current preview with configured deployment credentials.
- [ ] Record the full E2E demo video.
- [ ] Close the [track submission gates](REQUIREMENTS.md#submission-gates): main-hackathon registration confirmation, judge-accessible repository and attached technical overview with simulation disclosure.

## Future scope requiring new requirements

- [ ] Dividends, tender/buyback and other new action UCs/FRs/fixtures.
- [ ] Real KYC/AML, custody/recovery, fiat rails and depository integrations.
- [ ] External asset documentation and assurance: issuer/asset identifiers, versioned issuance terms, relevant ownership/custody or collateral evidence, reviewer/source verification and controlled off-chain document access. Existing URI/hash and event commitments do not establish legal rights or backing.
- [ ] Measure larger holder/portfolio capacity and end-to-end indexing, proof retrieval, partial execution and recovery before expanding supported scale; offline 10,000-holder benchmarks do not establish production throughput.
- [ ] Production security, provider operations, capacity and legal review.

These tasks are not silently included in the implemented FR-01–58 checklist and are not closed by the MVP demo.

Product purpose and integration boundaries: [RWA assurance and scale](PRODUCT.md#real-world-asset-assurance-and-scale). Reference applicability and current coverage: [asset-tokenization research](ASSET-TOKENIZATION-RESEARCH.md). Supported native/offline capacity and document/PII handling: [Architecture operations](ARCHITECTURE.md#operations-and-supported-scope).

## Product and presentation experience

The [product experience](PRODUCT-EXPERIENCE.md) makes the existing business behavior visible; it does not change track scope or close the human Devnet gate.

- [x] Welcome at `/` with a clear promise, Operator audience, EN/RU and Get started.
- [x] Separate background orbital motion and foreground interactive record-date story, pause and reduced-motion support.
- [x] Instrument setup → contextual Coupon → Voting → Redemption journey and direct wallet-free Auditor links.
- [x] Readable Mock USD and percentage inputs; raw units and commitments in technical disclosures.
- [x] Investor card comparing current and record-date positions, entitlement and formula; finalized-action result and onward navigation.
- [x] Desktop/mobile welcome and working-route checks. Local chain/browser checks remain scoped evidence; historical full-audit hashes above do not certify this UI revision.

## BondOps program backend and Demo Workspace (2026-10-12)

- [x] **BO-08:** Move live roles, deadlines, cases, references, append-only decisions and inbox/rules to Rust PDA accounts; wallet-signed writes and on-chain permission/proof checks. No live SQLite reads/writes and no live workspace API calls.
- [x] **BO-09:** Separate workspace and RPC selections; Devnet / local validator applied across operational screens and explorer links; keep selected source on navigation/reload.
- [x] **BO-10:** Filled SQLite Demo Workspace with TZ's 17 units / 850 Mock USD, post-cutoff transfer, approval/funding, evidence-state examples, assigned investigation, calendar and inbox; conditional bottom-left workspace card.
- [x] **BO-01–03:** Calendar, source-derived reconciliation, formula/cutoff/approval/funding/evidence panel, stable case assignment/history and proof-gated closure through the Rust program.
- [x] **BO-04–05:** Canonical per-instrument membership/revocation and sequenced immutable audit PDAs; public proof reads and provenance-labelled exports. Financial execution permissions remain in the existing action engine/governance.
- [x] **BO-06 source:** Rust rules/inbox, Clock-validated signed notice creation, deduplication and recipient acknowledgement. Demo Workspace has a separate illustrative minute worker.
- [x] Local fixture runner loads the current program, seeds real example transactions and keeps an isolated validator available for the UI.
- [ ] **BO-01–06 Devnet acceptance:** Deploy/upgrade the new SBF binary on public Devnet, then verify with actual Phantom and an available RPC. Prior public discovery hit 429; no public deployment/live PASS is claimed.
- [ ] **BO-03 recovery:** Define an authenticated on-chain failed-reference release/replacement mechanism; unresolved reference replacement currently remains conservatively blocked.
- [ ] **BO-05 archival/scale:** Retention, recovery, RPC history availability, rent/fees and portfolio-size acceptance. Public chain metadata/notes are bounded and publicly readable.
- [ ] **BO-06 automation/external delivery:** Keeper scheduling/signer operations and email/messenger delivery/retries; signed Check deadlines works now.
- [ ] **BO-07 bank connector:** Provider selection is deferred by user; authenticated callbacks, exact obligation binding and replay/conflict acceptance follow provider selection.

Current evidence is scoped to source builds, real local-validator transactions, the browser-to-program path and the illustrative Demo Workspace. Commands and limitations: [BONDOPS-OPERATIONS](BONDOPS-OPERATIONS.md#verification). Historical full-audit counts above do not certify this revision or close existing human Devnet/Phantom gates.

Local evidence: 15 Rust unit tests, 9 program checks, 8 Test API/reader checks, 14 Demo Workspace/browser checks and one browser → signed instruction → program account → RPC-loss recovery check passed; SBF/IDL, Vite and Next compilation passed. Public Devnet deployment and autonomous keeper remain unchecked.
