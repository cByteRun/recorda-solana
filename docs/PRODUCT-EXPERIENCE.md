# Recorda product & marketing experience

The product promise is **Ownership changes. Rights stay recorded.** The primary user is the bond servicing Operator; Investor and Auditor perspectives explain the consequence of the same action. This presentation does not add track requirements or replace [TZ](TZ.md), live acceptance or submission gates.

## Entry and working journey

- `/` introduces the problem without a wallet or RPC request. The EN/RU story shows 10 record-date units, a later transfer of four, six current units and an unchanged 500 Mock USD coupon. It is explicitly illustrative, not a transaction or a live receipt.
- **Get started / Начать** opens `/actions` as Operator, initially selecting Coupon. Shared `/actions?action=…` links open as Auditor and recover real state from chain.
- **Instrument setup** opens `/protocol`. After creating/selecting an instrument, **Continue to actions** carries its address into the Coupon form.
- The workspace connects Coupon → Voting → Full Redemption for that instrument. Actions have separate cutoffs; completing full redemption ends the active supply. Lifecycle statuses describe loaded records only, never inferred completion.
- The action summary explains state, approval/execution progress, readable amounts, quorum, cutoff, paid amount and supply. The Investor card places current holdings beside record-date holdings, entitlement and formula.
- Audit, raw minor-unit amounts, full holder/destination addresses, commitments and transaction evidence remain available. Voting document verification, role authorization and wallet signature requirements remain enforced.

## Visual system and motion

Graphite `#121e17` anchors the welcome. Off-white `#f4f5ef` supports the workspace. Lime `#c7f879` highlights rights and primary calls to action; forest green supports execution controls. Lavender identifies the illustrative transfer. Large sans-serif type establishes the promise; a serif accent distinguishes the lasting record.

Two separate motion layers: slow orbital lines in the background and a foreground bond/rights story with changing balances, a transfer indicator and an unchanged entitlement. CSS transform/opacity animation and React state avoid new animation dependencies. Manual step selection pauses autoplay; the pause control also stops continuous background/ticket motion. Reduced-motion preference disables automatic motion while retaining manual exploration. No marketing animation runs in the signing flow.

Navigation, story controls, perspective tabs and disclosure summaries support keyboards. The tablist supports arrows/Home/End. Responsive layouts cover 320px phones through desktop; technical tables scroll within their panel.

## Research references

- [Linear](https://linear.app/): positioning connected to concrete product workflows.
- [React Bits](https://reactbits.dev/): distinct background animation and interactive component motion.
- [Motion React documentation](https://motion.dev/docs/react): reference for animation options; no dependency was added.

The composition and assets are authored in this repository; no third-party component source is copied.

## Verification

`tests/welcome.spec.ts` covers the explanatory story, EN/RU entry, wallet-free welcome, Operator defaults, instrument navigation, percent/basis-point consistency, reduced motion, keyboard tabs, mobile overflow and contextual lifecycle links. Screenshots are retained under `target/design-evidence/`.

Existing protocol/browser suites verify chain-backed recovery, audit, holder signing, voting and retirement. These checks use a local validator and test wallets; they do not close the human Phantom three-action Devnet gate. Historical audit counts in ROADMAP remain dated evidence, not fresh verification of this UI revision.
