# Delta: data-model

## ADDED

### Requirement: Объединённая схема — канон DIG-9 + сиды DIG-10 + auth DIG-11

Схема `prisma/schema.prisma` валидна (`prisma validate`) и содержит модели
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

Профили Student/Staff не содержат passwordHash. Seed создаёт User-строки
(role STUDENT/STAFF) с bcrypt-хэшами из prisma/seed-data.ts и связывает
профили с User (Student.userId, обязательный 1:1).

#### Scenario: Сид заводит трёх пользователей

- WHEN выполняют `prisma db seed` на БД после миграции
- THEN таблица User содержит 3 строки (2 STUDENT, 1 STAFF), Student/Staff
  не имеют колонки passwordHash, повторный сид идемпотентен.

## MODIFIED

### Requirement: Словари канона имеют приоритет над скалярами сидов

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
