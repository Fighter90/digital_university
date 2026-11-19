# DIG-9 — Схема БД (Prisma): студенты, учёба, заявки, уведомления, обращения

## Зачем

Прототипу нужен единый источник правды о данных. Пока схема не описана,
любая экранная задача блокируется: не на чем строить server actions, скоупы
владельца (анти-IDOR) и сиды. Отдельная боль действующего ЛК — синонимы
статусов заявки («в работе», «готовится», «выполнена») — лечится единым
словарём из 8 статусов на уровне БД.

## Что

- `prisma/schema.prisma` (Prisma 7, PostgreSQL): 27 моделей — доступ и
  безопасность (User, Session, AuditLog), структура вуза (Faculty, Program,
  Group, Student, Teacher), учёба (Discipline, Enrollment, Assessment, Grade,
  Exam, ScheduleEvent, StudentNote), заявки (RequestType, Request,
  RequestEvent), уведомления (Notification, NotificationPref), обращения
  (Ticket, TicketMessage), контент (News, FaqArticle), AI (AiChat, AiMessage),
  справки (CertificateIssue).
- Единая миграция `prisma/migrations/20261111000000_init/` + ручные фрагменты:
  sequence для номеров заявок `ЗД-ГГГГ-NNNNNN`, CHECK-констрейнты (формат
  номера, оценка 0..10), FTS-колонка `FaqArticle.search` (russian) + GIN.
- Индексы: на все внешние ключи, композитные `(groupId, startsAt)` и
  `(userId, readAt)`, скоупы по `studentId`/`userId`.
- ER-диаграмма и правила миграций — в `docs/architecture.md`.
- Контракты схемы закреплены тестами `tests/prisma-schema.test.mjs`.

## Non-goals

- Сиды вымышленных данных (`prisma/seed.ts`) — отдельная задача.
- Server actions / API и проверка владельца на рантайме — задачи экранов;
  DIG-9 только закрепляет ключи скоупа (userId/studentId) на уровне схемы.
- Генерация Prisma-клиента и выбор generator'а — задача инициализации Next.js.
- Партиционирование, архивирование, полнотекстовый поиск по News.

## Приёмка

- Миграция применяется на чистой БД (`prisma migrate deploy`) — проверено
  на throwaway-контейнере postgres:16-alpine.
- Индексы на все FK и композиты `(groupId, startsAt)`, `(userId, readAt)`.
- ER-диаграмма (mermaid) в `docs/architecture.md`.
- Номер заявки уникален и человекочитаем: UNIQUE + CHECK + sequence.
