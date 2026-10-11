# Recorda product & marketing experience

The product promise is **Ownership changes. Rights stay recorded.** The primary user is the bond servicing Operator; Investor and Auditor perspectives explain the consequence of the same action. This presentation does not add track requirements or replace [TZ](TZ.md), live acceptance or submission gates.

## Entry and working journey

- `/` introduces the problem without a wallet or RPC request. The EN/RU story shows 10 record-date units, a later transfer of four, six current units and an unchanged 500 Mock USD coupon. It is explicitly illustrative, not a transaction or a live receipt.
- **Get started / Начать** opens `/actions` as Operator, initially selecting Coupon. Shared `/actions?action=…` links open as Auditor and recover real state from chain.
- **Instrument setup** opens `/protocol`. After creating/selecting an instrument, **Continue to actions** carries its address into the Coupon form.
- The workspace connects Coupon → Voting → Full Redemption for that instrument. Actions have separate cutoffs; completing full redemption ends the active supply. Lifecycle statuses describe loaded records only, never inferred completion.
- The action summary explains state, approval/execution progress, readable amounts, quorum, cutoff, paid amount and supply. The Investor card places current holdings beside record-date holdings, entitlement and formula.
- Audit, raw minor-unit amounts, full holder/destination addresses, commitments and transaction evidence remain available. Voting document verification, role authorization and wallet signature requirements remain enforced.

## Welcome: Rights in Motion

The welcome is a single entry window rather than a landing page. The promise is **Ownership changes. The right stays yours.** A graphite stage and lime primary action frame a small financial story: ten illustrative bonds at the cutoff, four moving to Investor B, and an unchanged 500 Mock USD entitlement for Investor A. Coupon, Voting and Redemption are introduced beside the entry action; a compact accessible perspective selector explains each role.

The welcome-specific Recorda mark combines a fixed spine with three folded record layers. It suggests a prism and a sequence of rights without merging third-party trademarks. The existing workspace identity is unchanged. Official KASE and Solana artwork is stored locally in `public/brand/`; these identify track context and execution network, not a live KASE integration or sponsorship.

React and `@gsap/react` scope the entrance and state-transition timelines to the welcome and clean them up on unmount. Four bond objects move while the certificate remains anchored; an SVG connection traces the right, and Recorda's folds settle at the final stage. Automatic steps run every 5.5 seconds. Manual selection stops automatic progression and completes its selected transition. Pause stops the current transition; replay restarts the story. Reduced motion renders each selected state immediately and disables autoplay. No RPC or wallet connection is made by this illustration.

The window stacks on phones, preserves keyboard-operated perspective tabs, and supports EN/RU. Test-asset and illustrative-state disclosures remain visible.

### Research and asset sources

- [Refero](https://refero.design/): inspected the public onboarding, dialog, card and animation categories. Its screen library prompted login; no gated product screens were used or copied.
- [KASE corporate style](https://kase.kz/ru/media-center/corporate-style): original SVG artwork and prism semantics.
- [Solana branding](https://solana.com/branding): original gradient logomark.
- [GSAP React documentation](https://gsap.com/resources/React/): scoped timelines and automatic cleanup with `useGSAP`.

Composition and Recorda's new welcome mark are authored in this repository.

## Verification

`tests/welcome.spec.ts` covers the explanatory story, EN/RU entry, wallet-free welcome, Operator defaults, instrument navigation, percent/basis-point consistency, reduced motion, keyboard tabs, mobile overflow and contextual lifecycle links. Screenshots are retained under `target/design-evidence/`.

Existing protocol/browser suites verify chain-backed recovery, audit, holder signing, voting and retirement. These checks use a local validator and test wallets; they do not close the human Phantom three-action Devnet gate. Historical audit counts in ROADMAP remain dated evidence, not fresh verification of this UI revision.
