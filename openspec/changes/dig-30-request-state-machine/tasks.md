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
