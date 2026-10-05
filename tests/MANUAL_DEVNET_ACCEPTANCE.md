# Manual Devnet acceptance — Phantom boundary

Automated Playwright tests intentionally do **not** bypass or auto-approve Phantom confirmation dialogs.

This is a product/security boundary, not a missing test.

## Automated coverage

`npm run test:e2e:golden` verifies without Phantom:

- golden input fixture;
- record-date snapshot invariant `10/20/5`;
- post-record current state `6/24/5`;
- entitlement `500/1000/250`;
- final expected settlement;
- business-axis copy and UI;
- wallet-gating / required step ordering.

## Manual real-chain acceptance

Use Solana Devnet and the same golden scenario:

1. Connect Phantom.
2. Deploy/resume KZB26.
3. Verify RPC state is `10/20/5`.
4. Create record-date snapshot.
5. Approve Phantom transaction.
6. Transfer `A → B: 4 KZB26`.
7. Verify current chain state is `6/24/5`.
8. Calculate entitlement.
9. Verify UI remains `500/1000/250`.
10. Explicitly approve in Phantom.
11. Settle `500/1000/250 KUSD-DEV`.
12. Finalize ActionReceipt.
13. Open every transaction link in Solana Explorer.
14. Compare real chain output with `golden/coupon-happy-path.json`.

### Pass criteria

- current ownership = `6/24/5`;
- snapshot = `10/20/5`;
- entitlement = `500/1000/250`;
- real KUSD delta = `500/1000/250`;
- all signatures confirmed/finalized;
- Operator signed approval;
- A signed post-record transfer;
- action finalized.

When Anchor replaces Memo/browser domain truth, the same acceptance fixture remains unchanged.
