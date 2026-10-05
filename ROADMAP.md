# ROADMAP — Recorda

**Источник истины:** [ТЗ](docs/TZ.md), прежде всего §§2–5: связь владения на record date с правом держателя, исполнением и доказательством.

> **“Tokenization tells you who owns the asset. We determine what that ownership entitled them to on the record date, execute the corporate action and prove what happened next.”**

**Центральная ось: Record Date → Right → Controlled Execution → Verifiable Proof.**

Каждая фича должна продвигать один из этих этапов или обеспечивать его корректность. UC/FR/NFR/TC ниже — краткая трассировка к ТЗ, а не замена требований. MVP включает Phase 1–4; Post-MVP не подменяет обязательные сценарии.

## Текущий фокус и прогресс

Ветка: **feat/phase-1-react**. Активная фаза: **Phase 1**, milestone **R1 — React coupon bridge**. Следующий protocol milestone: **M1.1**, затем M1.2–M1.6.

- [x] React/npm миграция, UI/domain Playwright и исправления runtime/CI.
- [x] Последняя проверка кода на commit a09cd7a: build + 11/11 Playwright, [PR CI](https://github.com/cByteRun/recorda-solana/actions/runs/37360917971).
- [x] README как презентация продукта; FEATURES и UC/FR/NFR в roadmap.
- [ ] React Devnet acceptance с ручным Phantom signing и сохранёнными tx/deltas.
- [ ] Preview последней версии: Vercel сообщил build-rate-limit.
- [ ] Anchor Coupon Core M1.1–M1.6.
- [ ] Полный MVP: Coupon + Redemption + Voting, protocol security и proof.

**Правило галочек:** [x] означает готовность только в указанном scope с доказательством. Реализованный bridge не закрывает on-chain требования. Изменение документации не означает прохождение новой проверки кода.

## Проверка связи требований с результатом

**Ось ТЗ → UC/FR/NFR → milestone FEATURES → golden input/expected → implementation → E2E → actual output/proof.**

Для каждого milestone нужны: фичи, ожидаемый бизнес-результат, проверка actual против expected и честное описание границы IMPLEMENTED / SIMULATED.

| Слой проверки | Что подтверждает | Что не закрывает |
| --- | --- | --- |
| Golden model + domain Playwright | Формула, snapshot/current separation, суммы, сравнение выхода | Реальное исполнение или protocol enforcement |
| UI Playwright | Ось продукта, holder cards, gating, ошибки браузера | Подпись Phantom и выплату |
| Manual React Devnet acceptance | RPC state, подписи и payout deltas реального bridge | Неизменяемость и idempotency собственного program |
| Anchor integration E2E (план) | Actual PDA/token state, authority, transitions, повторные вызовы | UX-понятность без проверки интерфейса |

**Dataset gap:** golden содержит A/B/C = 10/20/5; ТЗ §22 задаёт A/B/C/D = 10/5/2/0. Оба воспроизводят центральный invariant, но полный MVP должен проверить и набор ТЗ с нулевым держателем. Golden сохраняется как отдельный regression fixture; ожидаемые значения не меняются ради PASS.

## Phase 0 — доказательство бизнес-flow в reference prototype

### M0.1 — тестовый инструмент и держатели

**Результат:** оператор видит реальные позиции, из которых позже возникают права.
**Ось:** вход для Record Date. **UC:** подготовка UC-CP-01, UC-BR-01, UC-VOTE-01.
**FR:** 01–04,09,40 — инструмент, параметры, выпуск, распределение, баланс, tx.
**NFR:** 05,10,12 — проверяемость, воспроизводимость, отсутствие hardcoded operator secret.

**FEATURES**

- [x] Reference Token-2022 KZB26, supply 35 и A/B/C = 10/20/5.
- [x] Disposable holder identities и token accounts.
- [x] Phantom operator и ссылки на реальные Devnet транзакции.

**Проверка / выход:** историческое reference evidence в golden; mint ownership, supply и holder balances прочитаны через RPC. Это не завершённый protocol registry.

### M0.2 — coupon reference flow

**Результат:** после перевода облигаций право на купон остаётся за record-date позицией.
**Ось:** все четыре этапа в Browser/Memo bridge. **UC:** UC-CP-01.
**FR:** 10,12,14–16,22–25,27,38–41 — snapshot, entitlement, approval, settlement, proof.
**NFR:** 01,05,09,10 — повторяемость, аудит и понятное demo; protocol гарантии остаются открытыми.

**FEATURES**

- [x] Reference snapshot 10/20/5 и post-record transfer A → B: 4.
- [x] Текущее владение 6/24/5 при купоне 500/1000/250.
- [x] Подтверждение Phantom и reference KUSD-DEV settlement.
- [x] Memo receipt и reference verifier с RPC-проверкой результата.

**Проверка / выход:** golden/reference evidence описывает исторический PASS. FR-13,20,26 и NFR-02,03,06,11 не закрываются Memo/browser реализацией.

## Phase 1 — MVP: React bridge и protocol Coupon Core

### R1 — React coupon bridge и воспроизводимая проверка

**Результат:** тот же предметный flow доступен в поддерживаемом клиенте и проверяется автоматически в доступных границах.
**Ось:** показывает Record Date → Right → Controlled Execution → Verifiable Proof.
**UC:** UC-CP-01; объяснение права и проверка результата для ролей ТЗ §6.
**FR:** клиентская часть 09,14–16,23–25,27,40–41.
**NFR:** 09,10,12; NFR-11 требует будущего protocol core.

**FEATURES**

- [x] React + TypeScript + Vite/npm, Tailwind v4, local shadcn-style UI.
- [x] FSD-style структура и port Phantom/Token-2022 orchestration.
- [x] Holder cards, coupon pipeline, формула, статусы и tx links.
- [x] Offline oracle из input и полное сравнение с expected.
- [x] Playwright: snapshot/current invariant, coupon/total, zero, corrupted output, UI/gating/runtime errors.
- [x] npm lockfile, npm ci, CI build/tests и отчёты.
- [x] Wallet gating восстановленной сессии и local recorded-settlement guard.
- [x] README, ARCHITECTURE и аудит границ реализации.
- [ ] Ручной replay React Devnet acceptance с сохранённым evidence.
- [ ] Рабочий preview текущей версии после снятия Vercel limit.

**Проверка / выход:** 11/11 automated tests подтверждены для a09cd7a; real React flow подтверждается отдельно по manual acceptance. Offline settlement/FINALIZED — simulation.

### M1.1 — инструмент, eligibility и holder registry

**Результат:** права создаются для допущенных держателей заданного инструмента.
**Ось:** основание Record Date. **UC:** setup всех трёх UC.
**FR:** 01–09,38 — параметры, supply, registry, approve/revoke, transfer control, balances.
**NFR:** 04,10–12 — authority, reproducibility, protocol truth, key safety.

**FEATURES**

- [ ] Anchor workspace, Instrument и HolderPosition PDA.
- [ ] Параметры обязательства, mint/settlement mint, authority, outstanding/redeemed supply.
- [ ] Registry: register/approve/revoke держателя и связь с token account.
- [ ] Контроль transfer eligibility без обхода registry (FR-08).
- [ ] Валидация Token-2022 mint/account и чтение позиций клиентом.

**Проверка / выход:** integration tests отклоняют чужую authority и неподходящие accounts; registry/параметры восстанавливаются с chain после reload.

### M1.2 — record date и immutable snapshot

**Результат:** известно, кто и сколько имел на нужную дату; последующие transfers не переписывают права.
**Ось:** Record Date. **UC:** UC-CP-01, UC-BR-01, UC-VOTE-01.
**FR:** 10–15,38–39 — action, authority, snapshot, finalization, metadata, transitions.
**NFR:** 04,06,11 — авторизация, неизменяемость, protocol truth.

**FEATURES**

- [ ] CorporateAction PDA и допустимые переходы lifecycle.
- [ ] SnapshotPosition по eligible holder с проверкой источника balance.
- [ ] create action → snapshot holders → finalize snapshot.
- [ ] Slot/time/hash и запрет изменения finalized snapshot.
- [ ] Реальный post-record transfer без изменения snapshot.

**Проверка / выход:** TC-03,16,17; golden snapshot 10/20/5 при current 6/24/5. Неверные balances, mutation и transitions отклоняются on-chain.

### M1.3 — права держателя и финансовый расчёт

**Результат:** каждому держателю положена объяснимая сумма из record-date позиции.
**Ось:** Right. **UC:** UC-CP-01; основа principal/final coupon и voting power.
**FR:** 16–22 — виды прав, integer math, per-holder entitlement и total.
**NFR:** 01,02,11 — детерминизм, точность, protocol truth.

**FEATURES**

- [ ] EntitlementPosition PDA и integer/fixed-point coupon calculation.
- [ ] Расчёт из Instrument + SnapshotPosition; frontend amount не является authoritative.
- [ ] Aggregate obligation и валидация параметров/overflow.
- [ ] Контракты данных для principal, final coupon и snapshot voting power.

**Проверка / выход:** TC-01,02,05; 500/1000/250, total 1750, zero = 0; неверный client amount не меняет protocol результат.

### M1.4 — подтверждение и однократная выплата

**Результат:** проверенное право исполняется после разрешения и без повторной выплаты.
**Ось:** Controlled Execution. **UC:** UC-CP-01.
**FR:** 23–27 — preview, approval, settlement, no double payment, finalization.
**NFR:** 03,04,07,08 — idempotency, authority, atomicity, recovery.

**FEATURES**

- [ ] Preview распределения и approve_action с проверкой authority.
- [ ] Контролируемый settlement vault и Token-2022 transfer_checked CPI.
- [ ] Per-holder settled state и запрет второго settlement.
- [ ] Безопасное продолжение partial batch без повторной выплаты.
- [ ] Проверка funding и total settled против obligation.

**Проверка / выход:** TC-04,15,17–19; actual KUSD deltas = 500/1000/250. Повторный/неавторизованный вызов не переводит средства.

### M1.5 — receipt и история прав/исполнений

**Результат:** инвестор и аудитор видят, когда право возникло, почему и что исполнено.
**Ось:** Verifiable Proof. **UC:** investor/auditor flows ТЗ §§6,21.
**FR:** 38–42 — identity, events, tx, receipt, read-only verification.
**NFR:** 05,09,11 — аудит, понятность, chain state.

**FEATURES**

- [ ] ActionReceipt PDA и finalize только после исполнения обязательства.
- [ ] Events/tx references связывают snapshot, entitlement, approval и outcome.
- [ ] История держателя из action/entitlement state, отдельно от текущего wallet balance.
- [ ] Read-only объяснение формулы и проверка результата.

**Проверка / выход:** A: record-date 10, current 6, право/выплата 500 и финальный receipt. Неисполненное действие нельзя финализировать.

### M1.6 — полный golden Coupon protocol E2E

**Результат:** бизнес-ось подтверждается actual chain state, а не только карточками или моделью.
**Ось:** все четыре этапа. **UC:** UC-CP-01.
**FR:** совместная приёмка M1.1–M1.5. **NFR:** 01–12 в scope Coupon.

**FEATURES**

- [ ] Golden fixture → initialize → snapshot → transfer → entitlement → approve → settle → receipt.
- [ ] Oracle сравнивает PDA/token-account actual с independent expected.
- [ ] Negative tests: unauthorized, mutation, double settlement, wrong accounts, invalid transitions.
- [ ] Replay набора ТЗ §22 с A/B/C/D и zero holder, отдельно от regression golden.
- [ ] Playwright читает/показывает protocol result; ручная подпись остаётся у человека.

**Проверка / выход:** TC-01–05,15–19 проходят; права/исполнение совпадают с expected; Memo не является источником domain truth.

## Phase 2 — MVP: три corporate actions на одном движке

### M2.1 — погашение облигации

**Результат:** держатель получает principal/final coupon, соответствующие units прекращают обращение.
**Ось:** Right → Controlled Execution → Verifiable Proof, общий Record Date.
**UC:** UC-BR-01. **FR:** 05,17–18,28–32,41.
**NFR:** 01–08,11 — точность, корректность, однократность и доказательство.

**FEATURES**

- [ ] Redemption action по maturity и общему snapshot.
- [ ] Principal и отдельный final coupon.
- [ ] Подтверждение authority и settlement.
- [ ] Burn/retire/lock units и outstanding/redeemed supply.
- [ ] Защита от double redemption и receipt результата.

**Проверка / выход:** TC-06–10; 10 bonds → 10000 principal плюс заданный coupon; redeemed units нельзя погасить снова.

### M2.2 — голосование держателей

**Результат:** голос соответствует позиции на record date и учитывается ровно один раз.
**Ось:** общий Record Date → voting Right → vote → Proof.
**UC:** UC-VOTE-01. **FR:** 19,33–37,41.
**NFR:** 01,03–06,11 — детерминизм, once-only, authority, аудит и immutability.

**FEATURES**

- [ ] Proposal, record date, voting window и quorum.
- [ ] Voting power из finalized snapshot.
- [ ] YES/NO/ABSTAIN и VoteReceipt.
- [ ] Запрет double vote и проверка deadline.
- [ ] Final on-chain tally/quorum и proof.

**Проверка / выход:** TC-11–14; post-record transfer не меняет power; итог равен сумме валидных votes.

### M2.3 — общий lifecycle engine

**Результат:** новые события используют единый механизм обслуживания прав.
**Ось:** все четыре этапа. **UC:** все три UC.
**FR:** 06,10–15,21–24,38–42. **NFR:** 01,04–06,09,11.

**FEATURES**

- [ ] Общие Instrument/Registry/Snapshot и правила authority.
- [ ] Общая identity/history/receipt модель с action-specific расчётами.
- [ ] Явное различие общего lifecycle и Coupon/Redemption/Voting логики в UI.

**Проверка / выход:** 3/3 actual E2E сценария; каждое завершённое событие имеет проверяемый результат.

## Phase 3 — MVP: объяснение прав в продукте

### M3.1 — клиент читает protocol truth

**Результат:** открытие клиента восстанавливает историю и права независимо от локального состояния.
**Ось:** представление всей цепочки. **UC:** операторские сценарии всех UC.
**FR:** 02,05,09,14,21–23,38–41. **NFR:** 09–12.

**FEATURES**

- [x] React/Vite shell и Phantom adapter (реализованы заранее в R1).
- [ ] Generated Anchor IDL/types и PDA reads.
- [ ] UI finalized state из chain; localStorage только для необязательного resume/cache.
- [ ] Refresh/restart восстанавливает lifecycle и holder rights.

**Проверка / выход:** UI данные совпадают с PDA после reload; client не определяет финальную сумму.

### M3.2 — Operator / Investor / Auditor journeys

**Результат:** за 30–60 секунд понятно, кому какое право положено и где доказательство.
**Ось:** Record Date → Right → Controlled Execution → Verifiable Proof.
**UC:** три corporate actions и роль-specific flows ТЗ §§6,21.
**FR:** 02,05–09,14,21–25,33–34,38–42. **NFR:** 05,09,10.

**FEATURES**

- [ ] Instruments и holder registry с eligibility/current balance.
- [ ] Timeline corporate actions и action detail с record date/formula/status.
- [ ] Operator preview/approval/execution.
- [ ] Investor: «что было положено, почему, что исполнено».
- [ ] Auditor: snapshot/obligation/processed totals/mismatches/tx/receipt.
- [ ] IMPLEMENTED/SIMULATED видимы в нужном контексте.

**Проверка / выход:** Playwright journeys для доступных шагов и manual signing boundary; demo делает pitch очевидным за 30–60 секунд.

## Phase 4 — MVP: приёмка и подача

### M4.1 — корректность и безопасность

**Результат:** права и исполнения корректны при штатных и ошибочных вызовах.
**Ось:** гарантии всех четырёх этапов. **UC:** все три UC.
**FR:** 08,11,13,20,24,26,30–32,36–42. **NFR:** 01–12.

**FEATURES**

- [ ] TC-01–19 automated где возможно; ручные границы документированы.
- [ ] Integer math, authority, immutable snapshot и valid transitions.
- [ ] No double settle/redeem/vote и partial recovery.
- [ ] Чистый Devnet run, protocol/UI совпадение и отсутствие known P0/P1.
- [ ] Operator secret не находится в repository/frontend.

**Проверка / выход:** mismatch/double execution/unauthorized execution = 0 в acceptance dataset.

### M4.2 — воспроизводимое demo и submission

**Результат:** judge понимает идею и воспроизводит результат.
**Ось:** pitch → live rights lifecycle → proof.
**UC/FR:** все обязательные сценарии и DoD ТЗ §24. **NFR:** 05,09,10.

**FEATURES**

- [x] README: проблема, решение, целевая аудитория, edge и продуктовая ось.
- [x] Инструкции локального запуска, architecture и implemented/simulated границы.
- [ ] Полный working MVP по DoD ТЗ §24 и таблица подтверждённого покрытия.
- [ ] Demo video: полный E2E Coupon/Redemption/Voting, не только интерфейс.
- [ ] Devnet evidence и понятный способ независимой проверки.

**Проверка / выход:** 3/3 сценария, 100% finalized outcomes с proof; README позволяет повторить demo.

## Post-MVP — расширение обслуживаемых прав и интеграций

Эти milestones не отменяют незакрытые MVP требования. UC здесь — новые сценарии, которые сначала должны быть утверждены в ТЗ; существующие NFR остаются обязательными.

### P1 — масштабирование и инфраструктурные роли

**Ось:** scalable Record Date и Controlled Execution/Proof.
**Связь с ТЗ:** §26 P1; развитие FR-06,12–14,24,39–42 и NFR-04–05,08–11.

**FEATURES**

- [ ] Merkle commitment / indexer для больших реестров.
- [ ] Batch processing и richer transfer controls поверх обязательного FR-08.
- [ ] Issuer/operator/auditor separation и multisig.
- [ ] Downloadable reports и расширенная timeline.

**Проверка / выход:** масштабирование не меняет golden права; batching не создаёт повторную обработку.

### P2 — дополнительные виды corporate actions

**Ось:** новые Rights на общем lifecycle.
**Связь с ТЗ:** §26 P2; новые UC/FR перед реализацией, NFR-01–08,11.

**FEATURES**

- [ ] Early/partial redemption.
- [ ] Dividends, tender offer/buyback.
- [ ] Conversion и modification of terms workflow.

**Проверка / выход:** отдельный golden/acceptance contract для каждого нового права и исполнения.

### P3 — внешние интеграции и production model

**Ось:** eligibility → controlled external execution → proof.
**Связь с ТЗ:** §§20,25–26; новые UC/FR, NFR-03–05,07–08,11–12.

**FEATURES**

- [ ] KYC/AML, custody/recovery и внешние fiat/bank rails.
- [ ] KASE/KCSD/depository adapters после проверки требований интеграции.
- [ ] Production security review и операционная/legal модель до Mainnet.

**Проверка / выход:** внешний settlement reference связан с entitlement; фактическое исполнение и initiation ясно различаются.

## Фильтр scope

Фича входит в MVP, если усиливает центральную ось, нужна обязательному сценарию или закрывает FR/NFR/DoD ТЗ. Иначе — Post-MVP.

README презентует продукт. ROADMAP показывает доставку и текущий фокус. [ARCHITECTURE](ARCHITECTURE.md) описывает реализацию. [Аудит](docs/PHASE_1_AUDIT.md) фиксирует ограничения и доказательства.
