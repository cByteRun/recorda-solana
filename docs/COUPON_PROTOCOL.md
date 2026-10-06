# Coupon Core — M1.1–M1.6

Scope: TZ §§8–12,15–18,20,22–23; UC-CP-01. Redemption and Voting
execution remain Phase 2. Principal/final-coupon/voting-power fields are
shared right contracts, not implemented redemption or voting instructions.

## Local setup

Requirements: Node >=22.12, host Rust 1.90 (pinned in CI), a C compiler and
system development libraries, Solana CLI/SBF tools 2.3.0. Anchor crates and
TypeScript client are pinned to 0.32.1; Cargo.lock pins transitive packages.
Anchor CLI is optional: scripts compile IDL directly from Anchor macros.
Solana 2.3.0 is the [Anchor 0.32.1 recommended version](https://www.anchor-lang.com/docs/updates/release-notes/0-32-1).

```bash
npm ci
cargo fetch --locked
npm run protocol:test:rust
npm run protocol:build
npm run protocol:idl:check
npm run build
npm run protocol:test:ui
npm run test:e2e:golden
```

After changing the program's public interface run `npm run protocol:idl`
and include both generated files. `protocol:idl:check` compares generated
output to tracked JSON/types without rewriting files.

`protocol:test:ui` starts a fresh validator, loads target/deploy/recorda.so
at the IDL address, runs the integration oracle, then the browser suite.
RPC is 127.0.0.1:18899; faucet 19900; Vite 4445. These ports must be free.
It stops the validator and retains its ledger in the printed /tmp path.
No real Phantom wallet or operator secret is used in automated tests.

For a human local replay, after building/generating IDL:

```bash
solana-test-validator --reset --ledger /tmp/recorda-manual-ledger \
  --bpf-program Fg6PaFpoGXkYsidMpWxTWqkZ7FEfcYkgMQHGhUhF9J3x target/deploy/recorda.so
```

In another terminal:

```bash
VITE_SOLANA_RPC_URL=http://127.0.0.1:8899 npm run dev
```

Open `/protocol`. Configure a compatible test wallet for that local RPC,
fund its public address with local SOL, and connect. Create the demo
instrument (A/B/C/D 10/5/2/0), schedule a future record timestamp, begin and
finalize snapshot after that time, transfer A→B:4, calculate rights, approve,
fund the mock payment vault, settle and finalize. Audit without a wallet
by opening `/protocol?action=<Action PDA>`, including in a fresh browser.
For Devnet, deploy a matching program first; source declare_id!, Anchor.toml,
generated IDL, deployment keypair and VITE_RECORDA_PROGRAM_ID must agree.
The default local test address does not establish a Devnet deployment.

## Program guarantees and deliberate restrictions

- Instrument PDA controls mint/freeze authority. Bond accounts stay frozen
  outside the program's atomic thaw → transfer_checked → freeze CPI path.
  Transfers require holder signature and two approved registry positions.
- Registered token-account close authority is Instrument PDA, preventing
  an empty holder account from disappearing and blocking future snapshots.
- Mock settlement mint is plain Token-2022 with two decimals; extensions
  that can change credited amounts are rejected. Monetary values are u64
  minor units; coupon products use checked u128 and floor once per holder.
- A scheduled record timestamp blocks transfers and registry changes as
  soon as chain time reaches it, even if begin_snapshot is late. One
  scheduled/pending snapshot per instrument prevents conflicting barriers.
  Scheduled coupons can be cancelled by authority, releasing the barrier.
- Snapshot capture freezes the instrument until every approved holder and
  the full outstanding supply are accounted for. Finalization releases the
  barrier for subsequent coupon transfers. Capture slot/time and scheduled
  timestamp are both stored; this is the controlled snapshot from TZ §9.2,
  not production historical indexing.
- SnapshotPosition is represented by immutable snapshot fields inside
  EntitlementPosition, allowed by TZ §§9/18. snapshot_index makes the
  sequential snapshot commitment independently reproducible.
- Registration/issuance is sealed at the first snapshot. Approval changes
  require a zero balance, preserving eligible outstanding supply. Issuer and
  operator share one authority, as allowed for MVP by TZ §6.
- Calculation/approval/funding/execution/finalization validate authority and
  lifecycle. A failed instruction rolls back both CPI tokens and program
  state. EXECUTING stores partial progress; resume reads unpaid PDAs.
- Every payment stores actual paid minor units, destination and slot. A
  receipt is created only after all holders (including zero holders) are
  processed and obligation equals settlement. State transitions emit events
  with slot/time; transaction signatures are queried from RPC.

## Client and independent proof

The lazy `/protocol` page consumes compiler-generated IDL/types. It displays
scheduled/capture dates, formula, current versus record-date holdings,
rights, payment destinations, action history, transaction links and receipt.
Direct action/instrument/receipt reads validate Recorda account ownership and canonical instrument/action PDAs. Finalized truth comes from chain reads; localStorage stores only optional
address references and disposable test-holder keys. The operator secret is
never stored. References are scoped to RPC and program ID.

`protocol-audit.ts` independently checks holder formula/contracts, snapshot
ordering/hash, aggregate units, processed/calculated counts, settled amounts,
receipt identity/status/totals/hash and outstanding supply. Current payment
token balances are not equated with historical paid amounts: a holder may
spend funds after settlement. Test signing and Mock USD issuance are simulated
wallet/asset roles; Anchor state and Token-2022 CPIs execute on the validator.
The existing `/` Browser/Memo reference remains a separate R1 flow.

## Verification and evidence

| Milestone | FEATURES / evidence |
| --- | --- |
| M1.1 | Workspace, Instrument/HolderPosition, issuance, registry/revoke/approve, frozen transfer control, account/mint validation |
| M1.2 | Scheduled record barrier, cancellation, authorized snapshot, supply/holder completeness, immutable units and slot/time/hash |
| M1.3 | Checked coupon, per-holder/aggregate rights, principal/final-coupon/voting contracts; rounding/overflow rollback |
| M1.4 | Approval, funded vault, CPI settlement, destination validation, failed-payment rollback, repeat rejection, resume |
| M1.5 | Receipt/events, holder payment references, instrument action history, independent read-only formula/hash audit |
| M1.6 | TZ §22 and historical golden actual PDA/token checks; security negatives and real-validator browser reload/resume |

`protocol-tests/coupon.test.mjs` covers TC-01–05 and TC-15–19. Expected
values come from both existing golden fixtures; actual units, entitlements,
credited token balances and receipt are read independently from RPC.
Negatives also cover wrong mint/accounts, revoked recipient, direct transfer,
external thaw/closure, pre-record snapshot, post-record pre-snapshot mutation,
competing scheduled snapshots, invalid parameters and overflow.

`protocol-ui-tests/coupon.spec.ts` drives the real lifecycle with a controlled
signer against actual validator RPC, checks golden payouts, rejects one
partial-batch signature, reloads/resumes unpaid positions, verifies final
hashes/history, clears localStorage and reopens read-only proof. A corrupted
receipt RPC response must render reconciliation failure; a wrong program owner clears the report and fails closed.
`audit.spec.ts` independently verifies golden commitments and detects forged
amounts even when aggregate sums/receipt are internally consistent.

Generated evidence: target/protocol-evidence/coupon.json (expected versus
actual holders, signatures, binary/source/IDL hashes), coupon-ui.json and
coupon-ui.png; Playwright reports/traces. CI uploads them. Old evidence is
removed before a new run, and failed integration subtests cannot emit success.
These artifacts are ignored locally; never commit keypairs or ledgers.

Verification on 2026-10-06: Rust 4/4, protocol integration 16/16, protocol browser/audit 4/4, R1 golden 35/35; production build and compiler IDL consistency check pass. ROADMAP records this Local Validator scope.
Local-validator acceptance does not imply a Devnet deployment, human Phantom
acceptance, a complete security review or completion of the three-scenario MVP.
