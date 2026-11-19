# data-model Specification

## Purpose
Prisma-схема предметной области: 27+ моделей канона и сидов, словари, индексы, миграция с ручными фрагментами (sequence, CHECK, FTS).
## Requirements
### Requirement: Модели предметной области в Prisma-схеме

Требование «Модели предметной области в Prisma-схеме» — обязательное (MUST): Схема `prisma/schema.prisma` описывает все сущности кабинета: доступ
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

Требование «Единый словарь статусов заявки» — обязательное (MUST): Статус заявки — перечисление `RequestStatus` ровно из 8 значений:
`SUBMITTED` (Подана), `ACCEPTED` (Принята), `IN_PROGRESS` (В работе),
`READY` (Готова), `ISSUED` (Выдана), `NEEDS_FIX` (Нужна доработка),
`REJECTED` (Отклонена), `CANCELLED` (Отменена студентом). Синонимы запрещены.

#### Scenario: Ровно 8 статусов

- WHEN тест извлекает значения enum `RequestStatus`
- THEN их ровно 8 и они совпадают с каноническим списком

### Requirement: Номер заявки уникален и человекочитаем

Требование «Номер заявки уникален и человекочитаем» — обязательное (MUST): Поле `Request.number` уникально; формат `ЗД-<год>-<6 цифр>` (например
`ЗД-2026-000123`) гарантируется CHECK-констрейнтом в миграции, значения
последовательности берутся из `request_number_seq`.

#### Scenario: Плохой формат отклоняется БД

- WHEN вставить заявку с номером `BAD-1`
- THEN PostgreSQL возвращает `check_violation`

### Requirement: Индексы

Требование «Индексы» — обязательное (MUST): Каждое поле-внешний ключ проиндексировано; присутствуют композитные индексы
`ScheduleEvent (groupId, startsAt)` и `Notification (userId, readAt)`.

#### Scenario: Нет внешних ключей без индекса

- WHEN тест разбирает `migration.sql` и собирает все `FOREIGN KEY` и первые
  колонки всех индексов (включая UNIQUE-индексы)
- THEN множество FK без индекса пусто

### Requirement: Полнотекстовый поиск по FAQ (russian)

Требование «Полнотекстовый поиск по FAQ (russian)» — обязательное (MUST): Миграция создаёт генерируемую колонку `FaqArticle.search`
(`setweight(to_tsvector('russian', title), 'A') || setweight(to_tsvector('russian', body), 'B')`,
STORED) и GIN-индекс.

#### Scenario: Поиск по словоформе

- WHEN вставить статью «Как получить справку…» и искать
  `search @@ to_tsquery('russian', 'справках')`
- THEN статья найдена

### Requirement: Оценки в диапазоне 0..10

Требование «Оценки в диапазоне 0..10» — обязательное (MUST): `Grade.value` ограничен CHECK-констрейнтом `value >= 0 AND value <= 10`.

#### Scenario: Оценка вне диапазона отклоняется

- WHEN вставить оценку со значением 15
- THEN PostgreSQL возвращает `check_violation`

### Requirement: Миграция применяется на чистой БД

Требование «Миграция применяется на чистой БД» — обязательное (MUST): Единая миграция `20261111000000_init` применяется командой
`prisma migrate deploy` на пустой базе без ручных шагов.

#### Scenario: Чистая база

- WHEN поднять пустой PostgreSQL и выполнить `prisma migrate deploy`
- THEN все объекты созданы, повторный запуск не делает изменений

### Requirement: Объединённая схема — канон DIG-9 + сиды DIG-10 + auth DIG-11

Требование «Объединённая схема — канон DIG-9 + сиды DIG-10 + auth DIG-11» — обязательное (MUST): Схема `prisma/schema.prisma` валидна (`prisma validate`) и содержит модели
канона (User, Session, Faculty, Program, Group, Student, Teacher, Discipline,
DisciplineTeachers, Enrollment, Assessment, Grade, Exam, ScheduleEvent,
StudentNote, RequestType, Request, RequestEvent, Notification,
NotificationPref, Ticket, TicketMessage, News, FaqArticle, AiChat, AiMessage,
AuditLog, CertificateIssue), добавки сидов (Staff, NewsPost, Appeal,
AppealMessage, AssessmentElement, ExamSession, ServiceRequest) и их словари
(ActorRole, AppealStatus, ElementKind, RequestKind, ScheduleKind,
ScheduleStatus; ExamKind дополнен RETAKE, NotificationKind — DEADLINE).

#### Scenario: Контракты канона зелёные

- WHEN выполняют `node --test tests/prisma-schema.test.mjs`
- THEN все 14 тестов зелёные: 27 моделей, Role с failedLogins/lockedUntil,
  Session с tokenHash, RequestStatus из ровно 8 значений, словари расписания
  ScheduleEventType/EventStatus, составные индексы (groupId, startsAt) и
  (userId, readAt), каждый FK проиндексирован, номер «ЗД-ГГГГ-NNNNNN»
  (sequence + CHECK + UNIQUE), FTS FaqArticle (russian) + GIN,
  CHECK Grade.value 0..10, CREATE TABLE всех моделей.

### Requirement: Пароли хранятся только в User

Требование «Пароли хранятся только в User» — обязательное (MUST): Профили Student/Staff не содержат passwordHash. Seed создаёт User-строки
(role STUDENT/STAFF) с bcrypt-хэшами из prisma/seed-data.ts и связывает
профили с User (Student.userId, обязательный 1:1).

#### Scenario: Сид заводит трёх пользователей

- WHEN выполняют `prisma db seed` на БД после миграции
- THEN таблица User содержит 3 строки (2 STUDENT, 1 STAFF), Student/Staff
  не имеют колонки passwordHash, повторный сид идемпотентен.

### Requirement: Словари канона имеют приоритет над скалярами сидов

Требование «Словари канона имеют приоритет над скалярами сидов» — обязательное (MUST):

- RequestType — модель-словарь канона; скалярный тип заявки сидов переименован
  в enum RequestKind (CERTIFICATE|STATEMENT|PRACTICE|DORMITORY|OTHER).
- RequestStatus — единые 8 значений канона; seed.ts отображает статусы сидов
  (NEEDS_REVISION→NEEDS_FIX, COMPLETED→ISSUED).
- Notification — канон (userId, kind NotificationKind, readAt); сиды пишут
  userId по логину и readAt по флагу isRead.
- Grade — единая таблица с парой FK «канон/сиды» (assessmentId/elementId,
  заполняется ровно один) и каноническим полем value Int (CHECK 0..10).
- RequestEvent — пара FK request(canonical)Id + подпись actorRole/actorName.
- ScheduleEvent — канон (FK groupId/disciplineId/teacherId, индекс
  (groupId, startsAt)) + денормализация и словари сидов
  (groupName/disciplineCode/date, kind ScheduleKind, status ScheduleStatus).

#### Scenario: Миграция содержит ручные фрагменты канона

- WHEN применяют миграцию на чистую БД и проверяют psql
- THEN существуют sequence `request_number_seq`, CHECK `Request_number_format`
  (regex «ЗД-[0-9]{4}-[0-9]{6}»), CHECK `Grade_value_range` (0..10),
  колонка `FaqArticle.search` (tsvector, GENERATED STORED, russian) и
  GIN-индекс `FaqArticle_search_idx`.

