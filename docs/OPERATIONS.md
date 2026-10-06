# Operations and troubleshooting

## CI and merge-only deployment


GitHub Actions runs build and Playwright on PR updates to `main`, with one run per PR and stale-run cancellation. `ubuntu-latest` is a GitHub-managed VM: provisioning can queue; it is not a separately configured server. Local checks are available through the commands above.

Production deployment runs only when a same-repository PR is merged into `main`. `.github/workflows/deploy.yml` checks out the merge commit, reruns build/tests, then uses the official Vercel CLI to build and deploy prebuilt production artifacts. Direct pushes and unmerged closed PRs do not deploy. `vercel.json` disables Vercel Git auto-deployments to avoid duplicate builds.

Before the first merge deployment, configure GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` for the existing Vercel project. The workflow reports missing secret names without exposing their values. No production deployment is performed by editing this branch.

### Phantom transaction troubleshooting

Set Phantom to **Solana Devnet**, unlock the wallet and connect the operator account with Devnet SOL for transaction fees. Prefer Phantom's namespaced injected provider when multiple wallet extensions are installed.

Signed Memo attestations receive an explicit compute budget. RPC simulation runs before signing and surfaces program logs on failure. If simulation passes but Phantom returns `Unexpected error`, reconnect and check its selected network/account. Signing remains manual. Snapshot reads fail rather than recording an RPC-error fallback as a zero balance. After a transaction is broadcast, an ambiguous confirmation never triggers an automatic re-sign/payment; inspect its signature and balances before retrying.

### Public Devnet RPC throttling

Snapshot acquisition uses one contextual batch read for all holder token accounts, without the redundant full dashboard refresh. Shared RPC requests are serialized and 429 responses honor Retry-After with bounded backoff. If the shared endpoint remains throttled, copy `.env.example` to `.env.local`, set `VITE_SOLANA_RPC_URL` to your browser-accessible **Devnet** endpoint and restart Vite. VITE variables are public client configuration, not a place for private secrets.

RPC 429 and Phantom signing failure are separate: a successful application simulation does not prove the wallet's internal signing/simulation succeeded. A continuing wallet error requires the Phantom version and account type (normal software wallet, hardware or watch-only) to diagnose; no transaction is sent when signing fails.
