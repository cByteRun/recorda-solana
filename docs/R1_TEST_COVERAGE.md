# R1 — React coupon bridge: requirements and verification

Source of truth: [TZ](TZ.md). Scope authorized for this change: current branch `feat/phase-1-react`, roadmap **R1**, without Anchor M1.1–M1.6. Requirements below are covered only at their stated client boundary. A passing mocked test does not satisfy an on-chain requirement.

## Delivered features

- Four disposable holder identities A/B/C/D; fresh deployment allocates 10/5/2/0, supply 17. Existing A/B/C keys are preserved when D is added.
- TZ §22 golden: current 6/9/2/0 after transfer, coupon 500/250/100/0, total 850. The historical golden 10/20/5 and total 1750 retains its expected values.
- Checked BigInt financial products and aggregate sums; amounts stored/transferred as settlement minor units. Invalid input and unsafe output are rejected. Rounding contract: floor once per holder in minor units; sum those holder amounts. UI USD values are presentation only.
- Full browser coupon lifecycle: snapshot → holder transfer → calculation → explicit approval → checked payment instructions → signed Memo receipt → reload.
- RPC failure and invalid snapshot account abort before signing. Unavailable current balances show unknown; allocation and payment fail closed rather than using RPC-error zeroes.
- Explicit approval rejection keeps settlement locked. Corrupted cached entitlement amounts cannot alter the payout; the client recomputes from snapshot units before preparing payment.
- Settlement signature is persisted immediately after broadcast, before confirmation. Failed confirmation blocks repeat payment across reload and cannot finalize a receipt.
- Visible IMPLEMENTED/client-owned boundary and SIMULATED offline oracle label.

## UC / FR / TC evidence

| TZ requirement | Automated evidence | Meaning and remaining boundary |
| --- | --- | --- |
| UC-CP-01; §22; TC-01/02/03/05 | `coupon-precision.spec.ts`, `golden-domain.spec.ts`, `bridge-lifecycle.spec.ts` | Required four-holder scenario plus independent historical regression. Formula, zero D, snapshot/current separation and aggregate amounts; no protocol claim. |
| FR-01–04 | Deployment resume browser test | Existing mint/accounts are read, allocations are not minted twice. Fresh real mint creation and distribution remain manual Devnet acceptance. |
| FR-02/09 | Instrument parameters, four holder UI, full lifecycle and unavailable-balance tests | Client metadata/current RPC balances; no Instrument PDA or protocol registry. |
| FR-10/12/14/15; TC-03 | Full lifecycle, snapshot RPC failure and wrong-owner tests | Contextual RPC slot, timestamp, hash and validated source accounts are sent in Memo; transfers leave cached snapshot unchanged. No scheduled record-date enforcement or transfer pause. |
| FR-16/20/22; TC-01/02/05 | Precision tests, expected total 850 and decoded settlement instructions | Integer client calculation and sum, amount overflow/input rejection. FR-21 program-owned entitlement remains open. |
| FR-23/24; TC-15 client boundary | Wallet gating, restored approved action, rejected approval, adapter changed-account check | Distribution shown before explicit test-wallet approval; no transaction submits after rejected signature. No on-chain authority enforcement. |
| FR-25/26/27; TC-04 client boundary | Full lifecycle, corrupted amount, insufficient treasury, pending-signature reload and confirmation failure | Decoded transfers result in expected controlled RPC balances; UI/client guard blocks repeat payment. Protocol idempotency remains open. |
| FR-38/39/40/41 | Unique client action ID, six ordered Memo payloads, Explorer links, final receipt and reload | Browser state and signed Memo references; ActionReceipt PDA, full protocol events/history remain open. |
| TC-18 client boundary | Insufficient treasury simulation | No payment submission or receipt; not a validator funding/atomicity test. |
| TC-16/17/19 | No protocol acceptance claimed | Immutable PDA snapshot, program transitions and safe partial protocol batches require M1.1–M1.6. |
| FR-05–08/11/13/21/42 | Not fulfilled by this client change | Supply registry/control, program authorization/immutability, authoritative stored rights and a complete auditor view remain protocol/product work. |
| UC-BR-01, UC-VOTE-01 | Out of R1 | Phase 2; no redemption or voting completion claimed. |

## NFR evidence

| TZ NFR | R1 evidence | Limit |
| --- | --- | --- |
| 01 Determinism | Both golden inputs, exact totals, snapshot/current independence | Client contract only. |
| 02 Precision | BigInt products/sums, minor-unit rounding, invalid/overflow tests | Solana program calculation/validation is not implemented. |
| 03 Idempotency | Completed UI steps disabled; pending broadcast signature survives reload | localStorage can be modified/lost; protocol once-only payment is open. |
| 04 Authorization | Wallet/account checks, explicit approval, user rejection | Operator authority and holder registry constraints on-chain remain open. |
| 05 Auditability | Six Memo stage references and Explorer links | Test signatures are synthetic; real signatures must be retained through manual acceptance. |
| 06 Immutability | Transfer does not mutate the client snapshot; source errors abort | Browser storage is mutable; protocol snapshot immutability is open. |
| 07 Atomicity | Simulation failure submits nothing; payment transfers are prepared in one transaction | Harness is not a validator; real transaction and protocol atomicity require separate acceptance. |
| 08 Recoverability | Deployment resume, bounded RPC retries, persisted payment ambiguity guard | Pending payment requires manual reconciliation; settlement-rail partial setup and batch recovery remain open. |
| 09 UX clarity | Holder current/snapshot/entitlement/payment fields, formula/pipeline, proof links and explicit boundaries | Complete Investor/Auditor journeys remain outside R1. |
| 10 Reproducibility | npm scripts, lockfile, CI, Linux dependencies, two documented golden contracts | A fresh-origin real Phantom/Devnet replay is still required. |
| 11 Protocol truth | Trust boundary displayed and documented | Not satisfied: Browser/Memo state must move to Anchor. |
| 12 Key safety | Operator key stays in Phantom; test operator exists only in test process | Disposable holder secrets remain in localStorage; no production custody claim. |

## Run and interpret results

```bash
npm ci
npx playwright install --with-deps chromium
npm run build
npm run test:e2e:golden
```

On Linux, Playwright system dependency installation may require sudo. Use a fresh browser profile/origin for the TZ §22 live demo; the old 35-unit deployment is retained and is not converted into the new allocation. Do not erase an existing live action or payment reference to retry an uncertain payment.

The automated gate contains domain/precision, browser UI/full workflow, transaction-adapter and RPC tests. Browser workflow tests intercept Devnet HTTP/WebSocket transport, install a test wallet, decode the client's versioned transactions and apply checked-transfer amounts to controlled token-account responses. They do not submit real transactions, emulate protocol constraints, or prove Phantom extension compatibility. Negative-test error logs are expected when the associated test passes.

Local verification on 2026-10-06: TypeScript/Vite build passed; 35/35 Playwright tests passed in 48.2 seconds. CI and human-signed Devnet acceptance are separate checks and are not claimed by this local result.

## Remaining R1 release evidence

- Real Phantom/Devnet replay and recorded mint, snapshot metadata, six stage signatures and exact payout deltas: [manual acceptance](MANUAL_DEVNET_ACCEPTANCE.md).
- Deployment secrets, merged-PR deployment and working preview: external operations, not inferred from local checks.
- Ambiguous payments: inspect saved `pendingSettlementSignature` in Explorer/RPC and reconcile destination deltas. A confirmed successful payment must be reconciled into confirmed client state before receipt finalization; no automatic retry or local reset is a reconciliation procedure.
- Partially created settlement rail: no automatic safe resumption claim. Protocol recovery/idempotency remains in M1.4.

TZ is unchanged. This R1 follow-up does not mark the full Phase 1 protocol milestones or hackathon MVP complete.
