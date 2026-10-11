# Recorda product & marketing experience

The central product promise is **Control coupon payments, redemptions, errors and confirmations from one workspace — Recorda BondOps.** **Ownership changes. Rights stay recorded.** remains a supporting explanation of entitlement correctness. The primary user is the bond servicing Operator; Investor and Auditor perspectives explain the consequence of the same action. This presentation does not add track requirements or replace [TZ](TZ.md), live acceptance or submission gates.

## BondOps operational interface

The recommended category is a financial operations workspace. Start with one action: Expected / Confirmed / Unsettled cards → holder reconciliation table → exception detail with fixed right, formula and authoritative evidence → permitted corrective action → refreshed confirmation. Portfolio queues, team operations and integration APIs follow later. Full flow and the illustrative $500 missing-payment case: [PRODUCT](PRODUCT.md#interface-progression-simple-to-complex).

The operational frontend/backend now covers portfolio, deadline calendar, confirmation states, exception investigation/assignment/history, team authorization and in-app reminders/escalations. Test Workspace is a filled SQLite example; Solana workspace reads/writes Rust program accounts. Separate RPC selection chooses Devnet or local validator; [setup and limits](BONDOPS-OPERATIONS.md) and [ROADMAP](ROADMAP.md) distinguish source delivery from live acceptance. Preserve readable amounts, technical evidence drill-down, holder signatures and wallet-free audit access.

## Entry and working journey

- `/` introduces the problem without a wallet or RPC request. The EN/RU story shows 10 record-date units, a later transfer of four, six current units and an unchanged 500 Mock USD coupon. It is explicitly illustrative, not a transaction or a live receipt.
- **Get started / Начать** opens `/dashboard`. Corporate actions opens `/actions` as Operator, initially selecting Coupon. Shared `/actions?action=…` links open as Auditor and recover real state from chain.
- `/bonds` links to **Instrument setup** at `/protocol`. After creating/selecting an instrument, **Continue to actions** carries its address into the Coupon form.
- The workspace connects Coupon → Voting → Full Redemption for that instrument. Actions have separate cutoffs; completing full redemption ends the active supply. Lifecycle statuses describe loaded records only, never inferred completion.
- The action summary explains state, approval/execution progress, readable amounts, quorum, cutoff, paid amount and supply. The Investor card places current holdings beside record-date holdings, entitlement and formula.
- Audit, raw minor-unit amounts, full holder/destination addresses, commitments and transaction evidence remain available. Voting document verification, role authorization and wallet signature requirements remain enforced.

## Welcome: corporate actions in a new light

**Real assets. Lasting rights.** introduces KASE bonds, Solana settlement and record-date rights. Twelve spheres form the current SVG logos: **KASE's faceted triangle → Solana's three offset bars → RECORDA's R**, centered in a full-width black field. The two-line heading and small pill actions sit at the left edge; brief product copy sits on the right. The scene retains generous negative space and fits the original 2590 × 1560 viewport without scrolling. Mobile stacks the same content rather than shrinking desktop copy.

The three product stages are **KASE / Instrument → Solana / Execution → Recorda / Record**. KASE uses its green facets; Solana transitions from mint through cyan to violet across its three bars; Recorda uses mint for the spine and violet for the loop and leg. All twelve spheres can emit light without hovering. Pointer proximity isolates nearby emitters, darkens other spheres, and exposes their soft radial shadows. A hand-authored WebGL fragment shader calculates screen-space light transport, spherical highlights, bloom and occlusion across the whole hero. It reproduces the reference's visual behavior, but is not its original ray-traced shader or bake.

KASE's prism and Solana's three bars are manually drawn React SVG components in `network-marks.tsx`. Recorda's new R uses a fixed spine, a loop and a forward stroke. No downloaded brand images are used. The workspace's existing brand remains unchanged. The marks identify the track, execution network and product; they do not claim an exchange integration or partnership.

React/GSAP handle the intro, SVG mark entrances and 1.45-second node transitions with an 18ms stagger and 1.2-second palette transitions, with scoped cleanup. Automatic phases advance every 6.5 seconds. Manual selection stops autoplay while completing the chosen logo transition. Rapid selection continues from the current positions, and replay returns the nodes to KASE. The play/pause control governs light modulation and autoplay, and replay returns to KASE. Reduced motion renders manual states immediately and disables automatic animation. The GPU renders at native desktop resolution and up to 2× device pixel density, bounded by four million pixels and the device texture limit. Sphere silhouettes use a physical-pixel antialiasing band, preserving a sharp surface inside the separate bloom. Continuous updates run at approximately 30fps. No render loop runs while paused, outside the viewport, behind the explanation dialog, or in a hidden tab. No wallet or RPC is requested on this screen. A twelve-sphere SVG sculpture that follows the same node transitions remains available if WebGL is unavailable or the context is lost.

The compact **Why Recorda? / Почему Recorda?** dialog contains the actual product hook: ten illustrative bonds at the cutoff, four transferred to Investor B, six held now and the unchanged 500 Mock USD coupon for Investor A. It retains the formula, simulated-transaction disclosure and Operator/Investor/Auditor perspectives. Native dialog focus containment, Escape to close and returning focus support keyboard navigation. The welcome and dialog support EN/RU and 320px phones through desktop.

### Reference basis

- The supplied local video is the primary design and animation reference for this revision.
- [KASE corporate style](https://kase.kz/ru/media-center/corporate-style) and [Solana branding](https://solana.com/branding) establish the recognizable mark geometry used for the hand-drawn SVGs.
- [GSAP React documentation](https://gsap.com/resources/React/) informs scoped timeline cleanup.
- Refero's public categories were inspected during the previous iteration; they do not govern this video-led composition.

Composition, SVG drawings and the light shader are authored in this repository.

## Verification

`tests/welcome.spec.ts` covers the explanatory story, EN/RU entry, wallet-free welcome, Operator defaults, instrument navigation, percent/basis-point consistency, reduced motion, keyboard tabs, mobile overflow, contextual lifecycle links, manually drawn marks, animation phase selection, pause/replay, dialog focus and the WebGL fallback. Additional browser checks compare rendered canvas frames to confirm pointer response, frozen lighting on pause, distinct logo layouts and palettes, intermediate morph positions, rapid selection recovery and usable context-loss fallback; the reference viewport is captured for all three stages. Screenshots are retained under `target/design-evidence/`.

Existing protocol/browser suites verify chain-backed recovery, audit, holder signing, voting and retirement. These checks use a local validator and test wallets; they do not close the human Phantom three-action Devnet gate. Historical audit counts in ROADMAP remain dated evidence, not fresh verification of this UI revision.
