# BondOps on-chain operations dashboard

The operator overview answers who is owed, for which action, how much is confirmed, and which exception needs an owner. It implements BO-01/02/03/05 over the existing workspace read model, without changing financial instructions or program authorization. Investor and Auditor cabinets keep their role-specific views.

## Local reference adaptations

- `tmp_assets/dashboard/templates/financial-dashboard(1)/components/kokonutui/`: grouped account summaries, recent transaction rows and contextual details become per-asset obligation summaries and evidence rows.
- `tmp_assets/dashboard/templates/frosted-glass-ui-crm-dashboard-ui-design/components/crm-dashboard.tsx`: card hierarchy, searchable contacts, responsibility and operational queue become holder obligations and assigned settlement cases. Surfaces use Recorda theme variables instead of the template's fixed glass/background image.
- `tmp_assets/dashboard/templates/onchain-analytics-dashboard/components/dashboard.tsx`: holder grouping and progressive detail inform wallet-linked rights and proof drill-down. Its mock market prices, growth, whale metrics, social campaigns and AI chatbot are not imported.

The supplied templates are design references, not dependencies or data providers. Charts visualize currently loaded immutable rights; no fake historical time series or predicted return is introduced.

## Data and integrity

- Asset selection uses mint identity, not currency label. Initial selection prioritizes an asset with unsettled obligations; the global case count remains visible across assets. Amounts stay integer minor units until display. Assets are never summed across mints. Summary amounts are the backend's totals, and voting and cancelled actions are excluded from payment rows.
- Holder rows group calculated rights by wallet and selected settlement asset across actions. Each detail retains instrument action, cutoff units, principal, separate coupon, destination and evidence state. Uncalculated rights remain visible in action cards as calculation pending and are not presented as zero calculated obligations.
- Expected = Confirmed + Unsettled. Unknown remains a subset of Unsettled. The donut shows confirmed / known unconfirmed / unknown composition. Per-action bars show obligation size and confirmed coverage, not blockchain trading volume.
- Open cases retain owner, financial evidence, reason, decision history and the original signed mutation flow through the exception panel. A manual note does not create a payment confirmation. Reader refresh remains distinct from signing.
- Proof rows expose observed right accounts, retained transaction links, receipt and settlement slot. A stored signature is not proof of success. This is a bounded view of loaded records, not an exhaustive index of wallet movements or a bank settlement feed.
- Source, network, finality, sync timestamp and read errors remain disclosed. Demo is explicitly illustrative and has no explorer links. Localnet and Devnet use the same finalized program reader; a failure never loads template mocks.
- Existing calendar, operational notices, rules, membership, governance, audit/export and Coupon/Voting/Redemption flows remain reachable through the unchanged role navigation. Pipeline counts describe current stages, not mutually exclusive financial totals. Voting has no funding/payment stage.

The header keeps workspace, language, profile and 20 theme palettes. Phones retain all 11 operator tabs and profile in the bottom panel. EN/RU applies to new operational controls; public on-chain names and evidence remain verbatim.
