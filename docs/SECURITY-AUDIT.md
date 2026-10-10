# Requirements and adversarial audit — 2026-10-10

Authority: [TZ](TZ.md) and its normative [REQUIREMENTS annex](REQUIREMENTS.md). [ROADMAP](ROADMAP.md) records delivery; it does not waive requirements. This audit covers current Coupon M1.0–M1.7 and the separately labelled Browser/Memo reference. It does not implement the missing Redemption, Voting or Post-MVP work.

Story: React Operator opens an instrument/action → the client reads canonical PDAs and Token-2022 accounts → the wallet signs the simulated instruction → Anchor validates authority, record date, immutable rights and lifecycle → atomic payment records progress → an independent read reopens and reconciles the final receipt. Investor/demo/Auditor role selection is presentation, never signing authority.

## Traceability and delivery gaps

[Machine-readable coverage](audit-coverage.json) maps every normative UC/FR/NFR/TC ID to delivery status, roadmap, evidence source and limitations. `npm run audit:requirements` rejects missing/duplicate/unknown IDs, missing evidence files and invalid roadmap references. Its report is `target/security-audit/traceability.json`. Static linkage does **not** demonstrate that a mapped test passed or that a requirement is fully accepted.

| Scope | Status and acceptance boundary |
| --- | --- |
| UC-CP-01; FR-01,03–04,06–16,20–27,38–42; TC-01–05,15–19,29 | Implemented Coupon. Unit, controlled client, actual validator and browser acceptance are separate evidence layers. |
| FR-02,05 | Partial: no separate issuer identity; complete redeemed-supply/status UI waits for Redemption. MVP allows one issuer/operator authority. |
| FR-17–19; UC-BR-01, UC-VOTE-01; TC-06–14 | Stored principal/final-coupon/voting-power fields exist. They do not burn bonds, pay principal, cast votes or tally proposals. Use cases remain open. |
| FR-43–48; NFR-13–15; TC-20–28 | Coupon transitions and same-kind account isolation are exercised. Typed actions, coupon-period deduplication, persistent redemption lock, voting authorization and versioned receipt migration remain open. |
| NFR-05,10,12,14 | Partial: trusted-RPC audit/history limits, historical human Devnet proof, bounded source secret-pattern scan and unchanged-layout/IDL regression are insufficient for full future acceptance. |
| TZ §19; M3.1 | Next.js is required; current React/Vite stack is a documented deviation. |
| UC-MD-01, UC-PR-01, UC-EV-01; FR-49–58; NFR-16–19; TC-30–38 | Explicit Post-MVP; no fake tests or successful security claim for unimplemented instructions. |

The manifest currently accounts for 121 IDs: 48 implemented, 12 partial, 35 planned, 26 Post-MVP. These are classification counts, not tests, line coverage or completed full-MVP acceptance. Normative DoD is still incomplete.

## Threat model and trust boundaries

Attackers may change browser storage, select roles/demo identities, remove DOM attributes, call instructions outside React, sign as an unrelated wallet, substitute valid accounts from another action, replay operations, disconnect/change wallets while awaiting RPC/signature, or supply inconsistent RPC account data. Runtime failure attacks execute against a disposable local validator and compare protected account bytes, owners, lamports and token balances before/after.

The UI needs a trusted Solana RPC. Canonical PDA/owner/formula/hash checks reject inconsistent or substituted responses; a fully fabricated, internally consistent RPC history is not a cryptographic proof of cluster state. Simulation uses `sigVerify: false`; real broadcast/preflight/runtime enforce cryptographic signatures. Wallet-message checks ensure the submitted wire payload is the payload that was simulated, preserve existing holder signatures and reject missing signatures; they do not make a compromised wallet/browser trustworthy.

Operator approval is deliberately powerful. The current Coupon layout has no coupon-period identifier: a new legitimately authorized Coupon can pay another coupon on the same units. This is an open NFR-15/FR-46 design gap, distinct from replaying one already-paid entitlement. Historical mint-holder data is controlled by a record-time transfer barrier; capture is not an archival index of arbitrary past slots. Registered accounts must remain frozen and keep Instrument PDA close authority. Partial snapshot failure is resumable; no cancellation after capture begins is implemented.

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
| AT-16 RPC accepts payment but loses response; ambiguous confirmation; misleading blockhash error | NFR-03,08; TC-04,19 | Persist locally known signature before send; no automatic resend after broadcast attempt; reference remains blocked after reload | C: transaction tests; browser reference: `bridge-lifecycle.spec.ts` lost-response/confirmation cases |
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

No account layouts, instruction signatures, seeds, existing receipt encodings or protocol ID were changed. The Rust transition guard is an additional runtime check on the current Coupon transitions; the existing historical fixture and compiler-generated IDL parity are regression gates.

## Reproduction and evidence

With dependencies, Chromium and the README's pinned Rust/Solana tooling installed:

```sh
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
npm run test:audit
```

`test:audit` runs traceability → production build → Devnet setup unit tests → golden/client/wallet tests → Rust unit tests → fresh SBF build → compiled IDL parity → actual validator/browser audit. It stops on the first failing command and writes `target/security-audit/run.json` with each exit code and source/test/config/IDL/binary hashes. A new run resets the top-level success result before starting; changing audited code/tests during a run invalidates success. `npm run test:audit:client` intentionally excludes Rust/validator and labels its scope accordingly; `npm run audit:requirements` is static only.

Local artifacts: `target/security-audit/{run,traceability}.json`, `target/protocol-evidence/coupon.json` (including signatures of actually executed failed attacks), `coupon-ui.json`, screenshots, `test-results/{golden,protocol}` traces and `playwright-report/{golden,protocol}`. Artifact counts include generated `test_id` and integration parent tests; they are not requirement counts. Ignored local evidence is not committed release proof. CI runs the mapped client and protocol suites and uploads its artifacts; remote CI is not asserted by a local run.

Final run results are recorded in [CHANGELOG](CHANGELOG.md) and [ROADMAP verification](ROADMAP.md#verification-and-gaps). Historical 2026-10-06 human Phantom/Devnet proof remains historical evidence. No live Devnet transaction, deployment, admin-key export or externally published result is required by this local audit. The defined attack matrix is bounded; new features and untested attack classes need their own acceptance before release.

Verified final run: **PASS**, 2026-10-10. All eight runner commands returned 0 and `changedInputs` is empty. React/client/wallet 84/84, Rust 8/8, actual validator 17/17, protocol browser/audit/usability 27/27 and setup 6/6 (142 reported tests). The three deliberately failed runtime transactions retain signatures; protected account comparisons passed. Production build, SBF and IDL parity passed. No remote CI or new human Devnet acceptance is inferred.
