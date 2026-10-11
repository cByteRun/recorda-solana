# Action engine v2 implementation contract

V1 Coupon accounts, instruction discriminators, layouts and receipt decoding stay intact. New actions use `action-v2` PDAs and a distinct `ActionV2`/`RightV2`/`ReceiptV2` schema. No automatic migration of historical rights is allowed. V1 snapshots retain their historical meaning; new immutable contracts copy instrument terms at scheduling.

The instrument's existing active-snapshot pointer also reserves an active v2 lifecycle. Legacy scheduling rejects a nonempty pointer. All new actions serialize until terminal completion or Scheduled cancellation. Coupon/Voting release the record transfer barrier after capture; redemption retains it through settlement. Full maturity redemption checks Solana Clock at scheduling, snapshot and execution. Partial redemption uses per-holder floor allocation, with no aggregate percentage promise.

Each payable coupon period has a unique instrument/period PDA explicitly reserved while Scheduled, before approval. After Scheduled cancellation, a separate authorized release instruction closes an unconsumed reservation; cancellation alone does not close that PDA. Finalized payment consumes the period permanently. Legacy Coupon did not store a period identifier, so its periods cannot be inferred. Operators must use unambiguous new period IDs and must not relabel historical payments. A migration with historical period attestation is required before deploying v2 against an instrument with unknown legacy payment history.

Voting uses approval plus `[opens_at, closes_at)`, holder signatures, unique receipts, snapshot power, abstention-inclusive quorum and strict YES > NO. It creates no payment vault. Approval never modifies instrument terms. Final receipts commit schema, kind, terms, parameters, snapshot and outcome.

Payment settlement uses bound holder destinations. Redemption requires the holder signature for a single atomic thaw/burn/payment/counter update; zero allocations permit operator completion. Full settlement reconciles mint supply with outstanding/redeemed counters. Failed CPI rolls everything back. Chain state supports resuming capture, calculation and settlement without browser storage.

Acceptance requires real validator tests, independent integer/hash/tally checks and role/browser fixtures. Deployment, human signing, remote CI and video are separate evidence gates and are never marked complete by local tests.
