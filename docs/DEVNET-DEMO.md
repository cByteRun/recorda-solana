# Devnet demo: Coupon → Voting → Full Redemption

Judge-facing MVP walkthrough. The runner drives one fresh instrument through three corporate actions; the presenter confirms real Phantom signatures and switches accounts. Allow **20–40 minutes**. Post-MVP scenarios are verified separately by the feature/attack audit.

## Preparation

Use [README Devnet quick start](../README.md#devnet-demo--coupon--voting--redemption) as the single setup procedure: `npm ci` → build/deploy the current Rust binary if needed → four Phantom accounts → root `.env.local` → three terminals. [Technical setup](../README.md#technical-setup) and [deployment/recovery](../README.md#deploy-a-new-program-or-update-the-existing-one) cover tools, authority keys and funding.

Before presenting:

- [ ] Current program/IDL/public Program ID agree; an old Coupon-only deployment is insufficient.
- [ ] One Chromium profile contains Phantom, Devnet is selected, automatic confirmation is disabled and Operator is unlocked.
- [ ] Operator and A/B/C are distinct real accounts; their public addresses are in `.env.local`, with Devnet SOL for fees/rent.
- [ ] Vite runs at the configured app URL and Chromium exposes CDP on 9222.
- [ ] Browser and verifier RPC match; no stale shell values override the file.

No Google accounts, holder private keys in env, manual faucet requests from the runner or additional test commands are needed. The CLI deployer may differ from Phantom Operator. D is a disposable zero-unit holder.

## Present the scenario

In terminal 3, with Operator selected:

```bash
npm run test:e2e:actions:devnet
```

The runner attaches to the already open browser and opens its own tab. Confirm every Phantom request; one stage may require several signatures. At each wallet switch, the test tab shows a yellow banner with the expected and connected addresses. Open Phantom in that same Chromium profile → account selector → choose the matching Solana account → unlock. If connection approval is required, click Connect Phantom / Wallet on the test page and approve. The runner refreshes trusted connection without signing; a wrong or unapproved account cannot continue. Expected order: Operator setup/Coupon → A/B/C voting → Operator tally → A/B/C redemption → Operator completion.

| Stage | Presenter action | Expected result |
|---|---|---|
| Instrument setup | Confirm Operator signatures | Fresh instrument, 17 bonds, holders 10/5/2/0 |
| Coupon | Confirm snapshot/calculation/approval/funding/settlement | A/B/C receive 500/250/100 Mock USD; D zero; finalized receipt; supply remains 17 |
| Voting | Switch to A → B → C as prompted, confirm each vote, then Operator | YES/NO/ABSTAIN = 10/5/2; 50% quorum met; result PASSED after closing; finalized receipt; no payment vault |
| Full redemption | Confirm Operator setup; switch A → B → C for burn/payment; return to Operator | Payouts 10500/5250/2100 Mock USD; supply 17→7→2→0; REDEEMED; finalized receipt |
| Audit | Runner opens separate pages without connecting a wallet | Audit: Verified; recorded rights and receipts recover from chain |

The `/actions` money display uses minor units: **100 = 1 Mock USD**. Payments are test Token-2022 tokens, not real USD/SOL. Show the role view, snapshot rights, actual payment destination, tally and final supply. Proposal acceptance records a decision without automatically changing bond terms.

Maturity is Solana Clock +180 seconds. The voting window defaults to 15 minutes; waiting for record dates/closing is expected. `RECORDA_VOTE_SECONDS` accepts 300..3600; all votes must finish before closing. Dates are entered in the browser's local timezone by the runner.

The three-action fixture has no post-record transfer. The feature/attack audit separately checks that later transfers preserve fixed rights. The Node verifier checks actual payment deltas and per-holder mint retirement; the client checks contract/snapshot/receipt hashes and integer formulas.

## Retain proof and reopen manually

Success prints `PASS` and records `passed: true` in:

```text
target/devnet-evidence/actions-<run-id>/run.json
```

Keep the JSON, three action screenshots, Action URLs and Explorer signatures. Open `/actions?action=<PDA>` as Auditor and click **Export verified audit**. For an independent manual recovery demonstration, open the URL in another browser without Phantom. The runner's separate audit tabs have no connected React wallet state but share the extension profile.

On failure inspect `run.json`, `failure.png`, the current Action URL and any submitted signatures. A plain rerun creates a new instrument and may leave the old one partially executed. Reconcile chain progress before repeating payments.

For an interrupted **pre-payment Coupon only**, explicitly resume its saved run:

```bash
npm run test:e2e:actions:devnet -- --resume target/devnet-evidence/actions-<run-id>/run.json
```

The runner checks matching Devnet/program/Operator/holders, the original Action/Instrument, unchanged 17-unit supply, zero processed rights/payment and no vault. It refuses successful runs, completed-action histories, funded or execution stages and any existing vault. It reads current rights and skips completed capture/calculation/approval, then continues Coupon → Voting → Redemption on the same instrument; original failed evidence remains unchanged. Funded/partially settled runs require manual chain reconciliation, not this resume path.

Do not navigate, edit Action PDA or reload the runner tab during a stage. It now waits for the URL action to load before Connect and reports late UI errors, wallet disconnects and lost reports rather than silently waiting for a state transition. On failure retain the browser/chain checkpoints in `run.json`.

## Verification paths

| Command | Scope |
|---|---|
| `npm run test:e2e:actions:devnet` | Human Phantom MVP happy path and retained Devnet proof |
| `npm run test:audit` | Requirements, feature correctness and attack matrix across MVP/Post-MVP |

The audit is not human Devnet acceptance; the demo is not full attack/Post-MVP coverage. Release gates and live DoD remain in [ROADMAP](ROADMAP.md#remaining-acceptance-and-release-work) and [REQUIREMENTS](REQUIREMENTS.md#24-definition-of-done--hackathon-mvp).
