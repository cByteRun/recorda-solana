# Asset tokenization: исследование и операторский обзор

Дата исследования: 2026-10-12. Область: интерфейс Recorda BondOps, текущий read model и границы ТЗ. Это оценка продуктового покрытия по исходникам; она не закрывает live Devnet acceptance и не является правовым заключением.

## Что даёт reference

[Chainlink: Asset Tokenization](https://chain.link/education/asset-tokenization) описывает токенизацию как представление прав на актив в блокчейне. Для нашего обзора применимы связь актива с инструментом, прозрачность владения и проверяемость обслуживания. Статья рассматривает выпуск, хранение, передачу и расчёты, а также внешние данные для активов, состояние которых нельзя установить только из блокчейна.

[Chainlink: How to Tokenize an Asset](https://chain.link/education-hub/how-to-tokenize-an-asset) уточняет выбор актива, токена и сети, внешнюю проверку и механизмы контроля обеспечения. Это общий маршрут и описание сервисов Chainlink, а не нормативный checklist KASE. Применимость резервов, цены и межсетевого обмена зависит от модели конкретного актива.

**Вывод для Recorda:** центральная ось остаётся «Инструмент → Держатель → Право на record date → Авторизованное действие → Итоговая запись». Ценность — контроль фиксированных обязательств, подтверждений и исключений. Для неё полезнее показать следующий шаг действия и состояние обслуживаемого выпуска, чем добавлять рыночные графики без источника данных.

## Покрытие и реальные границы

| Область | Что есть в Recorda | Что оператор видит / что остаётся |
|---|---|---|
| Актив и условия выпуска | Базовые условия тестовой облигации: номинал, купон, частота, maturity; instrument account, authority | Новый раскрываемый блок «Активы в обслуживании» показывает поля instrument account. Изменения governance и fixed terms конкретного действия проверяются в action flow. Номинал явно не называется рыночной стоимостью. FR-01–05, TZ §8. |
| Представление токена и сеть | Token-2022, whole-bond units; program-owned mint/freeze authority; отдельные Localnet/Devnet | В live раскрываются сеть, стандарт и account выпуска; в Demo — иллюстративная облигация. `bondops-reader.js` сверяет mint и supply. |
| Владение / реестр / передача | Зарегистрированные позиции и контролируемые переводы, сверка supply; текущие позиции отдельно от исторических прав | Реестр доступен из карточки выпуска. Перевод меняет владельца, погашение уменьшает outstanding supply. FR-06–09. |
| Record date и фиксированные права | Cutoff barrier, полный снимок, per-holder rights, immutable action terms | Новый обзор показывает собственный cutoff каждого действия и отделяет незавершённый snapshot от зафиксированных прав. FR-10–22. |
| Купон / расчёты | Одобрение, action vault, исполнение mock currency, дедупликация, права и receipt | Очередь следующего шага; unknown/pending ведут на сверку перед повторной выплатой. Старые Expected/Confirmed/Unsettled и кейсы сохраняются. FR-23–27, BO-02–03. |
| Погашение / жизненный цикл актива | Principal и final coupon отдельно; holder-signed atomic burn/payment; retired supply | Новый обзор показывает компоненты только после полного проверенного расчёта, необходимость подписи держателя и retired/outstanding supply. FR-28–32,45–46. |
| Решения держателей | Голоса из cutoff units, YES/NO/ABSTAIN, quorum, tally и receipt | Голосование получает собственную карточку с кворумом, доступными голосами и следующим шагом; funding и денежные обязательства отсутствуют. FR-33–37,47. |
| Доказательства и полномочия | Independent audit, finalized program reads, action/right/receipt links, program signer checks | Неуспешная verification направляет на проверку даже при сохранённом receipt. «Исполнено» без receipt показывает следующий шаг финализации. FR-38–42,48, BO-04–05. |
| Документы и связь с реальным активом | В protocol extensions есть versioned terms URI/hash и external-event provenance | Обзор не получает документарный пакет, независимую проверку эмитента/обеспечения или юридического права. FR-55/57 не доказывают реальное обеспечение. Требуется отдельная интеграция и acceptance. |
| Внешнее исполнение / данные | Источники и roadmap описаны в `/infrastructure`; банк не подключён | Новый блок границ доказательств сообщает об отсутствии внешних документов, резервов и bank confirmations. Ссылка на источник не считается выплатой. BO-07 отложен. |
| Production eligibility / custody / secondary market | Контролируемый реестр и версии политики; eligibility MVP имитируется | Реальный KYC/AML, production custody, exchange trading и mainnet/legal rollout остаются вне MVP согласно TZ §26. Никакой новой «compliant» метки. |
| Цена / NAV / резервы / cross-chain | Live feed и Chainlink integration отсутствуют | Не добавлены фиктивные valuation, PoR, CCIP или ликвидность. Для долгового инструмента требования к обеспечению определяются моделью выпуска; funding action vault подтверждает готовность конкретной выплаты, а не обеспечение всей облигации. |

Recorda покрывает функциональное ядро **прототипа обслуживания токенизированных облигаций**. Это не утверждение готовности production RWA. Coupon имеет историческое human Devnet evidence; полный human-signed Coupon → Voting → Full Redemption acceptance и submission gates остаются в [REQUIREMENTS](REQUIREMENTS.md#24-definition-of-done--hackathon-mvp) и [ROADMAP](ROADMAP.md).

## Обновлённый dashboard

1. «Контроль корпоративных действий» показывает все выпуски/активы; фильтры следующего шага заменяют прежние общие ссылки pipeline. Review evidence имеет приоритет, затем просроченные действия. Даты дают информацию о сроке, а не право исполнения.
2. Каждая карточка содержит тип действия, состояние, cutoff, отдельный due/close/maturity, источник срока, snapshot units, approval и следующий маршрут. Voting исключён из funding/payment. Redemption требует holder signature и контроля retirement.
3. Финансовые итоги по выбранному settlement mint, сверка держателей и кейсы остаются центральными. Денежные значения разных mints не складываются; карточки действий используют свою валюту/precision.
4. «Активы в обслуживании» показывает относящиеся к выбранному settlement asset выпуски. Terms/supply доступны по раскрытию; внешние границы доказательств находятся рядом. Demo labels и отсутствие Explorer для фиктивных accounts сохранены.
5. Все новые сообщения поддерживают EN/RU, темы, клавиатуру и мобильную ширину. Фильтры доступны как buttons с `aria-pressed`; раскрытие условий — native `details`.

Новые financial instructions, backend acceptance claims и полномочия UI не добавлены. Следующий шаг ведёт в существующий authorized flow, а не отправляет транзакцию с overview.

## Проверка

`tests/asset-control.spec.ts` проверяет cutoff против current holdings, отдельный voting flow, uncertain evidence перед retry, незавершённый расчёт, отсутствие подтверждённого receipt, redemption components/signature, выбор settlement mint, EN/RU и адаптивность. `tests/bondops.spec.ts` сохраняет regression reconciliation/cases. TypeScript и browser results фиксируются при выполнении изменения; сохранённые скриншоты — `target/design-evidence/asset-control-*`.

Фактическая проверка 2026-10-12: `npx playwright test --config playwright.bondops.config.ts tests/asset-control.spec.ts tests/bondops.spec.ts` — **19 passed**; `npm run build` (TypeScript + Vite production build) — PASS; `git diff --check` — PASS. Новые projection tests получают изолированные session/workspace responses и не расходуют общий лимит demo authentication; regression suite работает с настоящим локальным Demo API. Это локальная проверка интерфейса, не human Devnet evidence.
