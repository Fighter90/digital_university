# Delta: data-model

## ADDED

### Requirement: Модели предметной области в Prisma-схеме

Схема `prisma/schema.prisma` описывает все сущности кабинета: доступ
(User, Session), структуру вуза (Faculty, Program, Group, Student, Teacher),
учёбу (Discipline, Enrollment, Assessment, Grade, Exam, ScheduleEvent,
StudentNote), заявки (RequestType, Request, RequestEvent), уведомления
(Notification, NotificationPref), обращения (Ticket, TicketMessage), контент
(News, FaqArticle), AI (AiChat, AiMessage), аудит (AuditLog) и выданные
справки (CertificateIssue).

#### Scenario: Схема валидна и полна

- WHEN выполняют `prisma validate` и тесты `tests/prisma-schema.test.mjs`
- THEN все 27 моделей объявлены, схема валидна для provider `postgresql`

### Requirement: Единый словарь статусов заявки

Статус заявки — перечисление `RequestStatus` ровно из 8 значений:
`SUBMITTED` (Подана), `ACCEPTED` (Принята), `IN_PROGRESS` (В работе),
`READY` (Готова), `ISSUED` (Выдана), `NEEDS_FIX` (Нужна доработка),
`REJECTED` (Отклонена), `CANCELLED` (Отменена студентом). Синонимы запрещены.

#### Scenario: Ровно 8 статусов

- WHEN тест извлекает значения enum `RequestStatus`
- THEN их ровно 8 и они совпадают с каноническим списком

### Requirement: Номер заявки уникален и человекочитаем

Поле `Request.number` уникально; формат `ЗД-<год>-<6 цифр>` (например
`ЗД-2026-000123`) гарантируется CHECK-констрейнтом в миграции, значения
последовательности берутся из `request_number_seq`.

#### Scenario: Плохой формат отклоняется БД

- WHEN вставить заявку с номером `BAD-1`
- THEN PostgreSQL возвращает `check_violation`

### Requirement: Индексы

Каждое поле-внешний ключ проиндексировано; присутствуют композитные индексы
`ScheduleEvent (groupId, startsAt)` и `Notification (userId, readAt)`.

#### Scenario: Нет внешних ключей без индекса

- WHEN тест разбирает `migration.sql` и собирает все `FOREIGN KEY` и первые
  колонки всех индексов (включая UNIQUE-индексы)
- THEN множество FK без индекса пусто

### Requirement: Полнотекстовый поиск по FAQ (russian)

Миграция создаёт генерируемую колонку `FaqArticle.search`
(`setweight(to_tsvector('russian', title), 'A') || setweight(to_tsvector('russian', body), 'B')`,
STORED) и GIN-индекс.

#### Scenario: Поиск по словоформе

- WHEN вставить статью «Как получить справку…» и искать
  `search @@ to_tsquery('russian', 'справках')`
- THEN статья найдена

### Requirement: Оценки в диапазоне 0..10

`Grade.value` ограничен CHECK-констрейнтом `value >= 0 AND value <= 10`.

#### Scenario: Оценка вне диапазона отклоняется

- WHEN вставить оценку со значением 15
- THEN PostgreSQL возвращает `check_violation`

### Requirement: Миграция применяется на чистой БД

Единая миграция `20261111000000_init` применяется командой
`prisma migrate deploy` на пустой базе без ручных шагов.

#### Scenario: Чистая база

- WHEN поднять пустой PostgreSQL и выполнить `prisma migrate deploy`
- THEN все объекты созданы, повторный запуск не делает изменений
