# Tasks — DIG-126: канонические заявки в кабинете сотрудника

## Red-first

- [x] tests/staff-canonical-requests.test.ts — 16 сценариев: owner-scope
      канона (сотрудник/студент, аудит), SLA-дедлайн из etaDays рабочими
      днями, машина переходов + причина, сквозной «подача → очередь →
      «Взять в работу» → «В работе», сид по умолчанию. Подтверждён
      красный до реализации (15 падений из 16).

## Слой данных

- [x] port.ts: `listCanonicalRequestsByFaculty(faculty)`.
- [x] memory-db.ts: реализация порта (фильтр по владельцам факультета,
      сортировка по свежести).
- [x] canonical-requests.ts: `listCanonicalRequestsForStaff`,
      `takeCanonicalRequestInProgress` (легальная цепочка
      SUBMITTED → ACCEPTED → IN_PROGRESS), `staffTransitionCanonicalRequest`.
- [x] staff-workflow.ts: `getStaffQueueUnified` (легаси + канон, SLA канона
      из etaDays рабочими днями), `getStaffCanonicalRequestDetail`.
- [x] lib/staff-sla.ts: `QUEUE_OPEN_STATUSES`, `unifiedSlaHoursLeft`,
      `isQueueRowOverdue`, `filterUnifiedQueue` (легаси-`filterQueue`
      не тронут).
- [x] lib/request-labels.ts: `canonicalQueueType` (typeCode → класс типа),
      `canonicalTypeLabel` (RU typeName / EN ключ словаря).
- [x] src/server/data/index.ts: экспорт новых функций и типов.

## Экраны сотрудника

- [x] Очередь /staff/requests: единая очередь, пилюля «Заявка мастера»,
      SLA от дедлайна канона, «Взять в работу» канона.
- [x] Карточка /staff/requests/ЗД-…: студент, параметры (JSON-схема +
      мета мастера + вложения), машина переходов, история канона; чужой
      факультет — единый 404.
- [x] components/staff/canonical-request-status-form.tsx — легальные
      переходы машины DIG-30 для STAFF (причина у доработки/отказа).
- [x] server/actions/staff.ts: `takeCanonicalInProgressAction`,
      `changeCanonicalStatusAction` (валида­ция цели, причина, revalidate).

## i18n

- [x] ru.ts/en.ts: `staff.queue.canonicalPill`, `staff.canonicalType.*`
      (RU/EN парой); EN-очередь без кириллицы (транслит ЗД → ZD).

## Тесты

- [x] tests/staff-pages.test.tsx: канон-строка очереди (пилюля, форма
      «Взять в работу»), карточка канона (параметры/мета мастера,
      легальные переходы SUBMITTED, терминальный ISSUED без формы, 404).
- [x] tests/en-staff-clean.test.tsx: канон в EN-очереди — название по
      словарю, транслит номера, пилюля «Wizard request», ноль кириллицы.
- [x] e2e/staff-cabinet.spec.ts: сквозной D1 (очередь → «Взять в работу»
      → студент видит «В работе» на карточке ЗД) + owner-scope (канон ЭК
      не виден сотруднику ИТ, карточка — 404).

## Гейты

- [x] node scripts/swarm/gates.mjs → GATES_SUMMARY: green.
