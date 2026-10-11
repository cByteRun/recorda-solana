# Changelog

Dated entries describe their own revisions. Historical counts, deployment addresses and pending-work notes do not establish current acceptance; current architecture is in [ARCHITECTURE](ARCHITECTURE.md), and fresh evidence gates are in [ROADMAP](ROADMAP.md).

## 2026-10-11 — Live Redemption on a Devnet-cloned local validator

- Clone the upgradeable Devnet Recorda program into an isolated local ledger; retain matching SBF SHA-256 and distinct local genesis. Exercise a fresh 10/5/2/0 instrument in the existing Chromium on CDP 9222 through ordinary UI and real Phantom accounts; no new runner scripts or injected wallet provider.
- Complete Full Redemption with a separate final coupon: principal 1700000 + coupon 85000 = paid 1785000 minor units, verified holder payment deltas 1050000/525000/210000 and supply 17→7→2→0. All four rights processed, vault empty, instrument REDEEMED and receipt finalized.
- Verify wallet-free recovery and retain the real UI audit export, screenshots, balance checkpoints and scoped PASS at `target/live-redemption-evidence/`. Local maturity was accelerated with validator warp-slot 4175; confirmations were agent-assisted. This result verifies local Redemption, not the original failed human three-action Devnet runner.

## 2026-10-11 — Devnet runner reconciliation and current audit

- Fix the initial action-read/connect race, detect delayed UI errors and lost wallet/report state, and preserve failure checkpoints. Add explicit guarded pre-payment Coupon resume; never repeat payments automatically. Exclude non-client source edits from Vite wallet-session reloads and fix stage-test timeout propagation.
- Complete stable-source `test:audit`: ten commands, 216 tests (client 101, setup 8, offline 7, Rust 15, native 25, protocol UI 55, Next 5), unchanged inputs and compiler IDL/SBF parity. Traceability: 121/121 IDs; 118 implemented/3 partial. Evidence: `target/security-audit/run.json`.
- Independently verify deployed ProgramData against local SBF: SHA-256 `938c5e670485aa16fc258830ae850990ffdd0a420586605aeee479863ad3b905`, slot 509846382; retained `target/devnet-debug/deployment.json`.
- Resume the original instrument and fully verify Coupon payment deltas 50000/25000/10000 minor units and finalized receipt. The three-action runner subsequently times out waiting for holder B. Reconcile Voting through real Phantom UI: finalized, actual votes 10/0/0; agent-assisted finalization is disclosed separately. Original failed evidence is preserved under `target/devnet-evidence/actions-1791721749406/`, with `reconciliation.json`.
- Public Devnet RPC 429 prevents further execution, including getGenesisHash. Full Redemption and successful human three-action runner evidence remain pending; this revision does not claim full live acceptance.

## 2026-10-11 — Condensed track-first specification

- Reduce TZ to track obligations, mandatory scenarios, core business rules, acceptance/submission and an explicit table of existing Recorda extensions. Remove repeated positioning, impact claims, presentation script, screen inventories and account layouts.
- Keep referenced section numbers/anchors and normative UC/FR/NFR/TC IDs. Make the supplied KASE brief authoritative for track obligations; retain detailed project acceptance in REQUIREMENTS and technical decisions in ARCHITECTURE.

## 2026-10-11 — KASE brief documentation coverage review

- Treat the supplied track brief as the external baseline above project TZ; map all mandatory scenarios, minimum prototype items, example, eligibility, submission artifacts and judging criteria to existing requirements and evidence gates.
- Correct cutoff-before-snapshot causality, action-specific lifecycle/cancellation, holder-signed retirement authority, supported mock settlement token and initiation-versus-payment wording. Place Voting before Full Redemption and distinguish shared machinery from per-action snapshots.
- Preserve UC/FR/NFR/TC IDs and MVP/Post-MVP scope; add explicit administrative/submission gates without claiming current execution acceptance. Documentation-only review; no program/client behavior changed.

## 2026-10-11 — Human Phantom wallet-switch guidance

- Show expected/connected wallet addresses and account-switch instructions in the runner's browser tab; bring it to the foreground. Refresh Phantom trusted connection without signing or automatic approval, then synchronize React wallet state.
- Reject wrong/unapproved accounts and include last provider/account/connection state in timeout diagnostics. Update the presenter guide. Runner synchronization tests: 8 passed on rerun (first run hit the existing 25-ms stage-test timing limit); TypeScript passed. Real Phantom three-action acceptance still requires a human run.

## 2026-10-11 — Devnet transaction expiry handling

- Enable bounded RPC forwarding of identical signed bytes (`maxRetries: 20`), preserving single-signature payment identity. Rebuild/re-simulate/re-sign only before broadcast when fewer than 20 block heights remain.
- On confirmation errors, query the exact submitted signature with transaction-history search. Continue only for successful confirmed/finalized status; missing, processed, failed or unavailable status remains an explicit reconciliation stop without another payment.
- Transaction regression suite: 31 passed; TypeScript build passed. Full human Phantom Devnet acceptance remains pending; the previously submitted settlement must be reconciled before another demo run.

## 2026-10-11 — Documentation consistency cleanup

- Consolidate docs into seven main Markdown files: move implementation contracts/operations to ARCHITECTURE, use REQUIREMENTS as the single FR checklist and README/TZ for product positioning. Remove redundant PRODUCT/implementation files, condense ROADMAP and DEVNET-DEMO, and update reference links/machine-readable evidence paths.
- Present UC/FR/NFR/TC as implementation/coverage checklists in REQUIREMENTS, with TZ-derived business domains and source references. Keep NFR-05/10/12 partial and live DoD separate; preserve normative wording/IDs. Static parser accepts checkbox syntax; traceability passes 121/121.
- Reorganize ARCHITECTURE into frameworks/runtime, the single project structure map and key decisions. Remove the duplicate README structure table and clarify the legacy-only coupon-period limitation in the security audit.
- Replace superseded Coupon-only architecture/gap plans with the current shared Vite/Next client, typed actions, governance, claims, external proposals and trust boundaries.
- Keep two main verification paths: human Devnet Actions and the feature/attack audit. Preserve their internal suites and historical evidence in this changelog.
- Correct roadmap/requirements delivery wording, audit freshness and explicit coupon-period release semantics. Remove duplicated old test-count narratives from current architecture/security docs.

## 2026-10-11 — Human Devnet three-action acceptance runner

- Devnet runners/airdrop now read `.env.local` then `.env` automatically, with shell overrides preserved and frontend RPC fallback. Add public Operator/holder/CDP/window settings to `.env.example`, optional exact Operator validation and a complete judge-facing installation→deployment→wallets→three-terminal demo guide. Real local addresses remain in ignored `.env.local`.
- Reorganize README around the human Phantom three-action Devnet demo, with prerequisites, configuration, three terminals, expected outcomes and evidence first. Consolidate local development checks, preserve legacy Coupon replay/linked anchors, remove superseded test counts and clarify Next build environment scope.
- Add `test:e2e:actions:devnet`: real Phantom UI Coupon → Voting → Full Redemption on one fresh 10/5/2/0-holder instrument, explicit wallet switching, Devnet genesis guard, payment deltas, per-holder mint retirement, audited receipts and wallet-free recovery. Persist per-run public evidence/failure checkpoints; no automatic payment resume or Post-MVP acceptance claim. Human execution remains pending.
- Normalize Phantom signed transactions through canonical wire decoding instead of constructor identity; retain message and partial-signature substitution checks. Explicitly pin compute limit and priority price before simulation/co-signing for non-Memo operations too, avoiding Phantom fee-instruction insertion. Transaction suite: 24 passed; TypeScript passed. Human confirmation of this compatibility fix remains pending.

## 2026-10-10 — Complete FR-01–58 source implementation

- [x] Add distinct v2 action/right/vote/receipt accounts, immutable contract/metadata commitments and action-specific transitions while preserving legacy Coupon layouts/decoder.
- [x] Implement maturity redemption with persistent conflict/transfer lock, principal/separate optional coupon, consumed coupon periods, holder-signed atomic burn/payment and reconciled supply. Implement voting with proposal document hash verification, record power, exclusive Clock window, unique YES/NO/ABSTAIN receipts, abstention-inclusive quorum and strict majority; no vault.
- [x] Implement floor partial redemption, authenticated finalized-slot journal replay, deterministic retained Merkle manifests/proofs, approved/funded bound claims, deadline/dust/reclaim accounting and vault closure.
- [x] Add separated administration/registry/approval/funding threshold roles and exact chain-stored recoverable intents, mandatory versioned eligibility and distinct approved terms modification with immutable historical rights. External feeds only produce canonical deduplicated proposals; source/evidence binding cannot approve execution.
- [x] Add FSD action/claim pages, actual holder signing and zero-allocation operator completion, loss-of-storage recovery, stable history cursors and verified decimal exports with pruning disclosure. Instrument setup accepts real holder public addresses. Production Next App Router shares existing React screens; Vite development remains supported.
- [x] Extend requirement mapping to all121 normative IDs (all58 FR implemented in source; 118 implemented/3 partial across all IDs), add AT-21–36 to the attack matrix and document archive/RPC trust, public proof retention, migration and source/license inventory.
- [x] Add Rust/native/browser adversarial suites, actual failed CPI transactions, independent forged v2 reports, chain-only multisig recovery, proof archive restart and production runtime checks. The full runner records stable hashes; SBF acceptance rejects unsafe stack diagnostics even with exit zero. Offline1..10000 and native4-holder compute/fee/rent measurements make no production scale claim.
- [x] Final complete `npm run test:audit` passed against stable sources: client/wallet84, setup6, offline Post-MVP7, Rust 15, native validator25, protocol browser55 and production Next 5 —197 tests including native parent tests/Rust test_id. All10 runner commands exit0, generated IDL/compiler parity passes and changedInputs is empty. Current signed native/UI artifacts, input/IDL/SBF hashes and measurements are retained under target/; no new human Devnet acceptance claimed.
- [ ] Fresh human Phantom/Devnet acceptance of all current three actions, v2 deployment, remote CI, hosted proof backup/availability and demo video remain release gates. Unscoped dividends/tender, fiat/custody and operational/legal rollout remain future work.


## 2026-10-10 — Requirements traceability and adversarial Coupon audit

- [x] Audit TZ/REQUIREMENTS → implemented roadmap milestones → Rust/React/Solana evidence. Map all 121 UC/FR/NFR/TC IDs: 48 implemented, 12 partial, 35 planned and 26 Post-MVP; classifications are not completed full-TZ acceptance.
- [x] Add [20-class attack matrix and findings](SECURITY-AUDIT.md), machine-readable `audit-coverage.json`, static `audit:requirements`, complete `test:audit` and explicitly scoped `test:audit:client` scripts; CI checks traceability and retains its artifact.
- [x] Reject wallet-returned message/payer/blockhash changes, missing/replaced holder signatures and account changes across simulation/signing/final RPC wait. Copy original instructions and wire bytes so provider mutation cannot poison a retry or broadcast.
- [x] Persist the locally derived signature before sending to RPC; prohibit automatic resend after an uncertain broadcast and preserve the reference pending-payment guard across reload when the send response is lost.
- [x] Extend public audit with approval identity, financial/integer ranges, receipt status and unpaid-reference consistency; reconcile current registry counts, balances, frozen custody and close authority during protocol reads.
- [x] Reject reference snapshot holder substitutions, duplicate IDs and coherently altered cached units/entitlements with the original commitment. Retain the explicit limitation that client-owned/rehashed reference state is not authenticated protocol rights.
- [x] Enforce the current Coupon transition table without changing layouts, seeds, instruction signatures or receipt encoding. Rust checks all 144 stage pairs, exact record boundary and deterministic integer math/rounding/overflow.
- [x] Add authorization coverage across registry/snapshot/calculation/approval/funding/settlement/finalization, a real second-action account-substitution suite, terminal/replay tests and actually executed failed burn/overdraw/payment-CPI rollback checks.
- [x] Extend real browser acceptance with signature rejection and reload/resume during capture, calculation and payment; DOM/direct-client authorization bypass and signed-message substitution must fail before unsafe submission. Verify unchanged TZ golden payouts and public receipt recovery.
- [x] Separate Playwright artifact/report directories and exclude proof/report/docs writes from Vite's dev watcher to preserve connected wallet journeys. Record source/test/config/IDL/binary hashes and invalidate an audit if its code inputs change while running.
- [x] Final complete `npm run test:audit` passed: React/client/wallet 84/84, Rust 8/8, validator 17/17, protocol browser/audit/usability 27/27, setup 6/6; production build, fresh SBF and compiler-generated IDL parity pass. Total 142 tests includes generated Rust `test_id` and the integration parent, not 142 requirements. `target/security-audit/run.json` records all eight successful commands and unchanged inputs; runtime failures retain real transaction signatures in `coupon.json`.
- [ ] At this earlier Coupon-only revision, Redemption/Voting were unfinished. Source scope is superseded by the complete FR-01–58 entry above; human full-TZ DoD remains a separate gate.
- [ ] Fresh human Phantom/Devnet replay of this revision and remote CI execution were not performed; 2026-10-06 human evidence remains historical.


## 2026-10-06 — Reference-driven requirements and delivery plan

- [x] Compare current Coupon source/client/acceptance with eight upstream reference groups; document verified README/specification scope, source links and limits of external validation.
- [x] Preserve existing UC/FR/NFR/TC IDs and delivered Coupon evidence; append FR-43–58, NFR-13–19, TC-20–38 and explicitly scoped Post-MVP use cases.
- [x] Specify typed actions/receipts, compatibility, persistent redemption restrictions, holder-signed atomic burn/payment, coupon-period deduplication and exact voting rules for the remaining MVP.
- [x] Keep Bondholder Voting as third MVP action; detail early/partial redemption after full redemption and Merkle/indexer evolution after acceptance.
- [x] Map requirements, code locations, dependencies and exit gates into each roadmap phase; note archived T-REX and distinguish source pattern reuse from incorporated/tested dependencies.
- [x] Documentation-only update; no new functionality or fresh protocol/Devnet acceptance claimed.

## 2026-10-06 — Deliver Phase 1 Coupon UX/UI and roles

- [x] Make `/` and `/protocol` the real Coupon entry; preserve the Browser/Memo example at `/reference` and update stale copy.
- [x] Add Operator/Investor/Auditor presentation with action preservation, wallet authority gating, own-holder/no-position states and explicit read-only demo identities.
- [x] Add lifecycle progress/next step, monetary summary, UTC record date, transaction feedback/recovery, input validation and shared shadcn-style React/Tailwind v4 input/badge/address controls.
- [x] Make proof readable with aligned amounts, copy/Explorer links, technical disclosures, keyboard focus and mobile overflow checks. Distinguish zero entitlement processed from a nonzero payment; completed actions do not prompt wallet connection to continue.
- [x] Isolate Vite test caches/RPC configuration; teach the runner to reveal optional controls and wait for chain stages/Clock.
- [x] Verification: build/IDL pass; golden 45/45, Rust 4/4, validator 16/16, protocol browser/audit/usability 6/6, Devnet setup 6/6. Mark M1.7 local acceptance complete; retain separate prior human Devnet evidence.

## 2026-10-06 — Plan Phase 1 Coupon UX/UI

- Add unchecked M1.7 from a source-based UI audit: primary protocol entry, lifecycle guidance, business summaries, transaction recovery feedback, Coupon role views, shared visual components and accessible/responsive rights/proof presentation.
- Move planned Coupon role presentation into Phase 1; retain multi-action role extensions in M3.2. Preserve on-chain authority, financial invariants and existing golden/recovery acceptance; no UI implementation or visual browser audit is claimed.

## 2026-10-06 — Plan protocol role views and golden acceptance

- Define Operator/Investor/Auditor switching, wallet authorization boundaries, explicit read-only holder demos and shared Coupon golden expectations in REQUIREMENTS and roadmap; implementation/E2E remain unchecked.

## 2026-10-06 — Align hackathon DoD with verified Coupon delivery

- [x] Mark demonstrated Token-2022 issuance, holder allocation, Coupon snapshot/calculation/settlement/receipt and reproduction README in REQUIREMENTS §24. Keep Redemption, Voting, full role/UI journeys and demo video open.
- [x] Clarify roadmap Phase 1 acceptance wording; Phase 4 still requires all three actions.

## 2026-10-06 — Human Devnet Coupon golden accepted

- [x] Verify saved human-signed replay: snapshot 10/5/2/0 → current 6/9/2/0, real payment deltas 500/250/100/0, total 850; finalized receipt and read-only hash audit. Action: `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx`.
- [x] Update README, roadmap and architecture acceptance status; retain local public evidence in `target/devnet-evidence/coupon.json` / `coupon.png`.
- [x] RPC recovery tests pass 6/6, including web3 account read recovery and no automatic send/faucet retry.

- Fix Devnet golden verifier transport: serialize RPC requests and retry failed reads / HTTP 429, 502, 503, 504 with bounded backoff and request timeouts. Transaction sends and faucet requests are never retried by this transport.

## 2026-10-06 — Fix record-date readiness in UI and Devnet golden

- [x] Use Clock sysvar `unix_timestamp`, matching Rust's `Clock::get()`, instead of estimated `getBlockTime`; base runner/default UI scheduling on chain time.
- [x] Show live record-time readiness and disable early snapshot; controller rechecks Clock before BeginSnapshot and carries its context slot into simulation/broadcast.
- [x] Add Clock wait, unavailable-clock and timeout regressions plus minimum-slot propagation; build and golden 44/44 pass, validator integration 16/16 and protocol UI 4/4 pass.
- [x] Protocol UI checks early snapshot blocking and waits for transfer, approval, funding and finalization completion rather than short fixed assertion windows.
- [x] Document Custom:6007 recovery by waiting/resuming the same Action PDA; Rust's date guard remains intact and no program redeployment is required.

## 2026-10-06 — Validate the first manual Devnet coupon

- [x] Independently read action `CE5ueNhvatzRjinSwDcrpbad16AzveNgEzkcNDKPiR4S`: FINALIZED, four processed holders, exact transaction payment deltas 500/250/100/0, total 850, empty vault and verified snapshot/receipt hashes.
- [x] Verify A→B:4 at slot 508141220, after finalization at slot 508140588; current units are now 6/9/2/0, but the intended transfer-before-payout golden lifecycle is not yet proven by this run.
- [x] Save a separate public read-only audit under `target/devnet-evidence/action-CE5ueNhvatzRjinSwDcrpbad16AzveNgEzkcNDKPiR4S.json`; explain on-chain persistence, manual versus runner artifacts and the snapshot → transfer → calculate → payout demo order in README.

## 2026-10-06 — Reproducible user setup and troubleshooting

- [x] Order README as quick application start → three-terminal Devnet golden replay → technical installation/build/deploy → troubleshooting.
- [x] Document Chromium installation, dedicated debugging profile on port 9222, Phantom testnet setup, per-terminal environment loading and Action PDA resume.
- [x] Preserve current deployment/evidence boundaries and record encountered PATH, CLI wallet, rent/funding, faucet, ID/RPC, disabled-stage and payment-recovery issues.

## 2026-10-06 — Fix human Devnet runner stage synchronization

- [x] Replace default 30-second disabled-button clicks with five-minute stage-aware waits; wait for busy/audit refresh and surface application errors immediately.
- [x] Skip already completed stages, support `RECORDA_DEVNET_ACTION` pre-payment resume, and check on-chain holder balances before repeating the demo transfer.
- [x] Retain public action/error diagnostics and screenshot after failure; refuse payout-delta replay once payments have started without an original baseline.
- [x] Build passes; client/runner regression 40/40, including four synchronization tests. Human Devnet settlement/receipt acceptance remains open.
- [x] Read-only CLI confirms the user's Devnet deployment at `CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF`, slot 508134659; update deployment status without claiming full live acceptance.

## 2026-10-06 — Audit Phase 1 scope and clarify golden evidence

- [x] Reconcile M1.0–M1.6 with Rust instructions, client/local-validator tests and saved evidence; source/IDL/binary hashes match the existing local run.
- [x] Distinguish client golden simulation, actual local Solana execution and unverified human Devnet replay; keep NFR-10 and full TZ DoD open.
- [x] Remove automatic airdrop from Devnet golden runner; existing wallet SOL is used, optional faucet tooling is outside the business-feature checklist. No successful live airdrop is claimed.
- [x] Check official Devnet RPC: neither the declared program ID nor the deployment keypair public address has an account; document ID synchronization, build/deploy and subsequent Phantom replay.
- [x] Explain TZ/historical golden inputs, minor-unit expected payouts, role boundaries and the remaining Redemption/Voting scope.

## 2026-10-06 — Phase 1 Devnet golden and airdrop

- [x] Correct Devnet genesis guard to the full hash returned by the official Devnet RPC; the truncated value incorrectly rejected Devnet before requesting funds.

- [x] Add `solana:airdrop`: request 1 test SOL for a public address, enforce Devnet genesis, confirm actual faucet signature and expose faucet fallback.
- [x] Add `test:e2e:golden:devnet`: attach to a user's Phantom browser without wallet/RPC substitution; drive existing Phase 1 coupon controls with human signatures.
- [x] Independently compare required golden snapshot/current units, rights, Token-2022 payout deltas, total and receipt; retain public Devnet evidence and read-only hash audit.
- [x] Link TZ → REQUIREMENTS → ROADMAP → golden tests; document Operator versus disposable Investor identities and distinguish local/controlled tests from Devnet acceptance.
- [x] Verification: build passes; existing golden 36/36; airdrop guard/confirmation tests 3/3 (also added to CI); `/protocol` browser controls render with no page errors. Devnet runner syntax checked; human end-to-end execution remains pending.
- [x] Require the configured Recorda ID to match generated IDL; explain that Deploy KZTB26/token mint and ComputeBudget/Associated Token IDs are not Rust program deployment evidence.
- [ ] Live Devnet replay remains pending matching program deployment and human wallet signatures; no Devnet PASS claimed.

## 2026-10-06 — Simplify roadmap

- [x] Use current focus → phases → milestones → feature checklists; preserve completion states.
- [x] Place the verification/gaps matrix at the start of ROADMAP; retain test-artifact details in ARCHITECTURE and update links.

## 2026-10-06 — Resolve npm dependency vulnerabilities

- [x] Override jayson to 5.0.0 and toml to 5.0.0; remove vulnerable uuid/stream-json chains without downgrading Solana/Anchor.
- [x] Replace native bigint-buffer with a small local unsigned JS codec; validate exact LE/BE bytes, u64/u128/u256 limits and invalid inputs in CJS/ESM.
- [x] Regenerate portable lockfile: clean npm ci and npm audit report 0 vulnerabilities; build and IDL check pass.
- [x] Verification: golden 36/36, validator 16/16, protocol browser/audit 4/4; agent-browser page checks pass.

## 2026-10-06 — Preserve TZ detail and refine documentation navigation

- [x] Keep full TZ context, domain rules and architecture; replace only sections already preserved verbatim in REQUIREMENTS with normative links.
- [x] Remove repeated requirements, metrics, datasets and stale implementation claims from PRODUCT; link to their authoritative sections.
- [x] Order README as business problem → solution/value/example → quick start → visible golden validation → protocol/manual/CI details.
- [x] Verify unchanged TZ sections, normative definitions and local file/section links; application code is unchanged.

## 2026-10-06 — Documentation consolidation and cross-layer audit

- [x] Consolidate docs into TZ, REQUIREMENTS, ROADMAP, CHANGELOG, ARCHITECTURE and PRODUCT; setup/operations/manual replay live in README.
- [x] Preserve UC/FR/NFR/TC and MVP DoD definitions in the normative TZ annex; retain section numbers and requirement authority.
- [x] Replace duplicate implementation plan and stale audits with one requirement → code → test → evidence matrix in ROADMAP.
- [x] Rewrite README around the 30–60 second coupon example, actual scope, build and reproducible acceptance.
- [x] Record Next.js/Vite mismatch, preparatory rights fields, RPC-history/snapshot recovery limits and unfinished Redemption/Voting/Devnet work.
- [x] Fresh build/SBF/IDL pass, Rust 4/4, R1 35/35, validator 16/16 and protocol browser/audit 4/4; real payouts, rejected signature, reload/resume and forged-proof rejection verified.
- [x] Install agent-browser outside the repository and verify `/` and `/protocol`: content/controls render, no runtime errors or Vite overlay.
- [x] Rerun protocol E2E without document edits after Vite reloaded the first browser session; final run passed without application/test changes.

## 2026-10-06 — Phase 1 / M1.1–M1.6: Anchor Coupon Core

- [x] Anchor workspace, pinned Rust/Solana dependencies and generated IDL/types.
- [x] Token-2022 instrument, holder registry, approval/revocation and controlled transfers.
- [x] Protect registered zero-balance accounts from external closure.
- [x] Block ownership/registry changes at the scheduled record date; support authorized cancellation.
- [x] Immutable snapshot with units, capture slot/time, ordering and hash.
- [x] Checked on-chain coupon calculation, holder rights and aggregate obligation.
- [x] Explicit approval, funded vault and Token-2022 payments with atomic rollback.
- [x] Once-only settlement and safe recovery after a partial batch/reload.
- [x] On-chain receipt and per-holder payment amount, destination and slot.
- [x] `/protocol` operator controls, holder rights, history and read-only audit.
- [x] Independently verify formula, totals, snapshot/receipt hashes and program account ownership.
- [x] Golden E2E on Local Validator: TZ §22 total 850 and historical regression total 1750.
- [x] Negative E2E: unauthorized calls, invalid transitions/accounts, late snapshot, duplicate payment, funding, overflow and failed CPI.
- [x] Browser E2E: real validator payments, rejected signature, reload/resume and corrupted proof rejection.
- [x] Protocol CI, evidence artifacts and updated ROADMAP/setup/coverage.
- [x] Validation: Rust 4/4, protocol integration 16/16, browser/audit 4/4, R1 golden 35/35; SBF/build/IDL check pass.
- [ ] Verify remote CI, Devnet deployment and human Phantom acceptance.
- [ ] Implement Phase 2 Redemption and Voting.

## 2026-10-06 — Phase 1 / R1: React coupon bridge

- [x] React/TypeScript/Vite, holder cards, coupon pipeline and transaction links.
- [x] TZ §22 dataset: A/B/C/D = 10/5/2/0; coupon = 500/250/100/0; total = 850.
- [x] Preserve historical golden 10/20/5 as a separate regression.
- [x] Calculate coupon amounts and totals in integer minor units; reject invalid inputs and overflow.
- [x] Validate cached entitlements before payment; derive settlement Memo payouts from actual amounts.
- [x] Show unavailable RPC balances as unknown; abort unsafe allocation/payment.
- [x] Persist settlement signature before confirmation; block repeated payment after reload.
- [x] E2E: snapshot → transfer → calculation → approval → settlement → receipt → reload.
- [x] Negative tests: RPC failure, wrong account owner, rejected approval, insufficient funds, corrupted entitlement and failed confirmation.
- [x] Display IMPLEMENTED/client-owned and SIMULATED boundaries.
- [x] Update README, ROADMAP, architecture, audit and manual Devnet acceptance.
- [x] Add UC/FR/NFR/TC coverage matrix: [Roadmap verification](ROADMAP.md#verification-and-gaps).
- [x] Verify build and 35/35 Playwright tests with controlled wallet/RPC.
- [x] Fix Linux Playwright setup: install Chromium with system dependencies.
- [ ] Retain real Phantom/Devnet signatures and payout deltas from manual acceptance.
- [ ] Verify deployment secrets, merged-PR deployment and current preview.
- [x] Anchor Coupon Core M1.1–M1.6 delivered separately above; R1 client tests retain their Browser/Memo boundary.
