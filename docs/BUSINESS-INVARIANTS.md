# Critical business invariants — coverage checklist

**BondOps value:** these invariants underpin [obligation reconciliation and exception resolution](PRODUCT.md): a fixed right is distinct from confirmed execution, ambiguous results must be reconciled before retry, and a corrective action cannot bypass authority or duplicate-payment protection. The proposed exception workspace is not covered as delivered by this checklist.

This checklist derives from [TZ](TZ.md) and its normative [REQUIREMENTS annex](REQUIREMENTS.md). It groups existing obligations by business domain and introduces no new requirements. Delivery and live acceptance remain owned by [ROADMAP](ROADMAP.md). The [README summary](../README.md#business-domains-and-critical-invariants) links here.

`[x]` means implementation and executable checks cover the stated scope. `[ ]` means a gap, partial guarantee or unclosed acceptance gate. A checked item is not exhaustive security assurance or human Devnet acceptance. AT references resolve to the [MVP attack matrix](SECURITY-AUDIT.md#attack-matrix) and [v2/Post-MVP matrix](SECURITY-AUDIT.md#v2--post-mvp-attack-matrix).

Evidence reviewed on 2026-10-11: the retained `target/security-audit/run.json` reports ten successful commands and no changed inputs; all 107 recorded input hashes matched workspace files at review time. Suites were not rerun for this documentation review. Future claims require fresh matching evidence under the [audit evidence rules](SECURITY-AUDIT.md#reproduction-and-evidence).

## 1. Instrument and holder registry

Basis: TZ §§8,10,13. Evidence: [Coupon validator tests](../protocol-tests/coupon.test.mjs), [v2 validator tests](../protocol-tests/actions-v2.test.mjs), [registry implementation](../programs/recorda/src/lib.rs).

- [x] Registered holder balances reconcile to active supply; omitted positions and substituted instruments fail verification. FR-06–09; AT-17.
- [x] Bond transfers require the holder signature and controlled registry path; direct transfer/burn/delegate/thaw/close cannot bypass custody. FR-06–08; AT-03.
- [x] Zero/self/overdraw transfers fail; runtime failure restores balances, frozen custody and protected state. FR-08; AT-04.
- [x] Redeemed units cease to circulate as active bonds and cannot be redeemed again. FR-30–32; TC-08–10.

## 2. Record date and immutable rights

Basis: TZ §§7,9. Evidence: [registry/barrier implementation](../programs/recorda/src/lib.rs), [v2 engine](../programs/recorda/src/engine.rs), [Coupon tests](../protocol-tests/coupon.test.mjs), [v2 tests](../protocol-tests/actions-v2.test.mjs).

- [x] Rights derive from cutoff holdings, not execution-time balances; at Clock >= record timestamp, balance-changing operations cannot move ownership before complete capture, even if the Operator starts late. FR-10–15; AT-05.
- [x] Eligibility changes after cutoff cannot rewrite the action's holder population. FR-10–15; AT-05.
- [x] Snapshot completion requires all expected holders and captured units reconciled with expected and actual mint supply. FR-12–14; AT-06.
- [x] Finalized snapshots and per-holder rights cannot mutate or be initialized twice. FR-13–15; TC-16.
- [x] Post-snapshot Coupon/Voting transfers change current positions but preserve existing payment rights/voting power. TC-03,12.
- [x] Each subsequent action uses its own cutoff holdings: the v2 same-instrument fixture transfers A/B from 10/5 to 6/9 after Coupon capture and uses 6/9 for later actions. TZ §7; TC-03,12.

## 3. Financial obligations

Basis: TZ §8. Evidence: [engine and unit tests](../programs/recorda/src/engine.rs), [precision tests](../tests/coupon-precision.spec.ts), [independent v2 audit tests](../protocol-ui-tests/actions-audit.spec.ts).

- [x] Monetary arithmetic uses checked integers/minor units and floors once per holder; invalid terms and overflow fail. FR-16,20–22; AT-09.
- [x] Total obligation equals the sum of individually rounded holder amounts. TC-05.
- [x] Zero positions produce zero obligations and complete without payment/burn. TC-02,23.
- [x] Calculations use copied action terms; later instrument modifications do not rewrite historical rights. FR-43,55; AT-26,32.

## 4. Coupon servicing

Basis: TZ §§12,20. Evidence: [Coupon tests](../protocol-tests/coupon.test.mjs), [v2 tests](../protocol-tests/actions-v2.test.mjs), [browser lifecycle/recovery](../protocol-ui-tests/coupon.spec.ts).

- [x] Settlement requires complete calculation, explicit approval and sufficient funding. FR-24–27; AT-07,10.
- [x] Each entitlement pays at most once, including retries and resumed batches. TC-04,19; AT-11–12.
- [x] Destination owner/payment mint and action accounts are bound to the right; substituted accounts fail. AT-08.
- [x] Failed payment CPI rolls back transfers and execution counters. AT-10.
- [x] Finalization requires all rights processed and paid == total due. FR-27; AT-10–11.
- [x] V2 reserves/consumes coupon periods to prevent reuse across Coupon and final-coupon Redemption. FR-46; AT-24.
- [ ] Legacy Coupon lacks a period identifier: a new legitimately authorized action can repeat the economic coupon. Historical reconciliation is required for legacy-to-v2 period continuity; once-only settlement of one legacy right does not close this gap. See [trust boundaries](SECURITY-AUDIT.md#threat-model-and-trust-boundaries).

## 5. Full maturity redemption

Basis: TZ §13. Evidence: [v2 engine/unit tests](../programs/recorda/src/engine.rs), [validator tests](../protocol-tests/actions-v2.test.mjs), [holder browser flows](../protocol-ui-tests/holder-flows.spec.ts).

- [x] Maturity readiness uses Solana Clock; early maturity execution fails. FR-28,45; AT-22.
- [x] Transfers, issuance and conflicting actions stay restricted after snapshot completion and throughout partial retirement/settlement. FR-45; TC-21.
- [x] Principal and final coupon are independent components; disabled final coupon pays zero and enabled coupon is visible separately. FR-17–18; TC-06–07,24.
- [x] Nonzero retirement requires the holder signature; the Operator alone cannot burn holder bonds. FR-46; TC-23.
- [x] Burn, payment and supply/right updates occur atomically; payment failure after burn rolls back all token and counter changes. TC-22; AT-23.
- [x] Processed rights cannot be redeemed again. TC-09.
- [x] Full finalization requires every right processed, all amounts paid, all snapshot units retired and zero remaining active supply. FR-31–32,46.

## 6. Holder decisions / Voting

Basis: TZ §14. Evidence: [engine/unit tests](../programs/recorda/src/engine.rs), [v2 validator tests](../protocol-tests/actions-v2.test.mjs), [action browser tests](../protocol-ui-tests/actions.spec.ts).

- [x] Voting power equals snapshot units and survives later transfers. TC-11–12.
- [x] Votes require the holder signature, nonzero power and a unique VoteReceipt; duplicates fail. TC-13,25.
- [x] Votes are accepted only in the approved window; before open and at/after close fail. AT-25.
- [x] Tally equals valid vote power; abstentions count toward quorum; passing requires quorum and YES > NO, so ties fail. TC-14,26.
- [x] Voting needs no funding/vault, cannot execute payment-kind instructions and does not automatically modify bond terms. FR-44,47; TC-27.

## 7. Authorized lifecycle and recovery

Basis: TZ §§11,15. Evidence: [Coupon validator tests](../protocol-tests/coupon.test.mjs), [v2 validator tests](../protocol-tests/actions-v2.test.mjs), [browser recovery](../protocol-ui-tests/coupon.spec.ts), [transaction tests](../tests/transactions.spec.ts), [uncertain reference payments](../tests/bridge-lifecycle.spec.ts).

- [x] UI role/demo identity cannot grant authority; on-chain signatures and authorities govern mutations. AT-01–02.
- [x] Required stages cannot be skipped; wrong-kind instructions and another action's rights/vault/receipt fail. FR-43–44,48; AT-07–08,21.
- [x] Cancellation is Scheduled-only before capture; terminal actions cannot restart. FR-44; AT-06–07.
- [x] Partial processing remains visible and resumes from chain without repeating completed rights. TC-19,29; AT-12.
- [x] Lost/ambiguous RPC send responses retain the known signature and do not trigger automatic rebuilding/re-signing after broadcast; reconciliation governs the next step. AT-16.

## 8. Receipts, audit and trust boundaries

Basis: TZ §§18,20,21. Evidence: [Coupon auditor tests](../protocol-ui-tests/audit.spec.ts), [v2 auditor tests](../protocol-ui-tests/actions-audit.spec.ts), [action recovery](../protocol-ui-tests/actions.spec.ts), [security trust model](SECURITY-AUDIT.md#threat-model-and-trust-boundaries).

- [x] Final receipts bind action identity/kind/parameters/snapshot and the appropriate payment, retirement or voting outcome. FR-38–48; AT-18,26.
- [x] Auditor independently recomputes formulas, totals and commitments and rejects forged receipt fields. AT-18,26.
- [x] Audit is wallet-free; protocol recovery does not depend on browser cache. FR-42,58; TC-29,37.
- [ ] Complete independent historical proof remains limited by trusted RPC, unavailable/pruned history and historical destination evidence. A fully fabricated internally consistent RPC history is not excluded by account/formula checks. NFR-05.
- [ ] Browser/Memo reference cache is not authenticated historical ownership when fully rewritten and rehashed. Its checks cannot provide the protocol's on-chain entitlement/authorization guarantees. AT-19; authoritative business acceptance uses the protocol flow.

## 9. Separately scoped Post-MVP domains

Basis: TZ §26; FR-49–58. Evidence: [offline archive/manifest/source tests](../scripts/post-mvp.test.mjs), [native claim/governance tests](../protocol-tests/post-mvp.test.mjs), [v2 partial retirement tests](../protocol-tests/actions-v2.test.mjs), [holder flows](../protocol-ui-tests/holder-flows.spec.ts), [audit/history tests](../protocol-ui-tests/actions-audit.spec.ts).

- [x] Historical indexing requires a pinned signed source, complete ordered history and supply/eligibility reconciliation; gaps fail closed. FR-49; AT-27.
- [x] Deterministic manifests/proofs survive restart and reject tampering; claims bind holder/destination/amount and cannot replay. FR-50–51; AT-28–29.
- [x] Reclaim requires the authorized signer after the deadline; funded/paid/reclaimed funds reconcile and unclaimed obligations are not reported as fully paid. FR-52; AT-30.
- [x] Separated roles/multisig enforce threshold and exact intent; policy/term changes preserve historical rights. FR-53–55; AT-31–32.
- [x] Partial retirement uses per-holder integer allocation, atomic payment and reconciled reduced supply, with overlap/replay rejection. FR-56; AT-33.
- [x] External events produce provenance-bound deduplicated proposals; the feed cannot bypass approval or execute an action. FR-57; AT-34.
- [x] Paginated history/export recovers from chain and explicitly discloses unavailable transaction evidence. FR-58; AT-35. RPC/archive trust boundaries still apply.

These are implemented extension capabilities, not hosted-service or production-scale guarantees; see [supported operations and scope](ARCHITECTURE.md#operations-and-supported-scope). They do not replace any mandatory MVP scenario.

## 10. Open live business acceptance

Basis: TZ §§7,21,24; [remaining acceptance gates](ROADMAP.md#remaining-acceptance-and-release-work).

- [ ] Retain a complete human Phantom Coupon → Voting → Full Redemption run on one Devnet instrument, with signatures, payment deltas, three final outcomes and zero final active supply. Local automated and scoped real-wallet local evidence does not close this gate.
- [ ] Complete role journeys and implemented/simulated disclosures in the full live demonstration/video. This is unclosed acceptance, not an assertion that the UI is absent.

Registration, judge repository access and submission attachments remain separate [submission gates](REQUIREMENTS.md#submission-gates), rather than business invariants.
