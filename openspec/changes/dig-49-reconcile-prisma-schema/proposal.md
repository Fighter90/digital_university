# DIG-49 — Reconcile prisma-схемы: канон DIG-9 + enum'ы сидов DIG-10 + auth-модели

## Зачем

После слияния DIG-7…DIG-14 `prisma/schema.prisma` жил на копии из ветки DIG-10:
типы и сиды компилировались, но контракты канона DIG-9
(`tests/prisma-schema.test.mjs`, 11 тестов в `test.skip`) не выполнялись —
в схеме не было User/Session/Faculty/Program/…, словари статусов и расписания
расходились с каноном, миграция init_seeds не содержала sequence/CHECK/FTS.

## Что

- Схема объединена: канон DIG-9 (28 моделей: User, Session, Faculty, Program,
  Group, Student, Teacher, Discipline, DisciplineTeachers, Enrollment,
  Assessment, Grade, Exam, ScheduleEvent, StudentNote, RequestType, Request,
  RequestEvent, Notification, NotificationPref, Ticket, TicketMessage, News,
  FaqArticle, AiChat, AiMessage, AuditLog, CertificateIssue) + добавки сидов
  DIG-10 (Staff, NewsPost, Appeal/AppealMessage, AssessmentElement,
  ExamSession, ServiceRequest; enum'ы ActorRole, AppealStatus, ElementKind,
  RequestKind, ScheduleKind/ScheduleStatus; ExamKind += RETAKE;
  NotificationKind += DEADLINE) + auth-модели DIG-11 (User/Session —
  единственное хранилище паролей).
- Разрешения конфликтов имён задокументированы в шапке схемы:
  RequestType — модель-словарь канона, скаляр из сидов переименован в
  `RequestKind`; `RequestStatus` — единые 8 значений (сиды отображаются
  NEEDS_REVISION→NEEDS_FIX, COMPLETED→ISSUED в seed.ts); Grade несёт пару
  FK «канон/сиды» (assessmentId/elementId); RequestEvent — аналогично
  (requestId→ServiceRequest, canonicalRequestId→Request); Notification —
  канон (userId + kind), сиды пишут userId по логину.
- Пароли убраны из профилей Student/Staff: seed создаёт 3 User-строки
  (2 STUDENT, 1 STAFF) с теми же bcrypt-хэшами из prisma/seed-data.ts.
- Миграция регенерирована на чистой БД: `20261111135255_init` (DDL Prisma +
  ручные фрагменты канона: sequence `request_number_seq`, CHECK формата
  «ЗД-ГГГГ-NNNNNN», CHECK `Grade.value` 0..10, FTS `FaqArticle.search`
  (russian, GENERATED STORED) + GIN-индекс).
- `tests/prisma-schema.test.mjs`: все `test.skip` сняты (14 тестов, ранее
  11 красных), заголовочный комментарий обновлён.

## Non-goals

- Перевод сиюминутного слоя данных (`src/server/data/*`) с in-memory адаптера
  на Prisma — отдельная задача.
- Заполнение справочников Faculty/Program/Group/Teacher сидами — FK канона
  оставлены опциональными до перехода сидов на справочники.
