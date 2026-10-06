# Implementation plan — Move Corporate Action Truth On-Chain

**Status:** next implementation phase after the proven Devnet v4 coupon prototype.  
**Source of truth:** [`TZ.md`](TZ.md).  
**Roadmap:** [`ROADMAP.md`](ROADMAP.md).

---

## 1. Current verified baseline

The reference prototype at [`../prototype/kase-real-devnet-v4-kusd.html`](../prototype/kase-real-devnet-v4-kusd.html) has already proven the coupon business flow with real Solana Devnet state.

### Real today

- Token-2022 KZB26 mint.
- Real holder keypairs A/B/C.
- Real KZB26 token accounts.
- Real initial balances `10 / 20 / 5`.
- Real post-record Token-2022 transfer `A → B: 4` resulting in `6 / 24 / 5`.
- Phantom operator signatures.
- Token-2022 KUSD-DEV settlement asset.
- Real settlement `500 / 1000 / 250 KUSD`.
- Real transaction signatures / Explorer evidence.
- Black-box E2E oracle with `pass=true`.

### Bridge / not final protocol truth

- Browser decides when a snapshot is valid.
- Snapshot is persisted as a signed Memo attestation rather than program-owned snapshot state.
- Browser calculates coupon entitlement.
- Approval is a signed Memo rather than a program state transition.
- Receipt is a signed Memo rather than a Recorda-owned PDA.
- Disposable holder private keys / action references live in browser localStorage for the single-file demo.

The next phase removes this trust gap without changing the successful business outcome.

---

## 2. Target trust boundary

### Current

```text
Token-2022 real balances
        ↓
Browser financial logic
        ↓
Memo attestations
        ↓
Token-2022 KUSD settlement
```

### Target

```text
React / test client
        ↓ instructions
Recorda Anchor Program
        ├── validates authority and state
        ├── owns record-date snapshot state
        ├── calculates fixed-point entitlement
        ├── prevents invalid/double execution
        ├── performs Token-2022 CPI
        └── finalizes receipt state
        ↓
Token-2022 KZB26 / KUSD-DEV
```

**Rule:** finalized financial truth must be derivable from Solana program-owned state, not localStorage or UI variables.

---

## 3. Repository target structure

```text
recorda-solana/
├── Anchor.toml
├── Cargo.toml
├── package.json
├── programs/
│   └── recorda/
│       └── src/
│           └── lib.rs
├── tests/
│   ├── coupon-happy-path.ts
│   ├── coupon-post-record-transfer.ts
│   ├── authorization.ts
│   └── idempotency.ts
├── app/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   └── idl/
│   └── ...
├── docs/
├── golden/
└── prototype/
```

### Stack

- Solana Devnet during MVP.
- Anchor / Rust for custom protocol.
- Token-2022 for bond and KUSD-DEV settlement assets.
- TypeScript integration tests.
- React + Vite + TypeScript for the maintainable client.
- Tailwind for UI.
- Phantom as operator wallet in the hackathon demo.

Do **not** migrate UI first. Create only a thin React shell until protocol interfaces/IDL stabilize.

---

## 4. Minimal on-chain data model

### `Instrument`

```text
instrument_id
issuer_authority
operator_authority
bond_mint
settlement_mint
face_value_minor
currency_code
coupon_bps
payments_per_year
maturity_timestamp
outstanding_supply
redeemed_supply
status
```

Financial values use integer/fixed-point representation only.

### `HolderPosition`

```text
instrument
holder_wallet
approved
created_at
revoked_at
```

For the hackathon, this is a minimal registry. Rich Token ACL integration is Post-MVP unless needed earlier.

### `CorporateAction`

```text
action_id
instrument
action_type
record_date
payment_date
status
snapshot_total_units
total_entitlement_minor
total_settled_minor
created_by
approved_by
created_at
approved_at
finalized_at
```

Initial action types:

```text
COUPON
REDEMPTION
VOTING
```

### `SnapshotPosition`

```text
action
holder
holder_token_account
units
snapshot_slot
snapshot_time
```

For MVP use one position per holder. Merkle root scaling is Post-MVP.

### `EntitlementPosition`

```text
action
holder
snapshot_units
amount_minor
settlement_mint
destination_token_account
status
settled_amount_minor
calculated_at
settled_at
```

### `ActionReceipt`

```text
action
instrument
record_date
snapshot_total_units
holders_count
total_entitlement_minor
total_settled_minor
settlement_mint
status
finalized_at
```

Transaction signatures are normally resolved by the client/indexer from transactions/events instead of being copied into protocol state unless a specific protocol need appears.

---

## 5. Proposed PDA seeds

Exact seeds can change during implementation, but they must be deterministic and collision-safe.

```text
Instrument:
["instrument", instrument_id]

HolderPosition:
["holder", instrument, holder_wallet]

CorporateAction:
["action", instrument, action_id]

SnapshotPosition:
["snapshot", action, holder_wallet]

EntitlementPosition:
["entitlement", action, holder_wallet]

ActionReceipt:
["receipt", action]
```

---

## 6. Instructions — Coupon first

Implement only the Coupon vertical slice before Redemption/Voting.

### `initialize_instrument`

- validate bond mint / settlement mint;
- write financial parameters;
- assign authorities.

### `register_holder`

- operator-only;
- create/activate `HolderPosition`.

### `create_coupon_action`

- operator-only;
- initialize state as `DRAFT`;
- bind instrument and record/payment dates.

### `snapshot_holder`

- require action in snapshot phase;
- require approved holder;
- validate holder Token-2022 account and mint;
- derive/store snapshot units from validated account state/mechanism;
- never accept arbitrary finalized balance as trusted UI input.

### `finalize_snapshot`

- operator-only;
- freeze snapshot set for the action;
- transition to `SNAPSHOTTED`.

### `calculate_entitlement`

Program-owned formula:

```text
coupon_minor =
  snapshot_units
  × face_value_minor
  × coupon_bps
  ÷ 10_000
  ÷ payments_per_year
```

- checked integer math;
- create/update `EntitlementPosition`;
- transition/action aggregation as designed.

### `approve_action`

- explicit authorized signer;
- allowed only after calculations complete;
- store approver/timestamp;
- transition to `APPROVED`.

### `settle_holder`

- require approved action;
- require entitlement not already settled;
- CPI Token-2022 `transfer_checked` from KUSD treasury to holder destination;
- mark exact entitlement settled;
- update aggregate settled amount.

### `finalize_action`

- require all required entitlement obligation settled;
- create/finalize `ActionReceipt`;
- emit finalization event;
- transition action to `FINALIZED`.

---

## 7. State machine

```text
DRAFT
  ↓
SNAPSHOTTING
  ↓
SNAPSHOTTED
  ↓
CALCULATED
  ↓
APPROVED
  ↓
SETTLING
  ↓
SETTLED
  ↓
FINALIZED
```

Invalid transitions must fail on-chain.

For batch settlement `SETTLING` can persist while individual entitlements move independently to `SETTLED`.

---

## 8. E2E-first implementation sequence

### Step A — Freeze current evidence

- Keep v4 HTML unchanged as behavioral reference.
- Keep `golden/coupon-happy-path.json` unchanged unless the TZ changes.

### Step B — Initialize Anchor workspace

- Anchor project.
- Devnet/local validator configuration.
- TypeScript integration test harness.

### Step C — Instrument + holders

- `Instrument` PDA.
- `HolderPosition` PDA.
- Reuse current Token-2022 KZB26/KUSD design.

### Step D — Record-date truth

- `CorporateAction` PDA.
- `SnapshotPosition` PDA.
- Reproduce `10/20/5` snapshot.
- Execute real `A→B:4` transfer.
- Assert live balances `6/24/5` and snapshot remains `10/20/5`.

### Step E — Financial truth

- `EntitlementPosition` PDA.
- Anchor calculates `500/1000/250` from instrument + snapshot.
- Deliberately pass wrong client expectation and verify protocol output stays correct.

### Step F — Controlled execution

- Approval constraint.
- CPI KUSD settlement.
- no-double-settlement guard.
- partial batch continuation.

### Step G — Receipt/history

- `ActionReceipt` PDA.
- events.
- per-holder action history query model.

### Step H — Golden E2E

Compare actual protocol state to the golden fixture.

Only after `PASS` move to Redemption.

---

## 9. Golden test contract

Input fixture is immutable test intent, not runtime UI state.

Expected core output:

```text
mintSupply = 35
snapshot = 10 / 20 / 5
currentAfterTransfer = 6 / 24 / 5
entitlements = 500 / 1000 / 250
settlement = 500 / 1000 / 250 KUSD
finalStatus = FINALIZED
```

The E2E test must read actual state from Solana accounts / token accounts, not from React/JS cards.

---

## 10. Negative tests required before moving on

- unauthorized `create/approve/settle` fails;
- finalized snapshot mutation fails;
- invalid state transition fails;
- second settlement fails;
- insufficient KUSD treasury fails without changing entitlement state;
- partial settlement can resume safely;
- wrong bond mint / wrong holder token account fails;
- arithmetic overflow/invalid instrument parameters fail safely.

---

## 11. React migration plan

React is useful now for maintainability, but it is **not the next product milestone**.

Create Vite/React shell in parallel after the Anchor workspace exists, then migrate screen by screen:

1. Wallet / network connection.
2. Instrument read view.
3. Holder registry/current balances.
4. Corporate Action detail/timeline.
5. Investor entitlement explanation.
6. Audit/history view.

React must consume generated Anchor IDL/types and query on-chain accounts. Avoid copying protocol state machines/calculation formulas into the UI as authoritative logic.

---

## 12. Holder history requirement

The final product must distinguish:

```text
Current asset balance
≠
Historical corporate-action rights
≠
Settlement/payment history
```

Example holder view:

```text
Investor A

Current KZB26: 6
Current KUSD: 800

Coupon #1
Record-date units: 10
Entitlement: 500 KUSD
Settled: 500 KUSD
Status: SETTLED

Coupon #2
Record-date units: 6
Entitlement: 300 KUSD
Settled: 300 KUSD
Status: SETTLED
```

This is derived from `SnapshotPosition + EntitlementPosition + action state/events`, not from the current KUSD wallet balance.

---

## 13. After Coupon protocol PASS

### Redemption

Reuse the engine and add:

- principal formula;
- final coupon;
- KUSD settlement;
- Token-2022 burn/retire/lock;
- no double redemption;
- instrument redeemed state.

### Voting

Reuse record-date snapshot and add:

- proposal;
- `voting_power = snapshot_units`;
- YES/NO/ABSTAIN;
- no double vote;
- final tally.

Only after all 3 required scenarios are stable should the project spend significant time on polish or Post-MVP scale architecture.

---

## 14. Explicitly deferred

Do not implement yet unless MVP correctness requires it:

- Merkle holder snapshots;
- production KYC/AML;
- mainnet deployment;
- order book / exchange;
- secondary trading UI;
- generic DeFi integration;
- AI/agents;
- microservices;
- production CSD replacement;
- real bank rail.


## Current delivery override (2026-10-05)

At the owner's request, React migration was brought forward before Anchor.
`feat/phase-1-react` implements the v4 Browser/Memo coupon bridge using npm,
React/Vite, Tailwind and FSD-style folders. This changes delivery order, not
TZ requirements. Current focus: CI/Playwright and React Devnet acceptance;
next protocol milestone remains M1.1–M1.6. See ROADMAP and PHASE_1_AUDIT.

## R1 test coverage update (2026-10-06)

The owner explicitly limited this change to the existing React bridge R1. Current demo uses TZ §22 A/B/C/D = 10/5/2/0; historical v4 10/20/5 expected outputs above remain a regression contract. See [R1 coverage](R1_TEST_COVERAGE.md). Client calculations use integer minor units. Browser E2E covers the full coupon workflow through controlled wallet/RPC boundaries; this does not advance the unfinished Anchor implementation or substitute for manual Devnet evidence.

## Coupon Core delivery update (2026-10-06)

The owner scoped this delivery to M1.1–M1.6 and its UI. The Anchor Coupon
vertical slice now passes Local Validator acceptance: Rust 4/4, integration
16/16 and protocol browser/audit 4/4; R1 golden regression 35/35 passes.
The implemented layout uses programs/, protocol-tests/, protocol-ui-tests/
and the existing FSD client. Snapshot fields share EntitlementPosition rather
than a separate SnapshotPosition, as TZ §§9/18 permit. A scheduled-date
barrier closes late-capture ownership changes; coupon action history and
independent formula/hash auditing are read from chain state.
See [Coupon Core](COUPON_PROTOCOL.md) for exact setup, coverage, lifecycle
restrictions and evidence. Devnet deployment/human Phantom acceptance and
Phase 2 Redemption/Voting remain open.
