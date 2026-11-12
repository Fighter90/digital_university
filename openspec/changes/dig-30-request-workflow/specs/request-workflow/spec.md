# Delta: request-workflow (заявки и справки — серверная логика)

## ADDED Requirements

### Requirement: Машина статусов заявки

Разрешённые переходы (и только они):

- `SUBMITTED → ACCEPTED` (STAFF), `SUBMITTED → NEEDS_FIX` (STAFF, причина
  обязательна), `SUBMITTED → REJECTED` (STAFF, причина обязательна),
  `SUBMITTED → CANCELLED` (STUDENT), `SUBMITTED → READY` (SYSTEM —
  мгновенные типы).
- `ACCEPTED → IN_PROGRESS` (STAFF), `ACCEPTED → NEEDS_FIX` (STAFF, причина),
  `ACCEPTED → REJECTED` (STAFF, причина), `ACCEPTED → CANCELLED` (STUDENT).
- `IN_PROGRESS → READY` (STAFF), `IN_PROGRESS → NEEDS_FIX` (STAFF, причина),
  `IN_PROGRESS → REJECTED` (STAFF, причина).
- `NEEDS_FIX → SUBMITTED` (STUDENT — исправление), `READY → ISSUED` (STAFF).

Переходы из терминальных статусов (ISSUED, REJECTED, CANCELLED, READY кроме
READY→ISSUED) запрещены. Недопустимый переход отклоняется структурированной
ошибкой (код INVALID_TRANSITION / ROLE_FORBIDDEN / REASON_REQUIRED), сессия
и данные не меняются.

#### Scenario: недопустимый переход отклоняется

- **WHEN** попытка `SUBMITTED → READY` от STAFF (не мгновенный тип)
- **THEN** результат `{ ok: false, code: 'INVALID_TRANSITION' }`, заявка
  остаётся в SUBMITTED, событий и уведомлений нет.

#### Scenario: студент не может перевести в READY

- **WHEN** студент вызывает переход `IN_PROGRESS → READY`
- **THEN** `{ ok: false, code: 'ROLE_FORBIDDEN' }` + запись в audit log.

#### Scenario: NEEDS_FIX и REJECTED требуют причину

- **WHEN** STAFF переводит в NEEDS_FIX/REJECTED без причины
- **THEN** `{ ok: false, code: 'REASON_REQUIRED' }`.

#### Scenario: отмена студентом только до IN_PROGRESS

- **WHEN** студент отменяет заявку из SUBMITTED или ACCEPTED
- **THEN** переход разрешён, статус CANCELLED;
  **WHEN** из IN_PROGRESS/READY — **THEN** INVALID_TRANSITION.

### Requirement: События и уведомления переходов

Каждый переход пишет `RequestEvent` (кто, когда, from→to, комментарий) и
создаёт владельцу уведомление вида
«Заявка ЗД-2026-000123 «Справка для военкомата»: Принята → В работе.
Готовность до 14 ноября» — с номером, названием и конкретикой статуса
(готовность по SLA; причина для NEEDS_FIX/REJECTED).

#### Scenario: уведомление с готовностью по SLA

- **WHEN** сотрудник переводит SUBMITTED→IN_PROGRESS с SLA-датой 14 ноября
- **THEN** уведомление содержит номер, название, «Принята → В работе»,
  «Готовность до 14 ноября» и ссылку на заявку.

### Requirement: Номер заявки

Номер формата «ЗД-<год>-<6 цифр>» (например, ЗД-2026-000123), уникален в
пределах хранилища; выделяется адаптером при создании заявки.

#### Scenario: последовательные уникальные номера

- **WHEN** студент подаёт две заявки в 2026 году
- **THEN** номера вида ЗД-2026-000001, ЗД-2026-000002 — без коллизий.

### Requirement: Название заявки

Название всегда «тип · ключевой параметр» из полей формы
(«Справка об обучении · для банка»); без параметров — просто название типа
(«Справка для военкомата»).

### Requirement: Подача заявки с валидацией полей формы

`submitRequest` валидирует поля по zod-схеме типа; неизвестный тип и
некорректные поля отклоняются структурированной ошибкой. Сотрудник подать
заявку не может (ROLE_FORBIDDEN).

#### Scenario: повторный заказ готовой справки за 24 часа

- **WHEN** студент повторно заказывает тот же тип, а его заявка этого типа
  создана менее 24 часов назад и имеет статус READY/ISSUED с файлом
- **THEN** `{ ok: false, code: 'DUPLICATE_READY', existing }` — вызывающий
  предлагает скачать уже готовый документ.

### Requirement: Мгновенные типы

«Справка об обучении» и «Выписка оценок» при подаче сразу переходят в READY
(события SUBMITTED→READY от автоматики, `actorRole: null`) с доступным PDF:
справка — `/api/requests/<номер>/pdf` (генерируется из данных владельца,
отдаётся только владельцу READY/ISSUED-заявки, чужой и незрелый статус —
единый 404), выписка — существующий `/api/grades/transcript`.

#### Scenario: мгновенная справка готова сразу

- **WHEN** студент подаёт «Справку об обучении · для банка»
- **THEN** заявка READY, resultUrl указывает на PDF, история содержит
  автоматическое событие READY.

### Requirement: SLA-дата готовности

Расчётная дата готовности = SLA типа в рабочих днях от момента подачи с
пропуском субботы и воскресенья (пятница + 2 рабочих дня = вторник).

### Requirement: Канонический словарь статусов

TS-словарь статусов — 8 значений канона (SUBMITTED, ACCEPTED, IN_PROGRESS,
READY, ISSUED, NEEDS_FIX, REJECTED, CANCELLED); сиды и дашборд переведены
(NEEDS_REVISION→NEEDS_FIX, COMPLETED→ISSUED); бейджи и «в работе» на
дашборде работают с новым словарём.
