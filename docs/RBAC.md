# Recorda roles and wallet identity

The role cabinets follow `tmp_assets/dashboard/roles cabinet/recorda_bondops_preview(1).html`: Operator, Investor A/B/C and Auditor. Reviewer remains the existing operational team role. All cabinets share one portfolio model; preview and Solana data remain separate.

| Role | Home and navigation | Changes |
|---|---|---|
| Operator | Operations overview, bonds, corporate actions, holders, settlements, calendar, notifications, audit, infrastructure, settings | Instrument administration and authorized action operations; settings/team changes require the on-chain workspace admin |
| Investor | My overview, holdings, entitlements, voting, payment history, notifications | Only holder-authorized claims, votes and redemption signatures; no operational case/team administration |
| Auditor | Audit overview, proof explorer, exceptions, action register, event trail, proof reports | Read and export evidence; no financial or operational changes |
| Reviewer | Operations overview, portfolio, actions, holders, settlements, calendar, notifications, audit | Case handling and schedules within assigned on-chain scope; no workspace admin settings |

## Entry and identity

Choose an environment at `/workspaces`, then open **Sign in / Choose role** at `/login`. Each role has an entry card. In Demo, the cards open the packaged/example persona without Phantom. Investor examples use the illustrative holder identifiers A/B/C and retain their fixed record-date rights separately from current balances. Demo selection is saved in this tab only and cleared when switching environment.

In Test/Devnet, cards explain the roles; selecting a card does **not** grant that role. **Connect Phantom & identify me** reads the actual provider's public key and matches it against the configured public addresses. An already trusted Phantom connection is restored without prompting; unknown wallets receive no member role. Changing/disconnecting the wallet clears the previous identity and immediately recomputes configured roles from the actual new account; on-chain membership is reconciled by a fresh portfolio read. Wallet connection and portfolio loading are separate states. Signing out releases the login lock before the background read finishes, so the next sign-in is available immediately. `bondops-wallet` in browser storage alone is not identity evidence.

Configure public addresses in `.env.local` (preferred) or `.env`:

```dotenv
RECORDA_OPERATOR=YOUR_OPERATOR_PUBLIC_ADDRESS
RECORDA_HOLDER_A=YOUR_INVESTOR_A_PUBLIC_ADDRESS
RECORDA_HOLDER_B=YOUR_INVESTOR_B_PUBLIC_ADDRESS
RECORDA_HOLDER_C=YOUR_INVESTOR_C_PUBLIC_ADDRESS
# Optional independent operational accounts:
RECORDA_REVIEWER=YOUR_REVIEWER_PUBLIC_ADDRESS
RECORDA_AUDITOR=YOUR_AUDITOR_PUBLIC_ADDRESS
```

Existing runner variables are reused. Vite exposes **only these six public address values**, under `VITE_RECORDA_*`; explicit `VITE_RECORDA_*` values override their `RECORDA_*` counterparts. Other environment variables and private keys are not exposed. Restart Vite after editing configuration. Next builds accept `NEXT_PUBLIC_RECORDA_*`, then `VITE_RECORDA_*`, then `RECORDA_*` from their build environment. An address assigned to conflicting configured roles is rejected.

Configured address matches determine the cabinet. If there is no match, active Rust `opsMember` / workspace admin records can determine the operational role. The default for an unknown address is **no role**, not Auditor. Roles identify the application's workspace, not a centrally authenticated server session: connecting Phantom grants browser access to the selected account; every actual mutation still requires a transaction signature.

## Enforcement and data

Internal tab links retain the same provider and loaded portfolio. Corporate actions, legacy coupon setup and holder claims reuse the shared connected wallet; opening a tab does not require another Phantom connection. The corporate actions and holder registry tabs select a portfolio action automatically, with explicit action URLs taking precedence.

In Test/Devnet, signing out returns to `/login`. Sidebar, quick navigation and direct cabinet URLs also lead to login when no member is identified; page controllers do not mount before entry. The requested route is retained in `next` and opened after explicit sign-in only when the identified role can visit it.

Navigation and direct-route guards limit each identified role's cabinet. Investor pages filter positions and historical rights by the connected wallet, never by the selected login card. Operator/Reviewer mutations are checked again in the shared client controller. Demo server sessions independently enforce roles, origin, CSRF and instrument scope.

The environment address map is **not an on-chain permission grant**. Rust verifies signer, instrument authority, canonical PDA, active team membership and scope on every instruction. Configuring an Operator address cannot promote it to a Rust workspace admin; configuring an Auditor does not erase existing chain permissions. Update on-chain team membership separately using an authorized signer. Solana account data is public; these cabinets control the product interface rather than making blockchain data private.

Local and Devnet cabinets use the same components and finalized RPC reader. Localnet sends requests directly with a timeout; public Devnet retains request spacing and bounded retries for rate limits. Holdings come from canonical holder positions and validated Token-2022 accounts; their sum must reconcile with mint supply. Preview uses labelled illustrative data, never as a fallback for failed RPC reads. Read-only reports retain the source/finality marker. Devnet verification is deferred for this UI/RBAC change.
