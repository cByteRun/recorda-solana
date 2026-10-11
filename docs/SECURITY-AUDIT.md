# Requirements and adversarial audit

Authority: [TZ](TZ.md) and its normative [REQUIREMENTS annex](REQUIREMENTS.md). [ROADMAP](ROADMAP.md) records delivery; it does not waive requirements. This revision covers the complete FR-01–58 source scope, retaining Coupon and the separately labelled Browser/Memo reference. New typed MVP and Post-MVP acceptance sources are linked below; deployment/human Devnet acceptance stays separate.

Story: React Operator opens an instrument/action → the client reads canonical PDAs and Token-2022 accounts → the wallet signs the simulated instruction → Anchor validates authority, record date, immutable rights and lifecycle → atomic payment records progress → an independent read reopens and reconciles the final receipt. Investor/demo/Auditor role selection is presentation, never signing authority.

## Traceability and delivery gaps

[Machine-readable coverage](audit-coverage.json) maps every normative UC/FR/NFR/TC ID to delivery status, roadmap, evidence source and limitations. `npm run audit:requirements` rejects missing/duplicate/unknown IDs, missing evidence files and invalid roadmap references. Its report is `target/security-audit/traceability.json`. Static linkage does **not** demonstrate that a mapped test passed or that a requirement is fully accepted.

| Scope | Status and acceptance boundary |
| --- | --- |
| FR-01–48 / MVP | Legacy Coupon and typed Coupon/Redemption/Voting implemented. Native tests verify actual balances/burn/tally; role/browser tests sign through a Phantom-compatible boundary with Node-held disposable keys. |
| FR-49–58 / Post-MVP | Authenticated historical index, retained Merkle manifests/claims/reclaim, multisig roles, eligibility/terms, partial redemption, external proposals and paginated exports implemented. See [Architecture operations](ARCHITECTURE.md#operations-and-supported-scope) for trust and measured envelope. |
| NFR-05,10,12 | Explicit limitations: trusted RPC/pruned history, fresh human three-action Devnet acceptance and bounded embedded-key source scan. No exhaustive independent security/secret-history review claim. |
| TZ §19 | Next production App Router serves shared FSD screens; Vite remains development runtime. |

## Threat model and trust boundaries

Attackers may change browser storage, select roles/demo identities, remove DOM attributes, call instructions outside React, sign as an unrelated wallet, substitute valid accounts from another action, replay operations, disconnect/change wallets while awaiting RPC/signature, or supply inconsistent RPC account data. Runtime failure attacks execute against a disposable local validator and compare protected account bytes, owners, lamports and token balances before/after.

The UI needs a trusted Solana RPC. Canonical PDA/owner/formula/hash checks reject inconsistent or substituted responses; a fully fabricated, internally consistent RPC history is not a cryptographic proof of cluster state. Simulation uses `sigVerify: false`; real broadcast/preflight/runtime enforce cryptographic signatures. Wallet-message checks ensure the submitted wire payload is the payload that was simulated, preserve existing holder signatures and reject missing signatures; they do not make a compromised wallet/browser trustworthy.

Operator approval is deliberately powerful. The legacy Coupon layout has no coupon-period identifier: a new legitimately authorized legacy Coupon can pay again on the same units. Typed v2 Coupon closes the FR-46 period-reuse path through explicit reservation/consumption; legacy migration still requires historical reconciliation. This differs from replaying one already-paid entitlement. Historical mint-holder data is controlled by a record-time transfer barrier; capture is not an archival index of arbitrary past slots. Registered accounts must remain frozen and keep Instrument PDA close authority. Partial snapshot failure is resumable; no cancellation after capture begins is implemented.

The Browser/Memo reference has client-owned rights. It checks holder identity, unique IDs, the cached snapshot commitment and coupon arithmetic before payment, but a fully rewritten cache with a recomputed hash is not authenticated against historical Memo transactions. It cannot provide the protocol's on-chain entitlement/authorization/replay guarantees. Disposable demo holder keys are held in browser storage; no operator private key is read or persisted. Use the `/protocol` flow for authoritative business acceptance.

## Attack matrix

`C` = controlled client/RPC/wallet, `V` = actual local validator, `B` = real React browser connected to V, `R` = Rust unit. Every negative includes an expected rejection or invariant; positive golden/resume tests prevent a permanently blocked system from appearing secure.

| Attack | Requirements | Expected invariant | Layer / executable evidence |
| --- | --- | --- | --- |
| AT-01 Unrelated signer registers, changes eligibility, schedules, cancels, captures, finalizes snapshot, calculates, approves, funds, settles or finalizes | FR-07,10–11,24–27; NFR-04; TC-15 | Authority/PDA constraints reject; no protected state changes | V: `protocol-tests/coupon.test.mjs`, named wrong-authority negatives; B: `coupon.spec.ts` |
| AT-02 Remove disabled UI or call approval client directly; select Operator/demo Investor | R1/R3/R4; FR-42; NFR-04,11 | UI presentation cannot grant authority; real unauthorized instruction fails before signing | B: `coupon.spec.ts` direct-client/DOM bypass and role checks |
| AT-03 Transfer without holder signature; direct frozen transfer/burn/delegate/thaw/close | FR-06–08; NFR-04,07,11 | Registry custody cannot be bypassed | V: missing signer, registry-bypass, direct burn/delegate/thaw/close negatives |
| AT-04 Zero/self transfer or overdraw after thaw | FR-08; NFR-07 | Reject invalid transfer; actual failed CPI restores frozen accounts, balances and state | V: `unchangedAttack`, runtime overdraw transaction |
| AT-05 Early capture; late Operator; change eligibility/ownership at/after cutoff; competing scheduled action | FR-10–15; NFR-06; TC-16–17 | Solana Clock barrier preserves record-date ownership until complete capture | R: exact record boundary; V: late-snapshot negatives; C: `chain-clock.spec.ts` |
| AT-06 Omit holder/supply, capture twice, cancel after begin, restart terminal action | FR-12–14,44; NFR-06; TC-16,29 | Completeness and init-once rights; Scheduled-only cancellation | V: snapshot completeness/replay/terminal negatives; R: transition table |
| AT-07 Skip lifecycle stages, replay approvals/calculation or escape Cancelled/Finalized | FR-24–27,44; NFR-03–04; TC-17 | Only allowed transitions; explicit approval before funding/payment | R: all 144 stage pairs; V: invalid transitions and repeated partial calculation |
| AT-08 Substitute another Coupon's right/vault/receipt or another holder's bond/destination | FR-21,25–26,38,41; NFR-04,13; TC-20 | Seeds/action/mint/owner binding rejects substitution and preserves state | V: real second-action isolation and wrong destination/bond tests |
| AT-09 Invalid financial terms, u64/u128 overflow, rounding manipulation and zero holder | FR-16,20–22; NFR-01–02; TC-01–02,05 | Exact per-holder integer floor; aggregate of rounded amounts; error rolls back | R: grid/boundaries; C: `coupon-precision.spec.ts`; V: invalid terms/arithmetic rollback |
| AT-10 Pay before approval/funding, insufficient vault, frozen destination, premature receipt | FR-24–27; NFR-07; TC-17–18 | No payment/state advance without readiness; actual failed payment CPI rolls back | V: funding/settlement/runtime CPI negatives; B: lifecycle |
| AT-11 Duplicate paid entitlement, finalize twice, replay after Finalized | FR-26–27,41; NFR-03; TC-04 | At most one payment/right and one final receipt | V: repeated settlement/finalization; B: independently checked payout balances |
| AT-12 Reject the next capture/calculation/payment signature then reload | FR-12,21,25–27; NFR-08; TC-19,29 | Chain progress survives; resume processes only missing/uncalculated/unpaid rights | B: `coupon.spec.ts`; V: new decoder recovery in partial stages |
| AT-13 Wallet changes before/during simulation, during signing or final RPC wait | NFR-04,11 | No broadcast from stale wallet authorization | C: `transactions.spec.ts` account/disconnect tests |
| AT-14 Wallet rewrites instruction, payer, blockhash, strips signatures or replaces holder signature | NFR-04,07,11 | Returned message must equal captured simulated message; partial signatures preserved | C: `transactions.spec.ts`; B: signed approval substitution |
| AT-15 Provider mutates transaction after integrity check during asynchronous block-height wait | NFR-11 | Broadcast immutable captured wire bytes | C: `transactions.spec.ts` late-object mutation |
| AT-16 RPC accepts payment but loses response; ambiguous confirmation; misleading blockhash error | NFR-03,08; TC-04,19 | Persist locally known signature before send; same-byte RPC forwarding only; reconcile confirmed/finalized signature; no automatic rebuild/re-sign after broadcast attempt; reference remains blocked after reload | C: transaction tests; browser reference: `bridge-lifecycle.spec.ts` lost-response/confirmation cases |
| AT-17 Wrong account owner, noncanonical address, mint/freeze/close authority, registry omission, supply mismatch | FR-09,38,42; NFR-05,11 | Fail read; stale previous action must not remain visible | C: `protocol-client.spec.ts` real binary codec fixtures; B: forged owner response |
| AT-18 Internally reconciled forged amount/hash/receipt, missing approval, wrong action, duplicate holder/index, wrapped integer or inconsistent lifecycle | FR-16,22,41–42; NFR-02,05–06 | Independent formula, approval, range, identity, completion and hash checks report mismatch | `protocol-ui-tests/audit.spec.ts`; B: corrupted receipt response |
| AT-19 Forge cached reference entitlement/snapshot/identity, duplicate holder IDs, pending payment or failed RPC balance as zero | FR-12,16,25; NFR-02–04,08,11 | Reference model aborts inconsistent payout and retains pending guard; fully fabricated/rehashed reference state remains outside protocol guarantees | `tests/bridge-lifecycle.spec.ts`, `golden-ui.spec.ts`; B: public reopen after clearing storage |
| AT-20 Omit normative requirements or introduce common embedded private-key patterns | NFR-12; all IDs | Static mapping fails on missing/duplicate IDs/evidence and suspected inline keys | `scripts/audit-requirements.mjs`; bounded scan, not a comprehensive secret audit |

Current destination balances are not historical payout amounts: holders can later move payment tokens or close token accounts. The public auditor verifies stored payment references/formula/receipt through RPC. Local acceptance separately verifies actual credited balances at settlement. Pagination beyond the current 100-signature query and archival proof/export remain open FR-58 work.

## Findings addressed

| Finding | Change and regression evidence |
| --- | --- |
| Wallet-returned transaction was not compared with the simulated message | Capture the message before provider call, compare returned bytes, require signer slots and preserve holder partial signatures. Capture final wire bytes before further awaits. AT-13–15. |
| Lost broadcast response could leave no durable signature and a blockhash-labelled send error could trigger an automatic retry | Persist locally derived signature before RPC send and classify any post-send failure as uncertain; automatic rebuilding is only allowed before broadcast. AT-16 including reference reload. |
| Public audit accepted missing approval identity, wrapped integer values and inconsistent unpaid references | Validate approved-by authority, bounded integer/financial parameters, receipt enum and unpaid references while allowing genuine partial progress. AT-18. |
| Client read did not reconcile the full current registry/balances or enforce frozen/close custody | Check registered/approved counts, sum of current balances against mint supply and token freeze/close authority. AT-17. |
| Reference payout checked amounts against cached units but did not bind holder identity, unique IDs or the snapshot commitment | Abort altered holder identity/duplicates and coherently changed units+entitlement with the original hash. Full-cache authenticity remains a reference limitation. AT-19. |
| Shared Playwright artifact roots corrupted simultaneous suite traces | Separate golden/protocol output and HTML report directories. Full audit runs suites sequentially. |
| Vite reloaded active test wallet pages while unrelated documentation/evidence files changed | Exclude docs, target proofs and Playwright outputs from the dev watcher; final complete run stays connected through every intended signature/reload recovery. |
| Requirement/evidence statuses were only manually summarized | Add complete machine-readable mapping and a fail-fast npm runner, retaining all unfinished scope. |

The historical Coupon hardening preserved its layouts, seeds and receipt encodings. Current v2 adds distinct action/right/vote/receipt, governance and distributor schemas/instructions while retaining legacy decoding. Generated IDL parity and historical fixtures guard compatibility; this is not a claim that the entire ABI remained unchanged.

## Reproduction and evidence

With dependencies, Chromium and the README's pinned Rust/Solana tooling installed:

```sh
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
npm run test:audit
```

`test:audit` runs traceability → frontend build → environment/RPC setup regression → offline Post-MVP checks and distribution benchmark → client/wallet tests → Rust unit tests → fresh SBF build → compiled IDL parity → native-validator/browser/Next acceptance. It stops on the first failing command and writes `target/security-audit/run.json` with each exit code and source/test/config/IDL/binary hashes. A new run resets the top-level success result before starting; changing audited code/tests during a run invalidates success. `npm run test:audit:client` intentionally excludes Rust/validator and labels its scope accordingly; `npm run audit:requirements` is static only.

Local artifacts: `target/security-audit/{run,traceability}.json`, `target/protocol-evidence/coupon.json` (including signatures of actually executed failed attacks), `coupon-ui.json`, screenshots, `test-results/{golden,protocol}` traces and `playwright-report/{golden,protocol}`. Artifact counts include generated `test_id` and integration parent tests; they are not requirement counts. Ignored local evidence is not committed release proof. CI runs the mapped client and protocol suites and uploads its artifacts; remote CI is not asserted by a local run.

Final run results are recorded in [CHANGELOG](CHANGELOG.md) and [ROADMAP verification](ROADMAP.md#verification-and-gaps). Historical 2026-10-06 human Phantom/Devnet proof remains historical evidence. No live Devnet transaction, deployment, admin-key export or externally published result is required by this local audit. The defined attack matrix is bounded; new features and untested attack classes need their own acceptance before release.

## V2 / Post-MVP attack matrix

| Attack | Requirement | Expected rejection / invariant | Evidence source |
| --- | --- | --- | --- |
| AT-21 Cross-kind payment/vote or legacy accounts substituted into v2 | FR-43–44,48; TC-20,27–28 | Canonical versioned PDAs, kind dispatch and outcome commitments fail closed | actions-v2.test.mjs; actions-audit.spec.ts |
| AT-22 Early maturity, overlapping actions, transfer/issuance after retirement starts | FR-28,45; TC-21 | Clock and persistent instrument reservation remain through finalization | actions-v2.test.mjs; engine.rs |
| AT-23 Operator attempts holder burn, unsigned/foreign holder, payment CPI fails after burn | FR-46; TC-22–23 | Actual holder signer; failed transaction leaves tokens/supply/right counters unchanged | actions-v2.test.mjs; holder-flows.spec.ts |
| AT-24 Replay final coupon period across action kinds; disable coupon but pay it | FR-18,46; TC-24 | Permanent consumed period reservation, immutable policy and independent integer components | actions-v2.test.mjs; actions-audit.spec.ts |
| AT-25 Vote before open/at close, zero power, wrong holder or duplicate receipt | FR-35–37,47; TC-25–27 | Exact Clock interval, snapshot power, holder signature and unique PDA; ties fail, abstentions count quorum | actions-v2.test.mjs; engine.rs; actions.spec.ts |
| AT-26 Forge copied contract/snapshot/principal/coupon/retirement/tally/result/source/receipt | FR-42,48; NFR-05 | Independent recomputation rejects internally inconsistent or rehashed substituted fields | actions-audit.spec.ts (19 mutations plus historical formula test) |
| AT-27 Unsigned/untrusted archive, gaps, reordered/post-record inputs, omitted/ineligible supply | FR-49; NFR-16; TC-30 | Pinned Ed25519 provider, declared finalized bank and full sequence/registry/supply reconciliation | scripts/post-mvp.test.mjs |
| AT-28 Manifest tamper or proof loss after restart | FR-50; NFR-17; TC-32 | Content-addressed durable archive and independent formula/proof/root checks; retrieval failure blocks client | scripts/post-mvp.test.mjs; holder-flows.spec.ts |
| AT-29 Claim altered amount/holder/destination/proof, duplicate or frozen destination | FR-51; TC-31 | Domain-bound leaf, holder signer, destination owner/mint and unique index; actual failed CPI rolls back claim mark | protocol-tests/post-mvp.test.mjs; holder-flows.spec.ts |
| AT-30 Early/wrong-authority reclaim, expired claim, late dust donation or reclaim replay | FR-52; TC-33 | Exclusive deadline, correct authority, observed paid/reclaimed funds and closed vault | protocol-tests/post-mvp.test.mjs; distributor.rs |
| AT-31 Wrong role, missing threshold, substituted intent bytes/metas, executed replay | FR-53; TC-35 | Allowlisted exact role commitment and chain-stored approval bitmap; recover intent without cache | governance.rs; protocol-tests/post-mvp.test.mjs |
| AT-32 Omit/expire/freeze/mismatch eligibility or modify historical terms/rights | FR-54–55; TC-35,37 | Canonical mandatory policies and record timestamp; approved terms update cannot rewrite copied contract/receipt | protocol-tests/post-mvp.test.mjs; actions-audit.spec.ts |
| AT-33 Partial retirement rounding/overlap/duplicate/rollback | FR-56; TC-34 | Floor each holder, atomic payment and persistent restrictions;100/300/600→20/60/120, remaining800 | engine.rs; actions-v2.test.mjs |
| AT-34 External retry/conflicting evidence/payload, unauthorized source attachment or execute flag | FR-57; TC-36 | Canonical durable source/event deduplication; approved operator proposal binding; feed cannot execute | scripts/post-mvp.test.mjs; actions-v2.test.mjs |
| AT-35 Pruned RPC history or corrupted export/lost browser cache | FR-58; TC-37 | Explicit unavailable evidence, advancing stable cursors, decimal export and chain-only reopen | actions-audit.spec.ts; actions.spec.ts; holder-flows.spec.ts |
| AT-36 SBF stack error with compiler exit zero; unsupported scale claims | NFR-18–19; TC-38 | Build wrapper rejects stack diagnostics; native compute/rent and offline proof measurements publish their scope | build-sbf.mjs; measure-protocol.mjs; benchmark-distribution.mjs |

Sources above must pass against a fresh binary/validator before release. Static traceability marks source delivery, not exhaustive attack coverage or cryptographic proof that an RPC/archive provider is truthful. Historical v1 evidence remains historical.

## Evidence freshness

The complete 2026-10-10 local audit recorded 197 tests and ten successful runner commands with unchanged input hashes. This is a historical result; subsequent wallet compatibility, Devnet runner and environment-loading changes are not covered by that revision's full audit. Follow-up targeted checks are recorded in [CHANGELOG](CHANGELOG.md). Run `test:audit` against stable current source and require matching hashes before claiming current complete acceptance.

Human Devnet evidence is separately recorded by `test:e2e:actions:devnet` in `target/devnet-evidence/actions-<id>/run.json`. A reported program upload alone is not a successful three-action run, remote CI result or deployed/local binary match. Source scope is FR-01–58; release acceptance remains governed by [ROADMAP](ROADMAP.md).
