# BondOps operational layer

Recorda helps an operator control the whole process: fixed investor rights → financial obligation → authorized execution → confirmation → exception resolution with evidence. The normative additions are BO-01–07 in [REQUIREMENTS](REQUIREMENTS.md); protocol FR-01–58 and the three MVP scenarios remain unchanged.

## Delivered scope and boundaries

| Business feature | Frontend | Backend / source | Remaining acceptance |
|---|---|---|---|
| Timeliness | `/calendar`: month calendar, upcoming/overdue/unscheduled queue, timezone display and coupon deadline editor | Durable operator-set coupon due date; voting close and redemption maturity from contract; minute scheduler | Operator validation on a configured live portfolio; SLA/holiday policy |
| Live reconciliation | Dashboard and `/settlements`: Expected / Confirmed / Unsettled / Unknown, separate asset groups | Finalized program reads plus existing independent auditors; never infer execution from current wallet balance | Public Devnet smoke was blocked by RPC 429; configure a reliable RPC and perform live acceptance |
| Exception investigation | Fixed units, cutoff, formula, principal/coupon, approval/funding, right/signature/receipt and permitted next step | Action/right binding; retained broadcast references; exact settle instruction binding | Live Phantom recovery demonstration |
| Confirmation states | Due / Pending / Failed / Unknown / Confirmed filters | Finalized processed right confirms execution; retained transaction failure or unfinalized broadcast yields Failed/Pending; missing/pruned/RPC failure is Unknown | Provider/finality operational SLA |
| Case management | Assignment, comments, investigation status and resolution history | SQLite transactions, stable action+holder case key, proof-gated closure and automatic verified resolution/reopening on evidence loss | Real team acceptance; no manual status can change entitlement or pay assets |
| Portfolio | `/bonds`: terms, outstanding/retired supply, action kinds and links to operational workflows | Discovery of configured instrument scopes from Recorda accounts; v1 Coupon and v2 actions | Scoped live indexing capacity and larger portfolio measurements |
| Portfolio audit | `/audit`: searchable retained events, paging, cases/actions, receipt links and source-labelled JSON export | Durable observation/decision journal; existing action audit exposes chain proofs and historical availability | Full archival coverage/production retention; observation journal is not a claim of complete chain history |
| Team operations | `/settings`: roles/scopes, wallet membership management, reminder/escalation rules; `/notifications`: inbox | Ed25519 nonce sign-in; server membership and scope checks; HttpOnly/SameSite session plus CSRF/origin validation; in-app outbox | Organization identity/SSO and external delivery providers |
| Settlement connectors | `/infrastructure`: active source and integration boundary | Solana finalized reader implemented | Bank/paying-agent provider explicitly deferred by user; no bank confirmation is fabricated |

Demo is a separate, labelled server workspace: 10/5/2/0 rights, coupon 500/250/100/0, illustrative confirmed 350 and unknown 500 Mock USD. Case, deadline and inbox changes persist on the server, but demo financial confirmations are fixtures. Switching to Devnet clears the preview and requires an authorized wallet session; failed live requests do not fall back to fixtures.

## Run and configure

Node **22.18+** is required; this implementation uses built-in `node:sqlite`. `npm run dev` builds a server copy of the shared protocol readers/auditors and mounts `/api/bondops` in Vite. Restart an already-running dev server after adding the API plugin; client hot reload alone does not install a middleware in an old server. `npm run dev:next` uses the same API through a Node Route Handler. Both share the browser screens.

For Devnet, configure these **server-only** values in root `.env.local` for Vite or `next-app/.env.local` for Next; shell environment takes precedence:

```dotenv
BONDOPS_MODE=demo
BONDOPS_DB_PATH=target/bondops/workspace.sqlite
BONDOPS_ORIGINS=http://127.0.0.1:4444,http://localhost:4444
BONDOPS_RPC_URL=https://api.devnet.solana.com
# Match the browser's program and RPC; this is a public program address.
BONDOPS_PROGRAM_ID=CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF
# Replace the wallet/scopes with your actual public addresses. No private keys.
BONDOPS_MEMBERS=[{"id":"operator-1","name":"Operator","wallet":"YOUR_PUBLIC_WALLET","role":"operator","scopes":["*"]}]
```

`BONDOPS_MEMBERS` bootstraps a **new or still empty team only**. Subsequent membership additions/updates/revocations are retained in the database and managed by a full-scope Operator in Settings. A role change does not grant program signing authority. Wallet identity changes/revocation invalidate an old session. Auditors can read scoped evidence and mark their own inbox items read; they cannot update cases, schedules or team settings. Reviewers reconcile and investigate; only a full-scope Operator administers team/rules. Demo login is a loopback-only sandbox convenience and is disabled in production.

Production uses `BONDOPS_MODE=live`, an explicit **persistent** database path, exact HTTPS `BONDOPS_ORIGINS`, HTTPS and configured wallet membership. No ephemeral database fallback is allowed. The delivery envelope is one long-running Node service and a persistent SQLite volume; this is not a horizontally scaled or serverless storage architecture. Use `npm run bondops:serve` with a same-origin reverse proxy, or a persistent Node Next host. The minute scheduler requires a running service. No deployment/provisioning, production backup/retention validation, SSO, bank provider, email or messenger delivery has been performed. Vite static build/preview by itself does not serve the API; run the operational backend alongside the served frontend. A serverless deployment needs a durable database and an independently scheduled worker before production acceptance.

`BONDOPS_BACKGROUND=false` disables the minute worker for deterministic tests; authenticated `/sweep` evaluates notifications without paying anything. `/refresh` re-reads the configured portfolio; it does not sign transactions. SQLite and generated runtime files are under ignored `target/`; no operator private key is stored.

## API and evidence contract

Every workspace endpoint accepts `?source=demo|live`. Live reads require a wallet session; mutations additionally require a permitted role, exact Origin and `X-BondOps-CSRF`. API responses never expose RPC credentials. Live indexing verifies the pinned Devnet genesis and uses the configured public program ID. Monetary amounts are decimal strings in integer minor units, grouped by settlement mint and precision; Voting contributes no payment obligation. Known-calculated obligations are shown; an incomplete/unavailable snapshot must not be interpreted as a zero obligation.

| Endpoint | Behavior |
|---|---|
| `GET /session` | Available sources, authenticated member and session CSRF token |
| `POST /auth/challenge`, `/auth/verify` | Origin-bound, expiring, single-use Ed25519 wallet login |
| `POST /auth/demo`, `/auth/logout` | Explicit local sandbox login / session logout |
| `GET /workspace`, `/export` | Scoped portfolio, deadlines, rights, cases, retained evidence, settings and own inbox / source-labelled export |
| `POST /refresh` | Reuse protocol audits and reconcile finalized portfolio; persist unknown evidence on failure |
| `POST /schedule` | Set an explicit timezone-qualified coupon payment deadline after its record date; no contract rewrite |
| `POST /cases` | Assign an eligible operator/reviewer, retain decision note; prohibit closure without matching verified execution |
| `POST /reference` | Retain and verify an already-submitted signature against exact action/right/settle instruction; never broadcast a payment |
| `POST /members` | Full-scope operator membership change/revocation; retain audit atomically; no self-revocation |
| `POST /settings` | Full-scope operator reminder/escalation intervals |
| `POST /sweep`, `/notifications/read` | Deduplicated in-app reminders/escalations / recipient-only read acknowledgement |

A Pending/Unknown broadcast prevents replacement with another signature until reconciled. A processed finalized program right is authoritative execution evidence under the documented RPC trust assumption; unavailable historical transaction data remains disclosed. A balance alone, an external proposal, a case comment or a manual closure never establishes payout. Confirmation loss reopens a previously resolved case for investigation. Actual corrective execution remains in `/protocol` or `/actions` with the existing lifecycle, wallet signer and replay checks. Recorda's Node service stores no signing authority and introduces no new automatic payment path.

## Verification

- `npm run test:bondops`: backend financial grouping, real Ed25519 login, origin/CSRF/replay, scope/revocation, durable restart, proof-gated case closure, unknown recovery, pending reference protection, source binding, deadline and notification deduplication tests.
- `npx playwright test --config playwright.bondops.config.ts`: isolated port 4446 and SQLite workspace; browser → API → durable cases/deadlines → response, source-labelled exports, role restrictions, inbox, Devnet sign-in boundary and 1440/390/320px layouts; includes existing dashboard/holder checks.
- `npm run build` and `npm run build:next`: shared browser and Node route compilation.
- Read-only public Devnet discovery attempted 2026-10-12 returned **429 Too Many Requests**. This does not establish successful live indexing or payment acceptance. A configured live wallet/portfolio and reliable RPC are still required.
