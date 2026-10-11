# Recorda 🧾

### Recorda BondOps — servicing workspace for tokenized bonds

**Solana · Token-2022 · Phantom · Coupon / Voting / Redemption**

> Control coupon payments, redemptions, errors and confirmations from one workspace.

**🎯 The product value:** help issuers, paying agents and operations specialists see what is owed, what execution is confirmed, and what still requires attention. Fixed record-date rights, authorized execution and verifiable evidence underpin that servicing workflow.

**Current foundation:** issuance/registry → rights → approval/funding → execution → audit. **Operational frontend/backend:** portfolio and deadline calendar, confirmation reconciliation, durable exception cases, team permissions, audit and in-app notifications are implemented locally. Live Devnet acceptance, production hosting and bank/external delivery connectors remain open. [Setup and boundaries](docs/BONDOPS-OPERATIONS.md). [Product direction and illustrative missing-payment case](docs/PRODUCT.md) supplement TZ without replacing its required scenarios.

**Long-term direction — Recorda Infrastructure:** API/SDK for exchanges, tokenization platforms, custodians and financial developers to integrate bond-servicing mechanisms on Solana. Production reliability and market demand must be demonstrated before treating this as a proven offering.

**Record Date → Right → Controlled Execution → Verifiable Proof**

| Step | Business question | What Recorda records |
|---|---|---|
| 📸 Record date | Who held the bonds at the cutoff? | Fixed ownership snapshot |
| 🧮 Right | What is each holder owed or allowed to vote? | Per-holder payment, voting power or redemption allocation |
| ✍️ Authorization | Who approved the action or signed for their bonds? | Operator approval and required holder signatures |
| ⚙️ Execution | Did the payment, vote or retirement happen? | Token payments, vote tally or atomic burn/payment |
| 🧾 Proof | Can someone independently check the outcome? | On-chain receipt, audit and export |

**A concrete example:** A holds 10 bonds at the record date, then sells 4. A's coupon stays **10 × 1,000 × 10% ÷ 2 = 500**, even though the current balance is 6. The feature/attack audit checks this rule; the Devnet MVP demo below demonstrates three actions on one instrument.

The implemented source covers **Coupon, Voting and maturity Redemption**, plus the specified [Post-MVP FR-49–58](docs/REQUIREMENTS.md#16-functional-requirements-fr). Recorda is a B2B servicing layer for market operators, issuers/paying agents and depository infrastructure; [roadmap](docs/ROADMAP.md) separates implementation from acceptance evidence.

| 🚀 Run the demo | 🔎 Explore the product | 🛡️ Verify the implementation |
|---|---|---|
| [Devnet walkthrough](#devnet-demo--coupon--voting--redemption) | [Screens and roles](#product-screens-and-manual-acceptance) | [Feature and attack audit](#feature-and-attack-audit) |

Start with the **real Phantom/Devnet demo below**. It runs Coupon → Voting → Full Redemption on one instrument. Use `test:audit` separately to verify requirements, business features and bypass attempts, including Post-MVP.

---

## Table of contents

- [🚀 Devnet demo — Coupon → Voting → Redemption](#devnet-demo--coupon--voting--redemption)
  - [Install and prepare the program](#1-install-and-prepare-the-program)
  - [Prepare Phantom accounts and configuration](#2-prepare-four-phantom-accounts-and-envlocal)
  - [Start three terminals](#3-start-three-terminals)
  - [Expected result and evidence](#4-expected-result-and-evidence)
- [🏗️ Architecture at a glance](#architecture-at-a-glance)
- [✨ Features and business domains](#features-and-business-domains)
- [🖥️ Product screens and manual acceptance](#product-screens-and-manual-acceptance)
  - [Manual acceptance](#manual-acceptance)
- [⚙️ Technical setup](#technical-setup)
  - [Install tools and browser](#install-tools-and-browser)
  - [Deploy or update the program](#deploy-a-new-program-or-update-the-existing-one)
- [🛡️ Feature and attack audit](#feature-and-attack-audit)
- [🔧 Troubleshooting](#troubleshooting)
- [📦 CI and website deployment](#ci-and-website-deployment)
- [📚 Documentation](#documentation)

---

## Devnet demo — Coupon → Voting → Redemption

Full preparation and screen-by-screen expectations: [DEVNET-DEMO.md](docs/DEVNET-DEMO.md). Allow **20–40 minutes**, including Phantom confirmations and the voting window. Run commands from the repository root.

### 1. Install and prepare the program

Requires Node **22.18+**, npm, desktop Chromium/Chrome and Phantom. Rust **1.90** and Solana/SBF **2.3.0** are needed if building/deploying; see [technical setup](#technical-setup).

```bash
npm ci
cp -n .env.example .env.local
```

If the current Rust binary is already deployed, proceed to the wallets/configuration step. Otherwise build and [deploy or upgrade it](#deploy-a-new-program-or-update-the-existing-one):

```bash
npm run protocol:idl
npm run protocol:build
npm run protocol:idl:check
```

The repository program ID is `CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF`. Publishing the current binary is required for v2 actions; an old Coupon-only deployment is insufficient. Program ID must match Rust, Anchor configuration, generated IDL and frontend configuration. Deployment is done once per Rust update, not per test invocation. The CLI deployer and the Phantom Operator can be different wallets.

### 2. Prepare four Phantom accounts and `.env.local`

Use **one Phantom extension** with four distinct accounts: Operator and investors A/B/C. No additional Google accounts or browsers are needed. Select Solana Devnet and fund them with test SOL. Suggested balances for this demo: Operator **0.5 SOL**, each investor **0.1 SOL**; these are reserves, not exact fee quotes, and exclude CLI deployment costs. D is a disposable zero-unit holder created by the runner.

Copy Solana **public addresses** from Phantom's Receive menu into `.env.local`:

```dotenv
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_RECORDA_PROGRAM_ID=CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF
RECORDA_OPERATOR=YOUR_OPERATOR_PUBLIC_ADDRESS
RECORDA_HOLDER_A=YOUR_A_PUBLIC_ADDRESS
RECORDA_HOLDER_B=YOUR_B_PUBLIC_ADDRESS
RECORDA_HOLDER_C=YOUR_C_PUBLIC_ADDRESS
RECORDA_APP_URL=http://localhost:4444
RECORDA_BROWSER_CDP=http://127.0.0.1:9222
RECORDA_VOTE_SECONDS=900
```

Replace `YOUR_...` with actual addresses. Keep seeds/private keys in Phantom or CLI key files. `.env.local` is excluded from Git; [.env.example](.env.example) is the tracked template. Vite and Devnet runners read it automatically: no `export` or `source` needed. Runner priority is existing shell values > `.env.local` > `.env`; use a fresh terminal or remove old overrides if values appear stale. Optional `RECORDA_DEVNET_RPC` must match the browser RPC; if absent the runner uses `VITE_SOLANA_RPC_URL`. Restart Vite after editing configuration.

### 3. Start three terminals

**🖥️ Terminal 1 — frontend:**

```bash
npm run dev
```

Expected: http://localhost:4444. Keep the server running.

**🦊 Terminal 2 — Chromium with Phantom:**

```bash
chromium-browser \
  --user-data-dir="$HOME/snap/chromium/common/recorda-devnet-profile" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  http://localhost:4444
```

Use `chromium` or `google-chrome` instead if that is your installed executable. Reuse the profile containing Phantom; a new profile needs extension/account setup. Close an existing instance of that same profile before restarting with debugging flags. Install [Phantom](https://phantom.com/download), unlock it, select **Devnet and Operator**, and leave automatic confirmation disabled. Keep the browser open. Playwright's downloaded Chromium is not a substitute for this configured extension profile.

**▶️ Terminal 3 — full Devnet scenario:**

```bash
npm run test:e2e:actions:devnet
```

The runner opens its application tab and drives the buttons. **You review/confirm every Phantom prompt and switch accounts when the terminal asks.** Expect Operator → A/B/C → Operator for voting, then the same investor switching for redemption. One stage can require multiple signatures. The runner checks Devnet genesis, uses real Phantom and never requests a faucet or auto-signs.

### 4. Expected result and evidence

| Action | Expected result |
|---|---|
| Setup | One fresh instrument; A/B/C/D hold 10/5/2/0 bonds, total 17 |
| Coupon | Payments 500/250/100/0 Mock USD; finalized receipt; supply remains 17 |
| Voting | YES/NO/ABSTAIN = 10/5/2; 50% quorum met; PASSED after closing; finalized receipt |
| Full Redemption | Principal plus final coupon: 10500/5250/2100/0 Mock USD; supply 17→7→2→0; REDEEMED; finalized receipt |
| Auditor | Finalized actions reopen without connecting a wallet; Audit: Verified |

`/actions` displays human-readable Mock USD amounts and percentages; raw minor-unit totals remain under **Instrument & action details** (**100 = 1 Mock USD**). Payments use test Token-2022 tokens, not real USD or SOL. Voting records a decision without automatically changing terms. This fixture does not transfer bonds after the snapshot; the feature/attack audit tests that rule.

Success prints `PASS` and saves **`passed: true`** in `target/devnet-evidence/actions-<run-id>/run.json`, alongside action screenshots. It checks actual token balance deltas, mint supply and audited receipts. Retain the JSON, Action URLs and Explorer links for judges. Reopen `/actions?action=<PDA>` as Auditor and use **Export verified audit**; for a clean manual recovery demonstration, use another browser without Phantom.

The full runner has **no automatic resume**. On failure inspect `run.json`, `failure.png`, current Action URL and submitted signatures. A plain invocation creates a new instrument; reconcile partial progress before retrying payments. Explicit `--resume path/to/run.json` supports only interrupted pre-payment Coupon after chain validation; see [recovery rules](docs/DEVNET-DEMO.md#retain-proof-and-reopen-manually). A successful run proves this MVP Devnet scenario, not all Post-MVP operations or production readiness. The full human three-action PASS is still pending recorded evidence.

## Architecture at a glance

- [x] **React UI:** Operator manages actions, Investor signs for their rights, Auditor reads and exports proof. Vite serves development; Next shares the screens.
- [x] **Phantom → RPC → Solana:** the client prepares instructions; the wallet signs; the deployed Rust/Anchor program enforces permissions and transitions.
- [x] **On-chain state:** instrument, holder registry, fixed rights, votes and receipts live in program accounts; Token-2022 handles bond/payment balances.
- [x] **Off-chain helpers:** signed archive replay, retained Merkle proofs and external-event proposals support the specified Post-MVP flows.

Frameworks, the single project structure map and key decisions: [Architecture][architecture]. Action lifecycle: [v2 contracts][contracts]. Archive/RPC assumptions: [Operations][operations].

## Features and business domains

The KASE brief takes precedence through [TZ][spec]. Its core flow is **Instrument → Holder → Record-date Right → Authorized Action → Receipt**. Checked items mean implemented functionality with verification evidence; they do not close submission or the complete human Devnet acceptance. The core runs on Solana; payments move real on-chain mock tokens, with no real fiat value.

**Required business domains — KASE / TZ MVP**

- [x] **Test bond instrument:** issuance, face value, coupon rate/frequency, maturity and supply (FR-01–05).
- [x] **Holder registry:** registered wallets, approved positions and controlled transfers (FR-06–09).
- [x] **Record-date rights:** cutoff barrier, complete immutable snapshot and rights unaffected by later balances (FR-10–15).
- [x] **Entitlement calculation:** checked integer/minor-unit arithmetic, per-holder allocations and reconciled totals (FR-16–22).
- [x] **Coupon Payment:** fixed coupon rights, funded settlement and duplicate-payment prevention; current Devnet payments and finalized receipt verified (FR-23–27).
- [x] **Bond Redemption:** maturity principal and separate final coupon, holder-signed atomic burn/payment and reconciled retirement. Live Chromium/Phantom verification on a fresh instrument with a Devnet-cloned local program confirmed supply **17→7→2→0**, all rights processed and finalized receipt (FR-28–32,45–46).
- [x] **Bondholder Voting — selected third scenario:** snapshot voting power, unique YES/NO/ABSTAIN votes, window, quorum and final tally. Rules are covered locally; current Devnet outcome finalized with actual votes **10/0/0** (FR-33–37,47).
- [x] **On-chain outcome and verification:** action-linked parameters, rights, progress and receipts; Operator/Investor/Auditor views and wallet-free recovery. Live Redemption audit verified (FR-38–42,48).

**Recorda additions — beyond the track minimum**

- [x] **Controlled action execution:** explicit approval, immutable typed parameters, action-specific transitions, scheduled cancellation and visible resumable progress (FR-24,43–44).
- [x] **Historical distributions and holder claims:** finalized-history replay, committed Merkle allocations, approved/funded claims and expiry/reclaim (FR-49–52).
- [x] **Governance and eligibility:** separate threshold approval roles, exact authorized intents and eligibility policies (FR-53–54).
- [x] **Instrument terms management:** versioned terms, copied immutable metadata and approved modification (FR-55).
- [x] **Early/partial redemption:** per-holder retirement allocations and atomic settlement against reduced supply (FR-56). This is additional to the selected Voting scenario.
- [x] **External corporate-event proposals:** provenance-bound evidence, durable deduplication and approval before execution (FR-57).
- [x] **Recoverable audit history and export:** stable pagination, retained proof and verified exports (FR-58).

The full stable-source audit passed **216 tests**. Additional domains are covered by local suites; the latest live Redemption check does not claim their complete live acceptance. Evidence and remaining three-action Devnet/submission gates: [roadmap][roadmap].

Full feature wording and implementation/test links: [requirement checklist][features]. UC/FR/NFR/TC traceability: [requirement mapping][mapping]. Bypass and failure scenarios: [security audit][security].

## Product screens and manual acceptance

| Route | Purpose |
|---|---|
| `/` | Welcome, interactive record-date story, EN/RU copy and role perspectives → Get started |
| `/actions` | Operator workspace with Coupon → Voting → Redemption journey |
| `/protocol` | Instrument/holder setup and historical Coupon → Continue to actions |
| `/actions?instrument=<PDA>` | Create Coupon, Voting, Full or Partial Redemption |
| `/actions?action=<PDA>` | Recover action, inspect rights/results, audit/export |
| `/claims` | Verify a prepared public manifest and sign a holder-bound claim |
| `/reference` | Browser/Memo calculation reference and simulated golden example |

Welcome and visual-system decisions: [Product experience](docs/PRODUCT-EXPERIENCE.md). The welcome is an illustrative explanation, not live-chain evidence. Shared action links still open directly as Auditor; existing root `/?action=<PDA>` links retain Coupon recovery.

### Manual acceptance

Use [DEVNET-DEMO.md](docs/DEVNET-DEMO.md) for the exact accounts, buttons and expected amounts. Operator schedules → captures snapshot → calculates → approves. Coupon requires vault funding and operator settlement. Redemption requires vault funding and each nonzero holder's **Sign atomic burn and payment**; Operator completes zero allocations and finalizes the receipt. Full redemption creation requires maturity to have arrived on Solana Clock. Use a distinct reserved period for a separate final coupon.

For Voting, holders verify the proposal document hash before YES/NO/ABSTAIN. Tally is permitted after the exclusive closing boundary; abstentions count toward quorum, YES must exceed NO, ties fail. No payment vault is used. Dates in `/actions` use the browser's local timezone; the optional maturity field in `/protocol` uses ISO UTC ending in `Z`.

Auditor reads chain data and exports without signing. Choosing a frontend role grants no on-chain authority. For governed instruments, privileged operations require stored intents and configured threshold signatures; governance must be configured before the first snapshot. Claims require a prepared approved/funded distribution and retained manifest, not just an address entered into the page. See [action contracts](docs/ARCHITECTURE.md#accounts-and-lifecycle) and [operations](docs/ARCHITECTURE.md#operations-and-supported-scope).

## Technical setup

### Install tools and browser

Linux examples; Rust **1.90**, Solana CLI/SBF **2.3.0**, Anchor crates/client **0.32.1**. Anchor CLI is optional for this repository. Install Rust/Solana only when building or deploying:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.90.0
source "$HOME/.cargo/env"
sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.0/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
rustup override set 1.90.0
rustc --version
cargo --version
solana --version
cargo-build-sbf --version
```

Run `rustup override set` inside the repository. Persist the Solana PATH line in `~/.zshrc` (or `~/.bashrc`) for future terminals. [Rust installation](https://rust-lang.org/tools/install/) · [Solana installation](https://solana.com/docs/intro/installation/dependencies).

Ubuntu build dependencies and desktop Chromium:

```bash
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev libudev-dev
sudo snap install chromium
```

[Chromium installation](https://snapcraft.io/chromium). Other Linux distributions use their own package manager. The desktop browser with Phantom is separate from the Chromium installed by Playwright for controlled tests.

### Deploy a new program or update the existing one

For the currently deployed program, skip this section unless rebuilding/redeploying. A new checkout may not contain the ignored deployment keypair; restoring that keypair is necessary to control the same program ID, or generate a new one and synchronize the ID before deployment.

1. Read the program address: `solana address -k target/deploy/recorda-keypair.json`. If the file is missing and you intend to create a new program, run `mkdir -p target/deploy`, then `solana-keygen new --outfile target/deploy/recorda-keypair.json` first. Keep an existing keypair instead of replacing it.
2. Match that address in `declare_id!` in `programs/recorda/src/lib.rs`, `[programs.localnet]` and `[programs.devnet]` in `Anchor.toml`. Run `npm run protocol:idl`, `npm run protocol:build` and `npm run protocol:idl:check` to regenerate IDL and compile that ID.
3. Configure a **CLI signer** to pay for upload. Phantom's public address alone cannot sign a CLI deployment. Create a new deployment wallet only if this file does not already exist:

```bash
solana-keygen new --outfile ~/.config/solana/recorda-devnet-deployer.json
solana config set --url devnet \
  --keypair ~/.config/solana/recorda-devnet-deployer.json
solana address
solana balance
```

Transfer enough **Devnet SOL** to that CLI address from your test wallet, or obtain it from [Solana faucet](https://faucet.solana.com/). The historical smaller Coupon binary needed about **2.759 SOL** for storage; this is not a current v2 deployment budget. A larger upgrade needs extra program storage plus a temporary upload buffer simultaneously. Check the CLI estimate and current balance before upload; the observed 542,864→1,164,928-byte upgrade needed approximately 3.1601 SOL extra storage plus 5.9187 SOL buffer and fees. This is a storage deposit, not the cost of each golden iteration. The optional `npm run solana:airdrop -- PUBLIC_ADDRESS` utility is only a funding aid.

4. Deploy, then inspect (replace `YOUR_PROGRAM_ID` with the address from step 1):

```bash
solana program deploy target/deploy/recorda.so \
  --url devnet \
  --program-id target/deploy/recorda-keypair.json \
  --keypair ~/.config/solana/recorda-devnet-deployer.json \
  --fee-payer ~/.config/solana/recorda-devnet-deployer.json \
  --upgrade-authority ~/.config/solana/recorda-devnet-deployer.json
solana program show YOUR_PROGRAM_ID --url devnet
```

5. Update `VITE_RECORDA_PROGRAM_ID` in `.env.local`, keep the RPC on Devnet, restart Vite and follow the [three-terminal Devnet demo](#devnet-demo--coupon--voting--redemption). The CLI deployer and Phantom Operator can differ; instrument creation establishes the Operator authority. [Official deployment instructions](https://solana.com/docs/programs/deploying).

Historical read-only inspection recorded slot **508134659**, data length **542,864 bytes**; that is not evidence of the current v2 binary. A subsequent Devnet deployment has been reported. Verify the currently deployed binary separately; the human three-action PASS remains to be recorded. The `/reference` page's **Deploy KZTB26** creates test token assets, not the Rust program; ComputeBudget/Associated Token program IDs and token mint addresses are not Recorda's ID.

## Feature and attack audit

The two verification paths serve different purposes:

| Command | What it proves |
|---|---|
| `npm run test:e2e:actions:devnet` | Human Phantom-signed Coupon → Voting → Full Redemption on Devnet |
| `npm run test:audit` | Requirement traceability, business features and attack scenarios across MVP and specified Post-MVP |

For the audit, install Rust/Solana tools from [technical setup](#technical-setup) and the Playwright browser, then run:

```bash
npx playwright install --with-deps chromium
npm run test:audit
```

`test:audit` orchestrates its internal suites: client/wallet/RPC attacks, Rust unit tests, real Anchor/Token-2022 execution on a fresh local validator, browser recovery, forged-report rejection and Next runtime checks. It also covers partial retirement, Merkle claims/reclaim, threshold governance and eligibility/terms/source failures. No human Phantom confirmations are required for this path.

Keep ports **4444, 4445, 4446, 18899, 19900** free. The runner starts/stops its validator and retains evidence in `target/`, `test-results/` and `playwright-report/`. `target/security-audit/run.json` is valid for a revision only when every command passes and recorded source hashes match. Static FR checkmarks alone do not prove acceptance.

Coverage and findings: [FR checklist][features] · [requirement mapping][mapping] · [attack matrix][security] · [roadmap][roadmap]. Devnet Actions does not replace negative/Post-MVP coverage; the audit does not replace the human Devnet replay.

### Business domains and critical invariants

Derived from [TZ](docs/TZ.md) and its [normative requirements](docs/REQUIREMENTS.md). `[x]` means implementation and executable checks cover the stated scope; `[ ]` marks a remaining gap or acceptance boundary. These marks do not close live Devnet acceptance. See the [expanded invariant checklist](docs/BUSINESS-INVARIANTS.md) for individual rules, requirement IDs and test sources, and the [attack matrix](docs/SECURITY-AUDIT.md#attack-matrix) / [v2 and Post-MVP matrix](docs/SECURITY-AUDIT.md#v2--post-mvp-attack-matrix) for bypass scenarios.

- [x] **Instrument and holder registry:** registered balances reconcile to supply; holder-signed controlled transfers prevent custody bypass; redeemed units cannot circulate. FR-06–09,30–32; AT-03–04,17.
- [x] **Record date and rights:** the Clock cutoff preserves ownership even with late capture; complete snapshots reconcile holders/supply; finalized rights remain immutable after transfers; each action has its own snapshot. FR-10–15; TC-03,12,16; AT-05–06.
- [x] **Financial calculations:** checked integer minor units, per-holder floor rounding, aggregate reconciliation, zero-position handling and copied historical terms. FR-16–22,43,55; AT-09,26,32.
- [x] **Coupon:** explicit approval/full funding, bound payment destinations, once-only entitlement settlement, CPI rollback and completion only after all obligations are processed. FR-24–27; AT-07–12.
- [x] **Coupon periods in v2:** reservation/consumption prevents reuse of a period across Coupon and final-coupon Redemption. FR-46; AT-24.
- [ ] **Legacy coupon-period continuity:** legacy Coupon has no period identifier; a new authorized action can repeat the economic coupon. Legacy-to-v2 continuity requires historical reconciliation.
- [x] **Full Redemption:** Clock maturity, persistent transfer/issuance/conflict restrictions, separate principal/final coupon, holder-signed atomic burn/payment and final zero active supply. FR-17–18,28–32,45–46; AT-22–24.
- [x] **Voting:** fixed snapshot power, unique holder-signed votes within the window, abstentions in quorum, quorum plus YES > NO, no funding stage or automatic terms change. FR-19,33–37,47; AT-25.
- [x] **Authorized lifecycle and recovery:** on-chain authority, kind/account isolation, Scheduled-only cancellation, chain-backed partial resume and uncertain-broadcast reconciliation. FR-43–44,48; TC-19,29; AT-01–02,07–08,12,16,21.
- [x] **Receipts and public audit:** action-bound inputs/outcomes, independent formula/commitment checks, wallet-free audit and recovery without browser cache. FR-38–42,48,58; AT-18,26,35.
- [ ] **Complete independent historical proof:** audit still depends on trusted RPC and available history; consistent fabricated RPC responses and pruned transaction history remain NFR-05 limits.
- [ ] **Browser/Memo reference authenticity:** a fully rewritten/rehashed cache is not authenticated historical ownership. Use the protocol flow for authoritative business acceptance.
- [x] **Post-MVP distributions:** authenticated/reconciled archive, retained manifests/proofs, bound once-only claims and authorized post-deadline reclaim with unpaid obligations disclosed. FR-49–52; AT-27–30.
- [x] **Post-MVP governance and servicing:** exact-intent multisig/role thresholds, eligibility and historical-term preservation, atomic integer partial retirement and deduplicated external proposals without feed execution authority. FR-53–57; AT-31–34.
- [ ] **Live MVP acceptance:** retain a complete human Phantom Coupon → Voting → Full Redemption Devnet run, three final outcomes and zero supply; complete role/simulation-disclosure acceptance and demo video. TZ §§7,21,24; [remaining gates](docs/ROADMAP.md#remaining-acceptance-and-release-work).

## Troubleshooting

| Symptom | Next step |
|---|---|
| `solana: command not found` | Add the installed Solana CLI path using the technical setup section |
| Deployment funding/allocation error | Check CLI payer balance and the current upload/extension estimate; inspect any intermediate buffer |
| Buffer `AccountNotFound` | It may never have been created; do not assume funds are locked there |
| Program/IDL mismatch | Compare deployed address, Rust, Anchor, IDL and `.env.local`; regenerate/build if the ID changed |
| RPC mismatch or stale values | Restart Vite; remove shell overrides; optional runner RPC must equal frontend RPC |
| Runner cannot connect to 9222 | Keep the configured desktop browser open; check `curl http://127.0.0.1:9222/json/version` |
| Phantom missing or wrong wallet | Install/unlock it in the active test profile, select Devnet and the address requested by the runner |
| Wallet changed the simulated transaction | Reload current frontend; it pins budget/fee before signing. If it persists, retain exact error details; do not bypass the message-integrity guard |
| Stage waits at record date or vote close | Wait for Solana Clock; inspect alerts if it exceeds the stage/window limits |
| Expired blockhash | Confirm promptly; inspect submitted signature/status before retrying |
| Voting window ended before all votes | Inspect/reconcile the current action; adjust the next run's `RECORDA_VOTE_SECONDS` within 300..3600 |
| RPC 429/fetch failure | Use a reliable browser-accessible Devnet RPC consistently; retain partial-run evidence |
| Payment confirmation unclear | Check signature, destination balance and processed flags; reopening an Action URL recovers on-chain state |

## CI and website deployment

`.github/workflows/e2e.yml` checks requirements, builds, controlled client tests, offline Post-MVP, Rust and the full local protocol/browser suite; it retains artifacts. CI does not run human Phantom acceptance. `.github/workflows/deploy.yml` deploys Vercel prebuilt output for eligible merged PRs; `vercel.json` disables Git auto-deployment. Remote CI/deployment success must be established independently. Website publication and Solana program deployment are separate.

Vite production preview:

```bash
npm run build
npm run preview
```

The Next App Router shell shares the same screens. It uses `next-app` as its project directory, so the root `.env.local` is not automatically loaded by the Next CLI. Supply public settings at build time as below, or in `next-app/.env.local`; they are baked into the browser bundle:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com \
NEXT_PUBLIC_RECORDA_PROGRAM_ID=CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF \
npm run build:next
npm run start:next -- --port 3000
```

For retained proofs, `npm run distribution:index -- journal.json parameters.json public/distributions` verifies the pinned archive-provider signature and writes content-addressed manifests/proofs. Vite/Next serve the shared directory; generated archives must be backed up and explicitly included in hosting storage. This is separate from the three-action MVP demo; see [operations/provenance](docs/ARCHITECTURE.md#operations-and-supported-scope).

## Documentation

| File | Single responsibility |
|---|---|
| [Product](docs/PRODUCT.md) | BondOps value, target users, proposed exception flow and Infrastructure direction |
| [Product experience](docs/PRODUCT-EXPERIENCE.md) | Current screens and proposed interface progression |
| [TZ](docs/TZ.md) | KASE brief obligations, key business rules and separately scoped Recorda additions |
| [Requirements](docs/REQUIREMENTS.md) | Business domains and UC/FR/NFR/TC checklists; live DoD |
| [Roadmap](docs/ROADMAP.md) | Delivered milestones and remaining acceptance/release work |
| [Architecture](docs/ARCHITECTURE.md) | Runtime, accounts/contracts, operations, trust and provenance |
| [Security audit](docs/SECURITY-AUDIT.md) | Attack matrix, findings and evidence rules |
| [Business invariants](docs/BUSINESS-INVARIANTS.md) | Domain checklist derived from TZ, executable coverage and explicit gaps |
| [Devnet demo](docs/DEVNET-DEMO.md) | Presenter workflow, expected outcomes and retained proof |
| [Changelog](docs/CHANGELOG.md) | Dated change/result history |

[audit-coverage.json](docs/audit-coverage.json) is the machine-readable mapping of 121 requirements to source/evidence; it does not duplicate their normative wording.

TZ takes precedence; roadmap checkmarks do not amend requirements. All rights reserved: [LICENSE](LICENSE). Third-party licenses remain applicable.

[spec]: docs/TZ.md
[architecture]: docs/ARCHITECTURE.md
[contracts]: docs/ARCHITECTURE.md#accounts-and-lifecycle
[operations]: docs/ARCHITECTURE.md#operations-and-supported-scope
[roadmap]: docs/ROADMAP.md
[features]: docs/REQUIREMENTS.md#16-functional-requirements-fr
[mapping]: docs/audit-coverage.json
[security]: docs/SECURITY-AUDIT.md

## BondOps operational workspace

`npm run dev` now serves both the browser and `/api/bondops`; restart a previously running Vite server to load the API plugin. Demo and Solana Devnet are separate sources. Demo lets reviewers explore the TZ 17-unit / 850 Mock USD scenario, persist a case decision and assign a deadline without presenting fixtures as actual payments. Select Solana Devnet and sign in with a configured team wallet for scoped finalized-source reconciliation.

Routes: `/dashboard` overview; `/bonds` instruments/actions; `/calendar` upcoming/overdue deadlines; `/settlements` rights and exceptions; `/audit` retained portfolio observations/proof links; `/settings` team roles/scopes and notification rules; `/notifications` own inbox; `/infrastructure` source/connector status. `/protocol`, `/actions`, `/holders`, `/claims` preserve the financial and investor journeys.

Configure server-only `BONDOPS_DB_PATH`, `BONDOPS_ORIGINS`, `BONDOPS_RPC_URL`, `BONDOPS_PROGRAM_ID` and initial `BONDOPS_MEMBERS`; [complete operational setup](docs/BONDOPS-OPERATIONS.md). The server stores no payment keys and cannot manually mark an unconfirmed obligation paid. Runtime requires persistent Node/SQLite and a running scheduler; static Vite hosting or ephemeral serverless filesystem is insufficient. Bank/paying-agent and external notification providers are deferred. Public Devnet discovery returned RPC 429 during this revision, so live acceptance remains open.

Checks: `npm run test:bondops`, `npx playwright test --config playwright.bondops.config.ts`, `npm run build`, `npm run build:next`.
