# Recorda

**Corporate actions for tokenized bonds on Solana.**

Tokenizing a bond records ownership, but servicing it still requires determining who held it on the record date, calculating what each investor is owed, approving payment and reconciling the result. When these steps use separate records, errors are harder to prevent and outcomes harder to verify.

Recorda connects them in one reproducible process: **Record Date → Right → Controlled Execution → Verifiable Proof**. The operator reviews and approves execution; investors and auditors can trace each outcome back to the recorded holdings and formula.

Investor A held **10 bonds** on the record date, then sold 4. A now holds **6**, but the coupon remains **10 × 1,000 × 10% ÷ 2 = 500**. Recorda preserves that right through the transfer and links the payment to its receipt. This reduces reconciliation between ownership, calculations and payments, and makes the result independently explainable.

The target product uses the same lifecycle for **coupons, redemption and voting**. Coupon is implemented and locally verified; redemption and voting remain open. [Product context](docs/PRODUCT.md) explains the domain and positioning; [ROADMAP](docs/ROADMAP.md) tracks delivery.

## Quick start

Requires Node **22.12+** and npm. Run commands from the repository root:

```bash
npm ci
npm run dev
```

Open http://localhost:4444. The home page shows the coupon flow and golden example without a wallet; `/protocol` operates the deployed Anchor program.

## Quick validation — see the business rule

On the home page, open **Golden black-box oracle / Known input → logic → expected output** and compare Input → Expected → Actual. Its **SIMULATED / PASS** label proves the calculation example, not an on-chain payment. For automatic client regression:

```bash
npx playwright install --with-deps chromium
npm run test:e2e:golden
```

These tests use a controlled wallet/RPC. For actual Devnet transactions, follow the next section.

## Phase 1 golden on Devnet — real Phantom

Recorda is already deployed at **`CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF`**. You do not need to redeploy for each replay. A fresh checkout needs Node/npm, a desktop Chromium or Chrome, Phantom and a wallet with **Devnet SOL**. [Install tools/browser](#install-tools-and-browser) if missing; Rust/Solana CLI is required for building/deploying the program, not for replaying the existing deployment.

Prepare public configuration once. Copy only if `.env.local` does not already exist; otherwise update its values from `.env.example`:

```bash
cp -n .env.example .env.local
```

The program ID must match the generated IDL; use the same RPC for Vite and the runner. Keep these **three terminals** open:

### Terminal 1 — application, port 4444

```bash
npm run dev
```

Vite reads `.env.local` automatically. Restart it after changing environment values.

### Terminal 2 — wallet browser, debugging port 9222

Close an existing instance of the same test profile before starting it with debugging enabled:

```bash
chromium \
  --user-data-dir="$HOME/snap/chromium/common/recorda-devnet-profile" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222
```

For Google Chrome, replace `chromium` with `google-chrome` and choose a dedicated profile path. If you already started with `/tmp/recorda-devnet-chromium` or another path, **keep that original profile when resuming**; it contains the demo holder keys/cache. The persistent path above also works with Ubuntu's Chromium snap.

In this browser profile:

1. Open [phantom.com/download](https://phantom.com/download), choose Chrome to install the extension in Chromium, and set up/unlock your test wallet. [Phantom browser support](https://help.phantom.com/articles/48456789393811).
2. Open Phantom **Settings → Developer Settings**, enable **Testnet Mode**, and use **Solana Devnet**. Keep automatic confirmation disabled for this human-signing replay. [Phantom developer settings](https://help.phantom.com/articles/28951369255699).
3. Ensure the wallet has Devnet SOL for fees/account rent. Mainnet SOL cannot pay Devnet fees. If already funded, no airdrop is needed; the runner never requests one.

An ordinary tab without port 9222 is enough for manual `/protocol` use, but the automatic runner needs the debugging endpoint. Firefox is not supported by this runner's Chromium CDP connection.

### Terminal 3 — golden runner

Node does not automatically load `.env.local`. Export its public variables in this terminal (the example file uses shell-compatible assignments):

```bash
set -a
source .env.local
set +a
npm run test:e2e:golden:devnet
```

Alternatively export explicitly in both the application and runner terminals:

```bash
export VITE_RECORDA_PROGRAM_ID=CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF
export RECORDA_DEVNET_RPC=https://api.devnet.solana.com
export VITE_SOLANA_RPC_URL=$RECORDA_DEVNET_RPC
```

The runner opens `/protocol` and controls the buttons. **You review and confirm Phantom prompts** for setup, schedule, snapshot, transfer, calculation, approval, funding, settlement and receipt. Stage waits allow five minutes; transaction expiry still follows Solana's blockhash lifetime. The connected wallet is the **Operator**; A/B/C/D are disposable demo investors stored in this profile. The A→B transfer also uses A's local demo key.

For a manual demo, the crucial order is:

1. Wait until the page says **Record date reached on Solana** and enables **Begin / resume snapshot → finalize**, then click it: snapshot A/B/C/D = 10/5/2/0. The countdown uses the program's Clock sysvar, not the computer clock or estimated block time.
2. While the action is **SNAPSHOTTED**, click **Demo: A transfers 4 → B** and sign. Current units become 6/9/2/0; record-date units remain 10/5/2/0. Rows are ordered by account address, not by A/B/C/D.
3. Click **Calculate protocol rights**: entitlements are 500/250/100/0, total 850, even though A now holds only six bonds.
4. Approve → fund → settle → finalize. Refresh/reopen the action to compare current units, immutable snapshot units and paid amounts.

The protocol permits later transfers after FINALIZED, but doing the demo transfer only then does not establish the intended **sell before payout, retain snapshot entitlement** lifecycle. Start a new golden action/instrument for a clean replay instead of paying the old action again.

Success independently checks snapshot **10/5/2/0**, current holdings **6/9/2/0**, coupon payment deltas **500/250/100/0**, total **850**, finalized receipt and read-only hash audit. Public evidence is written to `target/devnet-evidence/coupon.json` and `coupon.png`. Human-signed replay passed on 2026-10-06 for action `9AbwBu83PEqHtV4wy4i3kdjh1nDkyRDCBkR3SeP8jqJx`; partial progress alone is not a full PASS.

The lasting result is stored **on chain**, in Instrument, CorporateAction, EntitlementPosition and ActionReceipt accounts; stage signatures are available in the audit links. Reopen `http://localhost:4444/protocol?action=YOUR_ACTION_PDA` to read it without a connected wallet. Manual clicks alone do not create the runner's `coupon.json`; that file is written only after the automatic runner reaches all its verification checks. A separate read-only audit can retain `target/devnet-evidence/action-YOUR_ACTION_PDA.json` and must state its scope independently of the runner's PASS.

To resume a stopped run **before any payments start**, copy the **Action PDA** from the page or its `?action=` URL, keep the same profile, load the variables as above and replace `YOUR_ACTION_PDA`:

```bash
RECORDA_DEVNET_ACTION=YOUR_ACTION_PDA npm run test:e2e:golden:devnet
```

Resume preserves the action/instrument, skips completed stages and checks chain balances before repeating A→B:4. Failure diagnostics are `target/devnet-evidence/failure.json` and `failure.png`. After payments start, reconcile the existing action in the UI; the golden runner refuses to invent a pre-payment balance baseline. A normal run without the resume variable creates a new instrument.

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

### Build and verify Coupon Core

After changing the program ID/interface, regenerate IDL first:

```bash
npm ci
npm run protocol:idl
npm run protocol:build
npm run protocol:idl:check
npm run protocol:test:rust
npm run build
npx playwright install --with-deps chromium
npm run protocol:test:ui
```

Keep validator RPC **18899**, faucet **19900** and protocol Vite **4445** free. `protocol:test:ui` starts/stops a fresh validator, runs real PDA/token-account and browser checks, prints the retained `/tmp` ledger path and writes `target/protocol-evidence/` plus Playwright reports/traces. Generated JSON/TypeScript IDL files must be committed together.

### Deploy a new program or update the existing one

For the currently deployed program, skip this section unless rebuilding/redeploying. A new checkout may not contain the ignored deployment keypair; restoring that keypair is necessary to control the same program ID, or generate a new one and synchronize the ID before deployment.

1. Read the program address: `solana address -k target/deploy/recorda-keypair.json`. If the file is missing and you intend to create a new program, run `mkdir -p target/deploy`, then `solana-keygen new --outfile target/deploy/recorda-keypair.json` first. Keep an existing keypair instead of replacing it.
2. Match that address in `declare_id!` in `programs/recorda/src/lib.rs`, `[programs.localnet]` and `[programs.devnet]` in `Anchor.toml`. Run the build/verification block above to regenerate IDL and compile that ID.
3. Configure a **CLI signer** to pay for upload. Phantom's public address alone cannot sign a CLI deployment. Create a new deployment wallet only if this file does not already exist:

```bash
solana-keygen new --outfile ~/.config/solana/recorda-devnet-deployer.json
solana config set --url devnet \
  --keypair ~/.config/solana/recorda-devnet-deployer.json
solana address
solana balance
```

Transfer enough **Devnet SOL** to that CLI address from your test wallet, or obtain it from [Solana faucet](https://faucet.solana.com/). Our observed initial upload required approximately **2.759 SOL for accounts plus fees**; check the CLI's current requirement. Funding around 3 test SOL covered that observed requirement. This is a storage deposit, not the cost of each golden iteration. The optional `npm run solana:airdrop -- PUBLIC_ADDRESS` utility is only a funding aid.

4. Deploy, then inspect (replace `YOUR_PROGRAM_ID` with the address from step 1):

```bash
solana program deploy target/deploy/recorda.so \
  --url devnet \
  --program-id target/deploy/recorda-keypair.json \
  --keypair ~/.config/solana/recorda-devnet-deployer.json
solana program show YOUR_PROGRAM_ID --url devnet
```

5. Update `VITE_RECORDA_PROGRAM_ID` in `.env.local`, keep the RPC on Devnet, restart Vite and follow the three-terminal replay above. The CLI deployer and Phantom Operator can differ; instrument creation establishes the Operator authority. [Official deployment instructions](https://solana.com/docs/programs/deploying).

Read-only inspection confirmed the existing deployment at slot **508134659**, data length **542,864 bytes**. Existence is verified; human Coupon golden acceptance passed; a separate comparison of on-chain/local binary hashes remains open. The `/` page's **Deploy KZTB26** creates test token assets, not the Rust program; ComputeBudget/Associated Token program IDs and token mint addresses are not Recorda's ID.

## Golden dataset and evidence

The [required fixture](golden/coupon-tz-section-22.json), from [TZ §22](docs/TZ.md#22-demo-dataset), contains fixed inputs and independently specified expected outputs. Face value 1,000 × annual coupon 10% ÷ two payments/year gives 50 per bond. Snapshot A/B/C/D = 10/5/2/0; after A sells four to B, current balances = 6/9/2/0, while coupons remain 500/250/100/0, total 850. Money is stored in minor units: `50000` means `500.00`. The [historical fixture](golden/coupon-happy-path.json) is a separate regression, total 1,750.

| Command | Execution / signing | Evidence scope |
| --- | --- | --- |
| `test:e2e:golden` | Controlled wallet/RPC/DOM | Client/runner regression **44/44**; not public Solana proof |
| `protocol:test:ui` | Actual Rust/Token-2022 on local validator; generated test keys | Saved validator **16/16**, browser/audit **4/4**; no human Phantom proof |
| `test:e2e:golden:devnet` | Public Devnet; human Phantom | PASS on 2026-10-06: payouts 500/250/100/0, total 850, finalized receipt and read-only audit |

Tests compare actual calculations/accounts/token deltas against the fixture; the fixture alone cannot prove payment. Local tests sign automatically with generated keys. Human Devnet replay requires your confirmations. [Requirement → code → test mapping](docs/ROADMAP.md#verification-and-gaps) and [test artifacts](docs/ARCHITECTURE.md#test-evidence) retain the detailed audit, including Rust **4/4** and historical build/SBF/IDL results. Remote CI is not established by local runs.

## Manual acceptance

For manual local Coupon replay after building, use the synchronized program ID:

```bash
solana-test-validator --reset --ledger /tmp/recorda-manual-ledger \
  --bpf-program CFyseDHTMkDxMpnozdZpHV5a4fbEkPAkyue5RpHtrobF target/deploy/recorda.so
```

In another terminal:

```bash
VITE_SOLANA_RPC_URL=http://127.0.0.1:8899 npm run dev
```

Use a wallet compatible with local RPC, fund its public address on the local validator and open `/protocol`. Create the instrument → schedule record date → begin/capture/finalize snapshot after record time → A→B:4 → calculate → approve → fund → settle → finalize. Reopen `/protocol?action=YOUR_ACTION_PDA` without a wallet/cache and verify the receipt, fixed rights, formula and totals. For manual Devnet use the configured Devnet RPC and deployed program instead.

Retain program/mint/action/receipt addresses, snapshot metadata/hash, stage signatures and payment before/after balances. The `/` Browser/Memo reference keeps lifecycle truth in the browser; its Memo receipt is different from an Anchor receipt. [Runtime boundaries](docs/ARCHITECTURE.md#runtime-and-trust).

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| `solana: command not found` | Run the Solana PATH export from installation in this terminal; persist it in the shell config. `source "$HOME/.cargo/env"` restores Cargo/Rust PATH. |
| `No wallet available` | Configure the CLI deployment keypair and Devnet with `solana config set` above; Phantom is not a CLI signer. |
| Deploy `insufficient funds for spend ... + fee` | Check the **CLI wallet's Devnet balance**, fund the amount reported by CLI plus fees, then retry. Program storage rent is separate from transaction fees; mainnet funds do not pay Devnet costs. |
| `airdrop` returns `Internal error` / rate limit | Optional faucet funding failed; use the web faucet or transfer existing Devnet SOL. The golden runner does not depend on airdrop. |
| Program missing / IDL ID mismatch | Compare `solana program show`, Rust `declare_id!`, Anchor entries, generated IDL and `.env.local`; regenerate/build if the ID changed, then restart Vite. |
| Browser/RPC configuration mismatch | Export `.env.local` in the runner terminal; Vite loads it automatically but Node does not. `RECORDA_DEVNET_RPC` and `VITE_SOLANA_RPC_URL` must match. |
| Chromium command missing / runner cannot reach port 9222 | Install desktop Chromium, start the dedicated profile with debugging flags, and keep it running. Check `curl http://127.0.0.1:9222/json/version`. Close an old instance of that same profile before restarting it with flags. |
| Phantom missing / wrong account/network / rejected signature | Install/unlock Phantom in the **test profile**, select Devnet and the instrument's authorized Operator, then inspect the page alert. |
| Snapshot button disabled / stage timeout | Wait for **Record date reached on Solana**; the Clock countdown updates automatically and enables the button. If Clock RPC fails, readiness remains disabled. Inspect page alerts and `failure.json`; resume the existing Action PDA before payments start. |
| `RecordDate` / `Custom:6007` at BeginSnapshot | The program's Clock has not reached the date. Refresh the updated UI and resume the same action; the runner now schedules/waits with Clock sysvar and pins simulation to at least its ready slot. `getBlockTime` is an estimate and can be ahead of program time. No Rust redeployment is needed for this client fix. |
| Node `TypeError: fetch failed` after snapshot | Verifier reads now run sequentially with up to three retries, backoff and a 15-second timeout per request. If the RPC stays unavailable, resume with `RECORDA_DEVNET_ACTION=<printed-action-PDA> npm run test:e2e:golden:devnet` in the same browser profile before payments start. Transaction sends are not automatically repeated. |
| Expired blockhash / invalid scheduling date | Sign promptly. If scheduling failed, choose a fresh future record time; if broadcast succeeded or is ambiguous, reconcile its signature before retrying. |
| RPC `429` / port 4444, 4445, 18899 busy | Use a browser-accessible RPC with the same configuration in both terminals; stop the conflicting server or use `RECORDA_APP_URL` for a different Vite origin. |
| Payment already started / confirmation unclear | Inspect the saved signature, destination balances and per-holder paid flags; use chain-based UI recovery. Clearing browser storage is not reconciliation and loses demo holder keys. |

If deployment fails after creating an intermediate buffer, retain its recovery instructions locally and inspect that buffer before retrying or reclaiming its rent. Do not publish the recovery seed. Failure JSON/screenshots are diagnostics, not success proof.

## CI and website deployment

`.github/workflows/e2e.yml` checks build, client and Coupon protocol tests and retains artifacts. `.github/workflows/deploy.yml` rechecks merged same-repository PRs to `main` and deploys Vercel prebuilt output; `vercel.json` disables Git auto-deployments. Configure `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; remote execution and the first merge deployment remain unverified. Website deployment is separate from Solana program deployment.

For a local production preview:

```bash
npm run build
npm run preview
```

## Documentation

[TZ](docs/TZ.md) → [REQUIREMENTS](docs/REQUIREMENTS.md) defines scope and acceptance; [ROADMAP](docs/ROADMAP.md) maps features to evidence; [ARCHITECTURE](docs/ARCHITECTURE.md), [PRODUCT](docs/PRODUCT.md) and [CHANGELOG](docs/CHANGELOG.md) cover implementation, business context and changes. TZ takes precedence; roadmap checkmarks do not amend requirements.

All rights reserved: [LICENSE](LICENSE). Third-party licenses remain applicable.
