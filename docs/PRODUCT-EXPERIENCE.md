# Recorda product & marketing experience

The product promise is **Ownership changes. Rights stay recorded.** The primary user is the bond servicing Operator; Investor and Auditor perspectives explain the consequence of the same action. This presentation does not add track requirements or replace [TZ](TZ.md), live acceptance or submission gates.

## Entry and working journey

- `/` introduces the problem without a wallet or RPC request. The EN/RU story shows 10 record-date units, a later transfer of four, six current units and an unchanged 500 Mock USD coupon. It is explicitly illustrative, not a transaction or a live receipt.
- **Get started / Начать** opens `/actions` as Operator, initially selecting Coupon. Shared `/actions?action=…` links open as Auditor and recover real state from chain.
- **Instrument setup** opens `/protocol`. After creating/selecting an instrument, **Continue to actions** carries its address into the Coupon form.
- The workspace connects Coupon → Voting → Full Redemption for that instrument. Actions have separate cutoffs; completing full redemption ends the active supply. Lifecycle statuses describe loaded records only, never inferred completion.
- The action summary explains state, approval/execution progress, readable amounts, quorum, cutoff, paid amount and supply. The Investor card places current holdings beside record-date holdings, entitlement and formula.
- Audit, raw minor-unit amounts, full holder/destination addresses, commitments and transaction evidence remain available. Voting document verification, role authorization and wallet signature requirements remain enforced.

## Welcome: corporate actions in a new light

The user-supplied video in `tmp_assets/Matias____-_Shipped_a_new_shader_today_-_Ray-traced_lights_locally_-_Stored_bake_DXajrT.mp4` is the visual source of truth. Its black field, generous negative space, two-line copy on the left, brief explanation on the right, and interactive light sculpture in the center define the composition. It is a single welcome experience, with no landing-page sections. The video is a design reference, not a runtime backdrop.

**Real assets. Lasting rights.** introduces the product. Twelve nodes morph through **KASE / Instrument → Solana / Execution → Recorda / Record**. Three emitters cast soft light across a field of dark spherical occluders. A hand-authored WebGL fragment shader calculates screen-space light and shadow; the pointer illuminates the nearest node. KASE uses greens, Solana introduces magenta/cyan, and Recorda resolves into a mint/purple R. The shader is an interpretation of the reference, not its original ray-tracing implementation.

KASE's prism and Solana's three bars are manually drawn React SVG components in `network-marks.tsx`. Recorda's new R uses a fixed spine, a loop and a forward stroke. No downloaded brand images are used. The workspace's existing brand remains unchanged. The marks identify the track, execution network and product; they do not claim an exchange integration or partnership.

React/GSAP handle the intro, SVG mark entrances and the 1.6-second node morphs, with scoped cleanup. Automatic phases advance every 6.5 seconds. Manual selection stops autoplay while completing the chosen transition. The play/pause control governs light modulation and autoplay, and replay returns to KASE. Reduced motion renders manual states immediately and disables automatic animation. GPU resolution is capped at 720px in width and continuous updates run at approximately 30fps. No render loop runs while paused, outside the viewport, behind the explanation dialog, or in a hidden tab. No wallet or RPC is requested on this screen. An SVG sculpture remains available if WebGL is unavailable or the context is lost.

The compact **Why Recorda? / Почему Recorda?** dialog contains the actual product hook: ten illustrative bonds at the cutoff, four transferred to Investor B, six held now and the unchanged 500 Mock USD coupon for Investor A. It retains the formula, simulated-transaction disclosure and Operator/Investor/Auditor perspectives. Native dialog focus containment, Escape to close and returning focus support keyboard navigation. The welcome and dialog support EN/RU and 320px phones through desktop.

### Reference basis

- The supplied local video is the primary design and animation reference for this revision.
- [KASE corporate style](https://kase.kz/ru/media-center/corporate-style) and [Solana branding](https://solana.com/branding) establish the recognizable mark geometry used for the hand-drawn SVGs.
- [GSAP React documentation](https://gsap.com/resources/React/) informs scoped timeline cleanup.
- Refero's public categories were inspected during the previous iteration; they do not govern this video-led composition.

Composition, SVG drawings and the light shader are authored in this repository.

## Verification

`tests/welcome.spec.ts` covers the explanatory story, EN/RU entry, wallet-free welcome, Operator defaults, instrument navigation, percent/basis-point consistency, reduced motion, keyboard tabs, mobile overflow, contextual lifecycle links, manually drawn marks, animation phase selection, pause/replay, dialog focus and the WebGL fallback. Screenshots are retained under `target/design-evidence/`.

Existing protocol/browser suites verify chain-backed recovery, audit, holder signing, voting and retirement. These checks use a local validator and test wallets; they do not close the human Phantom three-action Devnet gate. Historical audit counts in ROADMAP remain dated evidence, not fresh verification of this UI revision.
