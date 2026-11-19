# Tasks: DIG-30 — заявки и справки (серверная логика и машина статусов)

## Подготовка

- [x] Change-папка создана (proposal / tasks / delta-spec).

## Red-first тесты

- [x] `tests/request-machine.test.ts` — все разрешённые переходы; все
      недопустимые пары; обязательная причина для `NEEDS_FIX`/`REJECTED`;
      права ролей (студент не может `ACCEPTED`/`IN_PROGRESS`/`READY`/
      `ISSUED`/`NEEDS_FIX`/`REJECTED`; сотрудник не может `CANCELLED`
      и возврат в `SUBMITTED`); терминальные статусы.
- [x] `tests/request-sla.test.ts` — рабочие дни через выходные
      (пн+1 → вт; пт+1 → пн; пт+2 → вт), `etaDays null` → null,
      формат «до 14 ноября».
- [x] `tests/request-form-schema.test.ts` — разбор JSON-схемы, zod:
      required, enum, date, maxLength, обрезка и отбрасывание чужих
      полей; название «тип · ключевой параметр».
- [x] `tests/canonical-requests.test.ts` — сервис: подача (номер
      «ЗД-ГГГГ-NNNNNN», уникальность, событие, уведомление с SLA),
      мгновенный тип → `READY` + документ-событие; duplicate за 24 ч
      (`duplicate` + номер готовой) и после 24 ч (`created`); машина
      переходов через сервис с событиями и уведомлениями; IDOR (чужая
      заявка → NOT_FOUND + аудит; студент не переводит в `READY`;
      сотрудник чужого факультета → NOT_FOUND; студент не может
      отменить после `IN_PROGRESS`).

## Реализация

- [x] `src/lib/request-machine.ts` — таблица переходов + `checkRequestTransition`.
- [x] `src/lib/request-sla.ts` — `addWorkingDays`, `slaReadyDate`, `formatReadyBy`.
- [x] `src/lib/request-form-schema.ts` — zod из JSON-схемы + `requestTitleFromParams`.
- [x] `src/lib/enrollment-certificate-pdf.ts` — PDF «Справка об обучении».
- [x] `src/server/data/canonical-request-number.ts` — «ЗД-ГГГГ-NNNNNN».
- [x] `src/server/data/types.ts` — канонические row-типы (re-export статусов из lib).
- [x] `src/server/data/port.ts` — скоупленные методы канонического мира.
- [x] `src/server/data/memory-db.ts` — реализация + seed.
- [x] `src/server/data/canonical-requests.ts` — сервис (создание, переходы, чтение).
- [x] `src/server/data/index.ts` — экспорт нового API.
- [x] `src/server/actions/requests.ts` — подача / отмена / повторная подача.
- [x] `src/app/api/requests/[number]/document/route.ts` — скачивание PDF (владелец, READY/ISSUED).

## Гейты

- [x] `npx vitest run` новые тесты — зелёные (red-first соблюдён).
- [x] `npm run lint` — 0 ошибок (9 warnings — pre-existing, файлы задачи не тронуты).
- [x] `npm run typecheck` — зелёный; `npm run build` — зелёный.
- [x] Полный `vitest`: 692/693 — единственный fail
      `tests/grades-page.test.tsx` (пустое состояние /grades) — pre-existing,
      воспроизводится на чистом HEAD в отдельном worktree, к DIG-30 не относится.
- [x] `node scripts/swarm/gates.mjs`: lint=pass typecheck=pass build=pass
      test=fail (только тот же pre-existing тест).

## Раунд 2 — исправление замечания ревью

- [x] Тест-гейт: упавший pre-existing тест `tests/grades-page.test.tsx`
      (пустое состояние /grades) починен — он гнил по реальному календарю:
      зачёт «Базы данных» был захардкожен на 14 ноября 2026 и стал прошлым.
      Даты сессии в фикстуре сделаны относительными к «сегодня»
      (`inDays`: пересдача +2, зачёт +3, экзамен +30), ассерт даты — через
      тот же `formatDateShort`, что рендерит страница; заодно ужесточён
      контракт («зачёт по «Базы данных»», пересдача не «первая контрольная»).
- [x] `node scripts/swarm/gates.mjs`: lint=pass typecheck=pass build=pass
      test=pass — зелёный.

## Раунд 3 — замечания ревью (все 6 пунктов)

- [x] **[1] `.next-build.lock/pid` в git** — артефакт сборки удалён из
      индекса, `.next-build.lock/` добавлен в `.gitignore`.
- [x] **[2] `readyBy` от `createdAt`** — дата готовности в уведомлениях
      переходов (`ACCEPTED`/`IN_PROGRESS`/`SUBMITTED` после доработки)
      считается от момента перехода (`now`), а не от подачи — иначе после
      возврата из `NEEDS_FIX` обещалась прошедшая дата. Red-first:
      тест «дата готовности … от момента перехода»
      (`tests/canonical-requests.test.ts`).
- [x] **[3] `decodeURIComponent` → 500 вместо 404** — новый безопасный
      хелпер `decodeRequestNumberParam` (`request-number.ts`, try/catch →
      как есть); роут документа использует его, мусорный сегмент (`%`)
      отсеивается проверкой формата → единый 404. Red-first:
      `tests/request-number.test.ts`.
- [x] **[4] иероглиф «洛» в комментарии** — «О洛граничение» → «Ограничение»
      (`src/lib/request-form-schema.ts`).
- [x] **[5] дубликат = тип + ключевой параметр** (решение минора зафиксировано
      в delta-спеке): повторный заказ «той же справки» ключуется парой
      «тип + значение `keyField`» — готовая «для банка» не блокирует заказ
      «для военкомата». Порт+адаптер: `findLatestCanonicalRequestByStudentAndType(…,
      keyField, keyValue)`. Red-first: тест «тот же тип с другим
      назначением — новая заявка».
- [x] **[6] date только по regex** — добавлена календарная проверка
      (`isCalendarDate`): `2026-13-45`, `2026-02-30`, `2025-02-29`
      отклоняются, `2024-02-29` принимается. Red-first: тест в
      `tests/request-form-schema.test.ts`.
- [x] Delta-спека дополнена: сценарии «тот же тип с другим ключевым
      параметром», «дата готовности считается от момента перехода»,
      уточнены «повторный заказ за 24 часа», «форма валидируется» (календарь),
      «единый 404» (безопасное декодирование).
- [x] Узкие тесты: 75/75 зелёные (machine, SLA, form-schema,
      canonical-requests, request-number, PDF ×2, demo-seed).
