# Manual Devnet acceptance — Phantom boundary

Automated Playwright tests intentionally do **not** bypass or auto-approve Phantom confirmation dialogs.

This is a product/security boundary, not a missing test.

## Automated coverage

`npm run test:e2e:golden` verifies without Phantom:

- golden input fixture;
- record-date snapshot invariant `10/5/2/0`;
- post-record current state `6/9/2/0`;
- entitlement `500/250/100/0`;
- final expected settlement;
- business-axis copy and UI;
- wallet-gating / required step ordering;
- complete client workflow with controlled RPC responses and a test wallet;
- rejected approval, invalid snapshot accounts, RPC failure, insufficient treasury and pending-payment reload guards.

The test wallet signs only in the test harness; it does not bypass the real Phantom extension. These tests verify client instructions and RPC result handling, not a Solana validator. See [R1 coverage](R1_TEST_COVERAGE.md).

## Manual real-chain acceptance

Use a fresh browser profile/origin, Solana Devnet and the TZ §22 golden scenario (17 bond units, four holders). Do not reuse the historical 35-unit deployment:

1. Set Phantom to Solana Devnet, unlock it and connect the operator account with Devnet SOL.
2. Deploy/resume KZB26.
3. Verify RPC state is `10/5/2/0`.
4. Create record-date snapshot.
5. Approve Phantom transaction.
6. Transfer `A → B: 4 KZB26`.
7. Verify current chain state is `6/9/2/0`.
8. Calculate entitlement.
9. Verify UI remains `500/250/100/0`.
10. Explicitly approve in Phantom.
11. Settle `500/250/100/0 KUSD-DEV`.
12. Finalize ActionReceipt.
13. Open every transaction link in Solana Explorer.
14. Compare real chain output with `golden/coupon-tz-section-22.json`.

### Pass criteria

- current ownership = `6/9/2/0`;
- snapshot = `10/5/2/0`;
- entitlement = `500/250/100/0`;
- real KUSD delta = `500/250/100/0`;
- all signatures confirmed/finalized;
- Operator signed approval;
- A signed post-record transfer;
- action finalized.

When Anchor replaces Memo/browser domain truth, it must reproduce these expected outputs and enforce the protocol guarantees.

Retain mint addresses, all six stage signatures, snapshot slot/time/hash, before/after settlement token balances and RPC/Explorer verification. Until this evidence exists, manual Devnet acceptance remains open.


## Snapshot failure diagnostics

Before signing, the adapter simulates the exact transaction with the Memo compute budget. A simulation failure must expose program logs and must not open Phantom. An unexpected wallet error after successful simulation must not submit a transaction. Reconnect after checking Phantom network/account and retry only when nothing was submitted. Verify the signed snapshot transaction succeeds on Devnet and still contains the complete snapshot payload. These checks require the actual wallet; mocked transaction tests do not prove extension acceptance.
