# BondOps program workspace

Recorda helps the operator control fixed investor rights → obligations → authorized execution → confirmation → evidence-backed resolution. [TZ](TZ.md) and existing FR-01–58 remain the protocol source of truth; appended BO requirements cover the operating workspace.

## Storage boundary

| Selected workspace | Source of financial facts | Source of operational state | Writes |
|---|---|---|---|
| Test Workspace | Explicit illustrative dataset, 17 units and 850 Mock USD | SQLite, only the `demo` row | Local sandbox API; predefined demo roles |
| Solana program / Devnet RPC | Existing finalized Recorda action/right/receipt accounts | Rust PDA accounts in the same Recorda program | Wallet-signed instructions; authorization checked by Rust |
| Solana program / Local validator | The same compiled Rust program on a separate local ledger | The same PDA schemas | The same wallet-signed instructions |

Live mode performs no Test Workspace API requests and stores no live data in SQLite. A Node server started with `BONDOPS_MODE=live` opens no database. SQLite is initialized lazily only when the illustrative workspace is enabled. Existing old `live` or `team-live` database rows are not read or migrated as authority; importing real metadata would require explicit wallet-signed program instructions.

The source selector and RPC selector are independent. RPC choice is stored in the browser and reinitializes the application; dashboard, protocol, corporate actions, holder claims and explorer links share it. Local validator is a separate network, not a workaround endpoint for the Devnet ledger. Default URLs are `https://api.devnet.solana.com` and `http://127.0.0.1:8899`. Custom endpoints come from `VITE_SOLANA_RPC_URL` / `VITE_LOCAL_SOLANA_RPC_URL`, or corresponding Next public variables. Public RPC rate limits and network errors never activate fixtures.

## Rust account and instruction contract

`programs/recorda/src/bondops.rs` adds accounts without changing legacy financial account layouts:

| Account | PDA domain / purpose |
|---|---|
| OpsWorkspace | `ops-workspace`, instrument: admin, reminder/escalation hours, next audit sequence |
| OpsMember | `ops-member`, workspace, wallet: per-instrument role and revocation |
| OpsDeadline | `ops-deadline`, workspace, action: explicit coupon deadline; voting/maturity remain native action terms |
| OpsCase | `ops-case`, workspace, action, holder: assignment, investigation/resolution, last note, retained signature |
| OpsAudit | `ops-audit`, workspace, sequence: immutable decision records, actor, action/subject, Clock time/slot and note |
| OpsNotice | `ops-notice`, workspace, action, recipient, kind, stamp, subject: deduplicated inbox record and read acknowledgement |

Instructions: `initialize_ops`, `configure_ops`, `set_ops_member`, `set_ops_deadline`, `update_ops_case`, `retain_ops_reference`, `create_ops_notice`, `read_ops_notice`. The IDL is compiler-generated via `npm run protocol:idl`.

Only instrument authority or the configured governance issuer can initialize its workspace. The workspace admin manages membership/rules; active Operator/Reviewer members can investigate and schedule. Auditor reads public chain data. Recipient signature is required to acknowledge a notice. These operational roles do not grant financial approval/burn/payment authority; existing protocol/governance checks remain authoritative.

Every metadata write includes the expected audit sequence and atomically creates an immutable audit PDA. Concurrent stale updates fail and must reload before another signature. Wrong instrument/action/right/holder binding is rejected by program ownership, discriminators and canonical PDA checks. Closing a case requires a calculated positive matching right whose processed/settled flag is set by the financial engine. Comments and stored signatures never establish payout.

Retained references are metadata. The browser verifies the transaction's exact settle instruction and action/right before proposing the reference instruction. Rust does not inspect historical RPC transactions and does not trust a provided status as financial confirmation. Replacement of an unresolved reference is conservatively blocked; a dedicated authenticated failure-recovery protocol remains future scope. Confirmation amounts always come from finalized rights. Historical transaction pruning remains visible as Unknown. If RPC fails after a successful read, last known obligations remain in browser memory with confirmation reset to Unknown; this is disclosed stale state, never SQLite persistence or freshly confirmed execution.

Names and decision notes written on-chain are public. Names are bounded to 80 UTF-8 bytes, notes to 240; history is held in separate append-only accounts. Solana rent/fees apply to operational writes. No backend signing key is used.

## Notifications and timeliness

The calendar distinguishes cutoff, coupon payment deadline, native voting close and redemption maturity. `create_ops_notice` checks Solana Clock, authoritative deadline or open case, recipient and reminder/escalation rules. Notice PDAs deduplicate by subject, deadline/case timestamp, type and recipient. A changed schedule supersedes old reminders in the displayed inbox; old records remain auditable.

A program does not autonomously run when the clock advances. **Check deadlines** submits signed notice transactions for authorized instruments. A reliable keeper/automation signer, autonomous generation and email/messenger delivery remain roadmap tasks. The Test Workspace alone has a local minute scheduler. UI polling is read-only.

## Filled Test Workspace

The example contains the TZ positions 10/5/2/0, a post-cutoff transfer of four units (current positions 6/9/2/0, unchanged entitlements), coupon calculation 500/250/100/0, approval/funding, illustrative confirmations totalling 350, failed/pending attempts and a current Unknown 500, assigned investigation/history, upcoming voting and maturity, calendar and inbox. All transaction identifiers are `TEST-TX-*` examples, never explorer proof. Old demo databases receive example history without discarding saved decisions.

## Run and configure

```bash
npm run protocol:build
npm run bondops:local
# Keep the local validator running; in another terminal:
npm run dev
```

Choose **Solana program**, then **Local validator**. `bondops:local` loads `target/deploy/recorda.so` at the configured program address, creates an isolated ledger under ignored `target/`, seeds real example transactions and stays running on port 8899. Set `RECORDA_LOCAL_WALLET=/path/to/a/local-test-key.json` to use a local fixture authority matching your Phantom public key; otherwise the fixture uses a disposable local signer. It never resets another ledger or funds Devnet. Ports must be free.

To use public Devnet, deploy/upgrade the new program binary with its existing authority, use a Devnet wallet and choose Devnet RPC. No public Devnet deployment or upgrade has been performed by this revision. A successful local test does not certify the currently deployed Devnet binary or human Phantom acceptance.

For the illustrative workspace only, Node 22.18+ and `BONDOPS_MODE=demo`, `BONDOPS_DB_PATH=target/bondops/test-workspace.sqlite`, exact `BONDOPS_ORIGINS` configure the local API. Vite reads root `.env.local`; Next reads `next-app/.env.local`. `BONDOPS_BACKGROUND=false` disables only the demo minute worker. No BONDOPS_MEMBERS / server live RPC configuration is needed. Production defaults to Solana-only mode; a static browser host can serve live mode without a BondOps database/API. The current Test Workspace is enabled only in development; a public demo hosting mode is separate future scope.

## Verification

- `npm run test:bondops`: Test API security, persisted demo decisions, deadline/inbox deduplication, no live/team rows, no database opened in Solana-only mode; exact settle-instruction confirmation decoding and genesis rejection.
- `npm run protocol:test:bondops`: real local-validator transactions for initialization, membership/revocation, scopes, deadlines, cases, proof-gated closure, immutable audit, conservative reference retention and recipient-only deduplicated notices.
- `npm run protocol:test:bondops:ui`: same fixture plus browser → wallet signature → local Rust program → fresh account read; Test API disabled, zero workspace API requests.
- `npx playwright test --config playwright.bondops.config.ts`: filled Test Workspace, source/RPC separation and desktop/mobile layouts.
- `npm run protocol:build`, `npm run build`, `npm run build:next`: SBF stack checks, shared frontend and Next compilation.

Bank/paying-agent provider, external delivery, autonomous keeper, public Devnet deployment/acceptance and complete archival/scale validation remain open. Provider selection for banking is explicitly deferred by the user.

Recorded verification for this revision: SBF build and compiler-IDL check passed; 15 Rust unit tests, 9 local program checks, 8 Test API/reader checks, 14 illustrative/desktop/mobile browser checks and one end-to-end browser-to-program test passed. The latter also verifies retained Unknown obligations after RPC loss and zero Test API requests. Vite and Next builds passed. Evidence: `target/protocol-evidence/bondops.json` and `target/design-evidence/bondops-local-program.png` (ignored generated artifacts).
