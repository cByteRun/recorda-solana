# Техническое задание (ТЗ)
## KASE Corporate Actions Engine — lifecycle infrastructure for tokenized securities on Solana

**Статус:** Hackathon MVP / KASE Side Track  
**Источник истины:** это ТЗ → затем UC → FR/NFR → архитектура → реализация.  
**Сеть MVP:** Solana Devnet / Local Validator.  
**Принцип:** сначала корректность корпоративного действия, затем UX и инфраструктура.

---

# 1. Контекст задачи

KASE и Superteam Kazakhstan требуют рабочий прототип, автоматизирующий корпоративные действия для токенизированных финансовых инструментов на Solana.

Обязательная цепочка:

> **Identify eligible holders → Calculate entitlements → Execute/initiate action → Record outcome on-chain**

Обязательные сценарии:
1. Coupon Payment.
2. Bond Redemption.
3. Минимум одно дополнительное corporate action.

Минимум прототип должен содержать:
- тестовый токенизированный финансовый инструмент;
- holder registry;
- record-date mechanism;
- entitlement calculation;
- coupon payment;
- bond redemption;
- дополнительное corporate action;
- проверяемую on-chain запись результата.

Внешние/фиатные платёжные рельсы разрешено симулировать, но entitlement logic и Solana corporate-action flow должны реально работать.

---

# 2. Главная бизнес-проблема

## 2.1 Проблема верхнего уровня

**Токенизация финансового инструмента сама по себе не решает его обслуживание после выпуска.**

После выпуска облигация продолжает жить: появляются даты фиксации реестра, купоны, погашение, досрочные события, голосования, изменения условий и необходимость доказать, кому и сколько было положено и что в итоге произошло.

Если эти процессы остаются разрозненными или ручными, блокчейн превращается только в новый формат учёта актива, а lifecycle по-прежнему требует отдельной сверки реестров, расчётов, платёжных инструкций и аудита.

### Суть проблемы одной строкой

> **Нужен единый детерминированный механизм, который связывает состояние токенизированного инструмента на record date с правом конкретного держателя и с доказуемым результатом corporate action.**

---

# 3. Ключевая цель продукта

Создать **Corporate Actions Engine** для токенизированных ценных бумаг, который на Solana превращает корпоративное событие в воспроизводимый end-to-end процесс:

> **Instrument → Record Date Snapshot → Eligible Holders → Entitlements → Approval → Settlement/Execution → Redemption/State Change → On-chain Receipt**

Продукт должен доказать, что lifecycle токенизированной облигации может обслуживаться программируемо, прозрачно и проверяемо, а не только её выпуск/передача.

---

# 4. Ценность и ожидаемый эффект

## 4.1 Для KASE / инфраструктуры рынка
- единый стандартный workflow для corporate actions токенизированных инструментов;
- меньше ручной сверки между состоянием держателей, расчётами и фактом исполнения;
- неизменяемый audit trail ключевых этапов;
- возможность независимо перепроверить расчёт и результат;
- переиспользуемый движок для разных эмитентов и типов событий;
- основа для масштабирования tokenized securities после стадии issuance.

## 4.2 Для эмитента
- автоматический расчёт обязательств по каждому держателю;
- снижение риска неправильного entitlement;
- прозрачный статус события: Draft → Snapshotted → Approved → Funded → Settled → Finalized;
- один источник данных о результате corporate action.

## 4.3 Для инвестора
- понятно, почему он eligible / not eligible;
- видно snapshot balance на record date;
- видно формулу и сумму entitlement;
- можно проверить transaction signature / on-chain receipt;
- при голосовании — проверяемый voting power и результат.

## 4.4 Экономический эффект

В MVP не заявляются недоказанные проценты экономии. Прототип должен показать механизмы, из которых возникает экономический эффект:

1. **меньше операционных шагов** между фиксацией реестра и исполнением;
2. **меньше reconciliation** между независимыми таблицами/системами;
3. **меньше риска human error** в расчётах и распределениях;
4. **быстрее проверка и аудит**, потому что входные параметры, snapshot, entitlement и outcome связаны on-chain;
5. **масштабируемость:** новый corporate action строится поверх общего registry/snapshot/entitlement/audit слоя.

---

# 5. Продуктовый тезис

**Мы не строим биржу, DeFi-протокол или “облигацию ради токена”.**

Мы строим **lifecycle servicing layer** для tokenized securities.

Ключевая ценность прототипа — не сам SPL-токен, а доказуемая цепочка:

> **кто владел → на какую дату → какое право получил → по какой формуле → что было исполнено → что произошло с инструментом → где доказательство.**

---

# 6. Пользователи и роли

## R1. Market / Corporate Actions Operator
Представитель KASE, депозитарной инфраструктуры или уполномоченного оператора.

Может:
- создать/зарегистрировать тестовый инструмент;
- создать corporate action;
- установить record date;
- запустить snapshot;
- проверить рассчитанные entitlements;
- подтвердить действие;
- инициировать settlement;
- финализировать событие;
- видеть audit trail.

## R2. Issuer / Paying Agent
Может:
- просматривать параметры обязательства;
- пополнять settlement vault;
- подтверждать готовность выплаты;
- видеть итоговый отчёт.

Для MVP роль может быть объединена с Operator.

## R3. Holder / Investor
Может:
- видеть свои токены;
- видеть eligibility на record date;
- видеть entitlement;
- видеть статус выплаты/погашения;
- проверять Solana transaction;
- участвовать в bondholder voting.

## R4. Auditor / Observer
Read-only роль.

Может проверить:
- параметры инструмента;
- snapshot;
- формулу;
- entitlement;
- settlement transaction;
- burn/retirement;
- финальный receipt.

---

# 7. Главный E2E сценарий

1. Operator создаёт тестовую облигацию.
2. Система создаёт Token-2022 mint и on-chain `Instrument` state.
3. Токены распределяются между 3–5 тестовыми держателями.
4. Operator создаёт corporate action и задаёт record date.
5. В момент snapshot система фиксирует состав и балансы eligible holders.
6. После фиксации snapshot становится immutable для данного action.
7. Программа рассчитывает entitlement каждого holder детерминированной формулой.
8. UI показывает preview: holders, balances, amounts, total obligation.
9. Operator явно подтверждает исполнение.
10. Settlement выполняется on-chain mock payment token либо создаётся verifiable settlement instruction.
11. Для redemption соответствующее количество bond tokens сжигается/retire/lock.
12. Программа создаёт/обновляет on-chain `ActionReceipt`.
13. Investor/Auditor может открыть действие и независимо проверить результат.

---

# 8. Модель тестовой облигации

Для базового demo использовать параметры из challenge:

| Поле | Значение MVP |
|---|---:|
| Face value | 1,000 |
| Currency | Mock USD / Mock KZT |
| Annual coupon | 10% |
| Frequency | Semi-annual |
| Coupon periods/year | 2 |
| Maturity | configurable |
| Bond token | Token-2022 |
| Bond unit | 1 token = 1 bond |

### Coupon formula

```text
coupon_per_holder =
  snapshot_balance
  × face_value
  × annual_coupon_bps / 10_000
  ÷ payments_per_year
```

Пример:

```text
10 bonds × $1,000 × 10% ÷ 2 = $500
```

### Redemption formula

```text
principal_due = snapshot_balance × face_value
```

При final coupon:

```text
final_settlement = principal_due + final_coupon_due
```

Все финансовые расчёты — только integer/fixed-point arithmetic. Float запрещён.

---

# 9. Record Date — критический механизм

## 9.1 Требование

Entitlement должен определяться **балансом на зафиксированную record date**, а не текущим балансом в момент выплаты.

## 9.2 MVP-механизм

Использовать управляемый snapshot flow:

1. `Action` заранее содержит `record_timestamp`.
2. При наступлении record date Operator вызывает `begin_snapshot`.
3. Переводы инструмента временно блокируются (`Paused/SnapshotPending`).
4. Система фиксирует holder balances в `SnapshotPosition / Entitlement` accounts.
5. Проверяется, что сумма snapshot balances соответствует eligible outstanding supply.
6. Вычисляется и сохраняется snapshot hash/root.
7. Operator вызывает `finalize_snapshot`.
8. Snapshot становится immutable.
9. Для coupon transfers могут быть снова разрешены.
10. Для maturity redemption инструмент остаётся ограниченным до завершения погашения.

Это делает демо детерминированным и не позволяет изменить право на выплату переводом токена после record date.

## 9.3 Production evolution

В production возможна замена короткой transfer pause на slot-based snapshot/indexing с криптографическим commitment/Merkle root и интеграцией с внешним реестром/депозитарием.

Для hackathon это post-MVP и не должно усложнять обязательный working flow.

---

# 10. Holder Registry

Система обязана иметь однозначный реестр участников, которые могут владеть инструментом.

Для MVP:
- holder = Solana public key;
- каждому holder соответствует Token-2022 token account;
- создаётся protocol-level `HolderPosition`/registry account;
- holder должен быть approved для данного instrument;
- запрещено учитывать произвольный кошелёк, не входящий в registry;
- transfer control должен не позволять обходить registry.

Рекомендуемая реализация:
- Token-2022;
- Allowlist/Default Frozen State для permissioned security flow;
- Transfer Hook или эквивалентная protocol-level проверка для контролируемого transfer lifecycle;
- Permanent Delegate только для строго определённых admin/redemption операций.

KYC/AML-провайдер в MVP симулируется флагом `approved=true`; реальный KYC не является частью hackathon MVP.

---

# 11. Corporate Action State Machine

```text
DRAFT
  ↓
SCHEDULED
  ↓
SNAPSHOT_PENDING
  ↓
SNAPSHOTTED
  ↓
CALCULATED
  ↓
AWAITING_APPROVAL
  ↓
APPROVED
  ↓
FUNDED / READY
  ↓
EXECUTING
  ↓
SETTLED
  ↓
FINALIZED
```

Error branches:

```text
FAILED
CANCELLED (only before irreversible execution)
INSUFFICIENT_FUNDS
PARTIALLY_SETTLED
```

Каждый переход должен иметь:
- authority check;
- timestamp/slot;
- transaction signature;
- event log;
- невозможность нелегального перехода состояния.

---

# 12. Required Scenario A — Coupon Payment

## UC-CP-01: Выплата купона

### Preconditions
- instrument active;
- coupon action scheduled;
- record date reached;
- snapshot finalized;
- entitlements calculated;
- settlement vault sufficiently funded.

### Flow
1. Operator открывает Coupon Action.
2. Система показывает record date и snapshot holders.
3. Для каждого holder рассчитывается coupon entitlement.
4. Система показывает `total_due`.
5. Operator подтверждает action.
6. Program переводит mock payment token каждому holder либо создаёт on-chain settlement instruction per holder.
7. Для каждого holder фиксируется `paid/initiated` и transaction reference.
8. После полной обработки action = `FINALIZED`.

### Acceptance
- holder with 10 bonds receives exactly 500 units при параметрах примера;
- holder, который получил токены после record date, не получает entitlement;
- holder, который продал токены после snapshot, сохраняет entitlement на этот action;
- повторный settlement одного entitlement невозможен;
- сумма индивидуальных entitlements совпадает с `total_due`.

---

# 13. Required Scenario B — Bond Redemption

## UC-BR-01: Погашение облигации в maturity

### Flow
1. Maturity date reached.
2. Создаётся/finalizes redemption snapshot.
3. Для каждого holder рассчитывается principal due.
4. При необходимости добавляется final coupon.
5. Operator подтверждает settlement.
6. Holder получает payment token / settlement record.
7. Соответствующие bond tokens burn/retire/lock.
8. `redeemed_supply` увеличивается.
9. Когда `redeemed_supply == eligible outstanding supply`, instrument получает статус `MATURED/REDEEMED`.
10. ActionReceipt фиксирует финальный outcome.

### Acceptance
- 10 bonds × 1,000 = 10,000 principal;
- final coupon учитывается отдельно и виден в UI;
- один и тот же token unit нельзя redeem дважды;
- redeemed units больше не могут обращаться как активные облигации;
- total redeemed principal совпадает с snapshot obligation.

---

# 14. Required Scenario C — Bondholder Voting

Выбранное дополнительное corporate action: **Bondholder Voting**.

Почему именно оно:
- использует тот же record-date/holder snapshot;
- показывает, что движок обслуживает не только выплаты;
- демонстрирует generic lifecycle infrastructure;
- добавляет инновационность без необходимости внешнего payment rail.

## UC-VOTE-01: Голосование держателей облигаций

### Example proposal

> “Approve modification of maturity date / coupon terms.”

### Flow
1. Operator создаёт Proposal.
2. Задаёт record date и voting window.
3. Фиксируется snapshot holders.
4. `voting_power = snapshot_balance`.
5. Holder выбирает `YES / NO / ABSTAIN`.
6. Program не позволяет проголосовать повторно тем же voting power.
7. После deadline рассчитываются totals и quorum.
8. Result записывается on-chain и связывается с instrument/action.

### Acceptance
- voting power не меняется после передачи токенов после record date;
- двойное голосование невозможно;
- сумма использованного voting power не превышает snapshot supply;
- итог и quorum независимо проверяемы.

---

# 15. Human-in-the-Loop / контроль исполнения

Ни одно денежное или необратимое corporate action не должно автоматически исполняться только потому, что наступила дата.

MVP обязан требовать явное подтверждение Operator перед:
- settlement;
- burn/retirement;
- досрочным закрытием action;
- изменением instrument status.

Automation рассчитывает и подготавливает действие; authority подтверждает исполнение.

---

# 16. Functional Requirements (FR)

## Instrument
- **FR-01** Создать tokenized bond instrument.
- **FR-02** Хранить face value, currency, coupon rate, frequency, maturity, issuer, mint.
- **FR-03** Выпустить test supply Token-2022.
- **FR-04** Распределить токены между test holders.
- **FR-05** Отображать outstanding / redeemed supply.

## Registry & transfer control
- **FR-06** Создать holder registry.
- **FR-07** Approve/revoke test holder.
- **FR-08** Запретить обход registry при переводе инструмента.
- **FR-09** Показывать текущий баланс каждого registered holder.

## Record date
- **FR-10** Создать corporate action с record date.
- **FR-11** Запустить snapshot только authorized role.
- **FR-12** Зафиксировать balance каждого eligible holder.
- **FR-13** Финализировать immutable snapshot.
- **FR-14** Сохранить snapshot timestamp/slot/hash.
- **FR-15** Не использовать post-record transfers для пересчёта уже final snapshot.

## Entitlements
- **FR-16** Рассчитывать coupon entitlement.
- **FR-17** Рассчитывать redemption principal.
- **FR-18** Рассчитывать final coupon отдельно.
- **FR-19** Рассчитывать voting power.
- **FR-20** Использовать fixed-point/integer math.
- **FR-21** Сохранять per-holder entitlement on-chain.
- **FR-22** Сохранять aggregate total obligation.

## Coupon
- **FR-23** Preview coupon distribution.
- **FR-24** Требовать explicit approval.
- **FR-25** Выполнить/инициировать settlement.
- **FR-26** Защититься от double payment.
- **FR-27** Финализировать coupon action.

## Redemption
- **FR-28** Запустить redemption по maturity.
- **FR-29** Выполнить/инициировать principal settlement.
- **FR-30** Burn/retire/lock redeemed bond units.
- **FR-31** Защититься от double redemption.
- **FR-32** Mark instrument redeemed после полного погашения.

## Voting
- **FR-33** Создать proposal.
- **FR-34** Задать voting record date/window/quorum.
- **FR-35** Vote YES/NO/ABSTAIN.
- **FR-36** Запретить double vote.
- **FR-37** Финализировать tally on-chain.

## Audit
- **FR-38** Для каждого action иметь unique ID/PDA.
- **FR-39** Логировать ключевые state transitions.
- **FR-40** Показывать transaction signatures.
- **FR-41** Создавать финальный ActionReceipt.
- **FR-42** Auditor должен иметь read-only verification view.

---

# 17. Non-Functional Requirements (NFR)

- **NFR-01 Determinism:** одинаковые snapshot inputs всегда дают одинаковые entitlement outputs.
- **NFR-02 Precision:** никаких floating-point денежных расчётов.
- **NFR-03 Idempotency:** повторный вызов settle/redeem не создаёт повторную выплату.
- **NFR-04 Authorization:** privileged actions только соответствующим authority.
- **NFR-05 Auditability:** любой finalized action связан с on-chain state и transaction signatures.
- **NFR-06 Immutability:** finalized snapshot нельзя изменить.
- **NFR-07 Atomicity where possible:** irreversible token state change и соответствующая settlement state должны быть связаны одной транзакцией либо строгой state machine.
- **NFR-08 Recoverability:** partial batch failure можно безопасно продолжить без double settlement.
- **NFR-09 UX clarity:** пользователь видит record date, formula, snapshot balance, entitlement, status и tx proof.
- **NFR-10 Devnet reproducibility:** judge может воспроизвести demo по README.
- **NFR-11 Separation:** UI/backend не являются источником истины для finalized entitlement; критический state хранится/валидируется Solana program.
- **NFR-12 Security:** admin keys не хардкодятся в frontend/repository.

---

# 18. On-chain data model

Минимальные PDA/accounts:

## `Instrument`
```text
instrument_id
issuer_authority
mint
face_value_minor
currency_code
coupon_bps
payments_per_year
maturity_timestamp
outstanding_supply
redeemed_supply
status
```

## `HolderPosition`
```text
instrument
holder_wallet
token_account
approved
```

## `CorporateAction`
```text
action_id
instrument
action_type
record_timestamp
record_slot
status
snapshot_hash
total_eligible_units
total_obligation_minor
created_by
approved_by
```

## `Entitlement`
```text
action
holder
snapshot_units
amount_minor
settlement_status
settlement_tx/reference
redeemed_units
```

## `Proposal` / `VoteReceipt`
```text
proposal
holder
snapshot_voting_power
choice
cast_at
```

## `ActionReceipt`
```text
action
final_status
settled_total_minor
processed_holders
finalized_at
summary_hash
```

---

# 19. Solana architecture

## Core
- **Anchor program (Rust)** — corporate-action state machine, entitlement validation, redemption/voting logic.
- **Token-2022** — tokenized bond.
- **Token-2022 extensions** as appropriate:
  - Transfer Hook / access controls;
  - Default frozen / permissioned holder flow;
  - Permanent Delegate for controlled retirement/burn where required;
  - Pausable control where practical.
- **Mock settlement token** — SPL/Token-2022 token representing test fiat/stable settlement asset.

## Client
- **Next.js + TypeScript**.
- Solana wallet adapter.
- Operator Console.
- Investor/Auditor views.

## Optional off-chain helper
Allowed only for orchestration/indexing:
- enumerate known holder accounts;
- batch submit snapshot/settlement transactions;
- cache UI data;
- generate technical report.

It must **not** be the final source of truth for finalized entitlement/outcome.

---

# 20. Settlement model

## MVP preferred path — fully demonstrable
Use mock settlement token:

```text
Issuer Treasury → Action Vault → Eligible Holder
```

Advantages:
- judge sees actual balance movement;
- settlement is independently verifiable;
- no fake bank integration required;
- satisfies “execute payment on-chain”.

## Alternative / fallback
Fiat settlement can be simulated as:

```text
Entitlement → PaymentInstructionCreated → external_reference_hash → Settled
```

UI must clearly mark it **SIMULATED / INITIATED**, never “paid on-chain”.

---

# 21. UX requirements

## Screen 1 — Instruments
- instrument status;
- token supply;
- coupon/maturity;
- next action;
- holders count.

## Screen 2 — Holder Registry
- holder wallet;
- approved status;
- current units;
- test transfer controls.

## Screen 3 — Corporate Actions
Timeline/cards:
- Coupon #1;
- Redemption;
- Voting proposal.

Each card shows:
- action type;
- record date;
- state;
- eligible holders;
- total obligation;
- on-chain proof.

## Screen 4 — Action Detail
The most important screen.

Must visually show:

```text
Record Date
↓
Snapshot
↓
Holder × Units
↓
Formula
↓
Entitlement
↓
Approval
↓
Settlement / Burn / Vote
↓
On-chain Receipt
```

## Screen 5 — Investor
- “You held X units on record date”;
- “Your entitlement = Y”;
- formula;
- state;
- transaction link.

## Screen 6 — Audit
- inputs;
- snapshot hash;
- calculated totals;
- processed totals;
- mismatches = 0;
- tx signatures;
- final receipt.

---

# 22. Demo dataset

Минимум 4 wallets:

| Holder | Record-date units | Coupon due |
|---|---:|---:|
| A | 10 | 500 |
| B | 5 | 250 |
| C | 2 | 100 |
| D | 0 | 0 |

После snapshot:
- A переводит 4 bonds B.

Ожидаемый результат:
- Coupon action всё равно использует snapshot A=10, B=5.
- Новый current balance не меняет уже зафиксированный entitlement.

Это обязательный demo edge case, потому что он наглядно доказывает смысл record date.

---

# 23. Test cases / acceptance matrix

## Coupon
- TC-01 exact formula for 10 bonds = 500.
- TC-02 zero balance = zero entitlement.
- TC-03 post-record transfer does not alter entitlement.
- TC-04 cannot settle same entitlement twice.
- TC-05 aggregate total = sum(holder entitlements).

## Redemption
- TC-06 10 bonds = 10,000 principal.
- TC-07 final coupon can be included separately.
- TC-08 token units are retired/burned after redemption.
- TC-09 redeemed token cannot be redeemed again.
- TC-10 instrument final state correct after full redemption.

## Voting
- TC-11 voting power equals snapshot units.
- TC-12 post-record transfer does not change voting power.
- TC-13 no double vote.
- TC-14 tally equals sum of valid VoteReceipts.

## Security/state
- TC-15 unauthorized wallet cannot approve/settle.
- TC-16 finalized snapshot cannot mutate.
- TC-17 invalid state transition rejected.
- TC-18 insufficient settlement funding blocks execution.
- TC-19 partial batch can resume safely.

---

# 24. Definition of Done — Hackathon MVP

MVP считается готовым только если в live demo можно последовательно показать:

- [ ] Token-2022 test bond существует on-chain.
- [ ] Есть 3+ registered holders.
- [ ] Балансы распределены.
- [ ] Coupon corporate action создан.
- [ ] Record-date snapshot реально фиксируется.
- [ ] Entitlements реально рассчитываются.
- [ ] Coupon settlement реально проходит через Solana или чётко демонстрируется settlement initiation.
- [ ] Transaction/receipt можно проверить.
- [ ] Redemption рассчитывает principal.
- [ ] Redemption реально burn/retire/lock соответствующие units.
- [ ] Нельзя redeem второй раз.
- [ ] Bondholder Voting работает как третий action.
- [ ] Voting power основан на record-date snapshot.
- [ ] Есть final on-chain record для каждого scenario.
- [ ] UI ясно различает IMPLEMENTED и SIMULATED.
- [ ] README позволяет judge воспроизвести demo.
- [ ] Demo video показывает полный E2E, а не только интерфейс.

---

# 25. Что НЕ входит в MVP

Не тратить hackathon-время на:
- полноценную matching/trading engine;
- order book;
- production-grade CSD replacement;
- реальную интеграцию с банковскими rails;
- production KYC/AML vendor;
- юридическое признание токена как реальной ценной бумаги;
- mainnet deployment;
- сложный RWA marketplace;
- secondary trading UI;
- multi-chain;
- DAO/governance framework общего назначения;
- AI/LLM;
- масштабную microservice architecture.

Это всё не является ядром challenge.

---

# 26. Приоритет разработки

## P0 — обязательно
1. Instrument + Token-2022.
2. Holder registry.
3. Record-date snapshot.
4. Entitlement engine.
5. Coupon settlement.
6. Redemption + token retirement.
7. On-chain receipts.
8. Bondholder voting.
9. Operator UI + audit view.

## P1 — если P0 стабилен
- batch processing;
- richer transfer controls;
- Merkle snapshot commitment;
- downloadable action report;
- role separation issuer/operator/auditor;
- event timeline.

## P2 — post-MVP
- partial/early redemption;
- dividends;
- tender offer/buyback;
- modification workflow;
- real KYC/AML;
- external fiat rails;
- depository integrations;
- production-grade compliance/custody.

---

# 27. Mapping на judging criteria

## Technical Execution — 30%
Показать не макет, а реальные Solana transactions, state machine, Token-2022, snapshot, settlement, burn/retirement и tests.

## Corporate Action Logic — 25%
Это главный слой продукта:
- record date;
- immutable snapshot;
- eligibility;
- deterministic entitlement;
- no double settlement;
- correct redemption.

## Product & UX — 20%
UI должен объяснять сложную финансовую механику простым визуальным pipeline и давать auditability.

## Real-World Applicability — 15%
Подчеркнуть:
- permissioned holders;
- explicit operator approval;
- separation of on-chain entitlement and external settlement;
- audit trail;
- ability to integrate with CSD/KASE/issuer systems later.

## Innovation — 10%
Не продавать “blockchain because blockchain”.

Инновация:
> **универсальный programmable lifecycle engine**, где один record-date/snapshot/entitlement слой обслуживает выплаты, redemption и governance events.

---

# 28. Главная метрика успешности MVP

Не TVL, не число кошельков и не скорость UI.

### Primary Product Metric

> **100% корректно и воспроизводимо обработанные corporate-action entitlements для всех holders в тестовом сценарии с проверяемым on-chain outcome.**

### Demo KPIs
- entitlement mismatch: **0**;
- double settlement: **0**;
- unauthorized execution: **0**;
- corporate actions demonstrated E2E: **3/3**;
- each finalized action has verifiable on-chain proof: **100%**.

---

# 29. Критический demo narrative

Не начинать презентацию со слов “мы выпустили токен на Solana”.

Начать с проблемы:

> “Выпустить токенизированную облигацию недостаточно. Через шесть месяцев кто-то должен точно определить, кто владел ею на record date, сколько купона положено каждому инвестору, провести выплату, затем при maturity погасить principal и доказать результат. Мы построили именно этот lifecycle layer.”

Затем live flow:

```text
Bond issued
→ 3 holders
→ record date
→ snapshot
→ entitlement = 500 / 250 / 100
→ holder transfers bonds after snapshot
→ entitlement does NOT change
→ approve
→ on-chain coupon settlement
→ maturity redemption
→ burn/retire
→ voting from the same snapshot engine
→ audit receipt
```

Это напрямую демонстрирует бизнес-смысл трека.

---

# 30. Архитектурный принцип принятия решений

При любом споре “что добавить?” использовать порядок:

1. Улучшает ли это корректность **Record Date → Entitlement → Execution → Proof**?
2. Требуется ли это Required Scenarios / Minimum Prototype Requirements?
3. Повышает ли это Technical Execution / Corporate Action Logic / Product UX / Real-World Applicability?
4. Можно ли это показать в live demo?

Если ответ “нет” — функциональность не входит в MVP.

---

# 31. Источники и основание ТЗ

1. Superteam Kazakhstan x KASE Side Track — Corporate Actions on Blockchain  
   https://superteam.fun/earn/listing/superteam-kazakhstan-x-kase-side-track-corporate-actions-on-blockchain

2. KASE — Corporate Events  
   https://kase.kz/ru/information/corporate-events

3. Solana — Asset Issuance & Tokenization  
   https://solana.com/docs/tokenization

4. Solana — Token Extensions  
   https://solana.com/docs/tokens/extensions

5. Solana — Permanent Delegate  
   https://solana.com/docs/tokens/extensions/permanent-delegate

6. Solana — Default Account State  
   https://solana.com/docs/tokens/extensions/default-state

7. Solana — Permissioned Tokens / Token ACL  
   https://solana.com/docs/tokenization/token-acl

---

# 32. Итоговая формулировка продукта

**KASE Corporate Actions Engine** — прототип infrastructure layer на Solana для обслуживания жизненного цикла токенизированных финансовых инструментов: он фиксирует eligible holders на record date, детерминированно рассчитывает права, исполняет или инициирует corporate action и оставляет проверяемый on-chain результат.

**Главная бизнес-ценность:** сделать tokenized security не просто выпускаемым и передаваемым активом, а **операционно обслуживаемым финансовым инструментом на всём lifecycle**.