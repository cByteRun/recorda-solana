# Devnet demo: Coupon → Voting → Full Redemption

This is the repeatable judge-facing MVP demo: one bond instrument, three corporate actions, real Phantom signatures, payments and receipts in Solana Devnet. Allow 20–40 minutes. The runner drives the application; the presenter confirms transactions and switches accounts. It does not auto-sign. Post-MVP claims/governance/external events are outside this demo.

## 1. Install and build once

From the repository root, use Node 22.12+ and the pinned Rust/Solana tools described in [README technical setup](../README.md#technical-setup):

```bash
npm ci
npm run protocol:idl
npm run protocol:build
npm run protocol:idl:check
```

Install a desktop Chromium/Chrome and Phantom in the browser profile used below. `npx playwright install chromium` alone does not provide a configured Phantom profile.

## 2. Publish the program when the Rust code changes

Deploy once for the current binary, not before every demo. If the current build is already deployed, skip this step. The CLI payer/upgrade authority and the Phantom Operator may be different wallets.

Keep the existing program keypair and upgrade-authority key. Inspect the public address and current authority:

```bash
solana address -k target/deploy/recorda-keypair.json
solana program show CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF --url devnet
solana balance --url devnet --keypair "$HOME/.config/solana/recorda-devnet-deployer.json"
```

For this repository's existing deployment, if that saved deployer is the displayed authority:

```bash
solana program deploy target/deploy/recorda.so \
  --url devnet \
  --program-id target/deploy/recorda-keypair.json \
  --keypair "$HOME/.config/solana/recorda-devnet-deployer.json" \
  --fee-payer "$HOME/.config/solana/recorda-devnet-deployer.json" \
  --upgrade-authority "$HOME/.config/solana/recorda-devnet-deployer.json"
```

Fund the CLI payer with Devnet SOL according to the CLI's estimate. A larger binary may need both additional program storage and a temporary upload buffer at the same time; the old Coupon-only 3-SOL estimate is not sufficient for every v2 update. After an interrupted upload inspect/recover its buffer before starting another. Never replace an existing authority key to fix a funding error. See [deployment and recovery](../README.md#deploy-a-new-program-or-update-the-existing-one).

The program ID must agree in `declare_id!`, `Anchor.toml`, generated IDL and `.env.local`. Choosing an unrelated address only in `.env.local` is insufficient. Use the linked deployment guide for a new program ID.

## 3. Prepare four accounts in one Phantom extension

No Google accounts or separate browsers are needed. In Phantom's account menu, create/select four accounts:

| Account | Role | Suggested Devnet SOL balance for this demo |
|---|---|---:|
| Operator | Creates and approves actions; funds mock payments | 0.5 |
| A | Receives 10 bonds; votes YES; signs redemption | 0.1 |
| B | Receives 5 bonds; votes NO; signs redemption | 0.1 |
| C | Receives 2 bonds; votes ABSTAIN; signs redemption | 0.1 |

These are convenience reserves, not measured fee quotes; the CLI deployment cost is separate. Enable Phantom Testnet Mode and select Solana Devnet. Fund through the [Solana faucet](https://faucet.solana.com/) or existing Devnet funds. Copy each **Solana public address** from Receive. Do not copy seed phrases/private keys. D is a disposable zero-unit holder created by the setup; no fourth investor account is needed.

## 4. Fill one configuration file

Create it only if it does not exist, then edit it:

```bash
cp -n .env.example .env.local
```

Relevant values:

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

Replace all `YOUR_...` values. A/B/C must be distinct and different from Operator. `RECORDA_OPERATOR` is optional; when supplied, the runner rejects a different initially selected wallet before setup. `VITE_*` values are public frontend configuration. Keep wallet secrets in Phantom or the CLI key files, never this file. `.env.local` is ignored by Git.

Vite and the Devnet scripts read `.env.local` automatically. The scripts also accept `.env` as fallback: existing shell values > `.env.local` > `.env`. No `export` or `source` is needed. Remove old shell overrides or use a fresh terminal if configuration appears stale. The runner uses `VITE_SOLANA_RPC_URL` unless `RECORDA_DEVNET_RPC` explicitly overrides it; browser and verifier URLs must match. Use `.env.local` for this demo, not `.env.test` or `.env.development.local`, which the Node runner does not load. Restart Vite after edits.

## 5. Keep three terminals open

### Terminal 1: application

```bash
npm run dev
```

Expected: application at http://localhost:4444. Keep it running.

### Terminal 2: Phantom browser with debugging

Close an existing instance of this specific profile, then start:

```bash
chromium-browser \
  --user-data-dir="$HOME/snap/chromium/common/recorda-devnet-profile" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  http://localhost:4444
```

Depending on installation the executable is `chromium` or `google-chrome`; substitute that name if necessary. Keep your existing profile path if Phantom is already installed there. A new profile needs Phantom installation/account setup. Unlock Phantom, select Devnet and **Operator**, and leave automatic confirmation disabled. Keep this browser open. The runner attaches to it and opens its own application tab.

### Terminal 3: full MVP acceptance

```bash
npm run test:e2e:actions:devnet
```

The runner loads `.env.local`, checks the Devnet genesis and funded holder accounts, then creates a fresh instrument with A/B/C/D = 10/5/2/0. It never requests a faucet automatically. Follow terminal prompts and confirm every Phantom transaction; one stage can require several confirmations. When asked to switch to a specific address, select that account in the same Phantom extension. No page clicking is required for the scripted flow.

## 6. What the presenter and judges should see

| Stage | Presenter action | Expected result |
|---|---|---|
| Instrument setup | Confirm Operator signatures | Fresh instrument, 17 bonds, holders 10/5/2/0 |
| Coupon | Confirm snapshot/calculation/approval/funding/settlement | A/B/C receive 500/250/100 Mock USD; D zero; finalized receipt; supply remains 17 |
| Voting | Switch to A → B → C as prompted, confirm each vote, then Operator | YES/NO/ABSTAIN = 10/5/2; 50% quorum met; result PASSED after closing; finalized receipt; no payment vault |
| Full redemption | Confirm Operator setup; switch A → B → C for burn/payment; return to Operator | Payouts 10500/5250/2100 Mock USD; supply 17→7→2→0; REDEEMED; finalized receipt |
| Audit | Runner opens separate pages without connecting a wallet | Audit: Verified; recorded rights and receipts recover from chain |

The app shows money in minor units on `/actions`: 100 units = 1 Mock USD. All payments use the demo Token-2022 payment mint, not real USD or SOL. Voting records a decision; it does not itself modify terms. This three-action fixture does not include the historical A→B post-record transfer; the separate Coupon golden covers that rule.

Maturity is chain time +180 seconds. The vote defaults to a 15-minute window so there is time for human signatures. Closing waits use Solana Clock; pauses at a record date or closing time are expected. `RECORDA_VOTE_SECONDS` accepts 300..3600 seconds. Finish votes before the window closes; slow confirmations may require a new/reconciled scenario.

The Node verifier checks actual payment-account deltas and bond mint supply. The client verifies contract/snapshot/receipt hashes and integer formulas. Together with human Phantom signatures, this is evidence of the real Devnet flow, rather than merely a successful screen animation.

## 7. Save evidence and handle interruption

Success prints `PASS` and writes `passed: true` to:

```text
target/devnet-evidence/actions-<run-id>/run.json
```

The directory also contains screenshots for all three finalized actions. Keep the JSON, action URLs and Explorer transaction links for the presentation. Open `/actions?action=<PDA>` in Auditor and use **Export verified audit** to show recovery and export manually. A new tab in the runner has no connected React wallet state but shares the user's browser profile; it is not an isolated extension-free browser. For a stronger manual demonstration, reopen the URL in another browser without Phantom.

On failure, `run.json` retains the current action and completed checkpoints, and `failure.png` captures the screen. Inspect that action and any submitted signatures before repeating payments. This full runner has no automatic resume: a rerun creates a new instrument and can leave the old one partially executed. The legacy Coupon-only runner has a narrower before-payment resume facility.

| Command | Purpose |
|---|---|
| `npm run test:e2e:actions:devnet` | Human-signed Devnet Coupon → Voting → Full Redemption |
| `npm run test:e2e:golden:devnet` | Historical Coupon-only golden, including A→B post-record transfer |
| `npm run protocol:test:ui` | Local validator and controlled browser full protocol coverage |
| `npm run test:audit` | Full local requirements/client/Rust/validator audit |

Successful local tests do not replace this human Devnet run. A successful MVP demo does not establish all Post-MVP scenarios, remote CI, production readiness or the legality of issuing a real bond.
