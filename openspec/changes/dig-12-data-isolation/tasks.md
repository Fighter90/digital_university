# DIG-12 — задачи

## Red-first (тесты до реализации)

- [x] `tests/data-isolation.test.ts` — RED до реализации: для КАЖДОЙ функции
  data-слоя сценарий «чужой владелец» (Анна↔Илья), «несуществующий объект»,
  «сотрудник в студенческих функциях», «студент в staff-функциях», аудит
  DENIED-событий, единообразие 404, normalize номера, маппинг DataCtx.
- [x] `tests/eslint-isolation-rule.test.ts` — RED до реализации: импорт
  `@prisma/client` / `@prisma/adapter-pg` / сгенерированного клиента из
  страницы/компонента/lib роняет `no-restricted-imports`, из `src/server/`
  разрешён.

## Реализация

- [x] `src/server/data/types.ts` — DataCtx, структурные типы строк
  (зеркало схемы DIG-9), DenialReason, AuditLogRow.
- [x] `src/server/data/request-number.ts` — публичные номера
  `SR-<год>-<5 A-Z0-9>` (не последовательные), normalize/validate.
- [x] `src/server/data/port.ts` — порт `DataDb`: область видимости —
  обязательный аргумент каждого метода; `probe*` — существование-пробы
  только внутри слоя.
- [x] `src/server/data/memory-db.ts` — in-memory адаптер (тесты + прототип).
- [x] `src/server/data/access.ts` — `denyAccess()`: единственное место
  записи DENIED-событий, не бросает исключений.
- [x] `src/server/data/context.ts` — `toDataCtx()` (чистая, тестируемая)
  и `requireDataCtx()` (сессия → контекст или /login).
- [x] `src/server/data/requests.ts` — список / по номеру / история:
  чужой и несуществующий номер → одинаковый null, различие только в аудите.
- [x] `src/server/data/grades.ts`, `notifications.ts`, `appeals.ts`,
  `schedule.ts`, `staff.ts` — та же модель для остальных сущностей;
  отметка «прочитано» тоже под проверкой владельца.
- [x] `src/server/data/http.ts` — `uniformNotFoundResponse()` (единый 404
  JSON для API и будущих ICS/PDF/AI-фидов).
- [x] `src/server/data/db.ts`, `bootstrap.ts`, `demo-seed.ts` — синглтон
  (globalThis), идемпотентный сид демо-данных жюри.
- [x] `src/server/data/index.ts` — единственная санкционированная точка
  импорта данных для страниц/роутов/акций.
- [x] `eslint.config.mjs` — `no-restricted-imports` для Prisma вне
  `src/server/`.
- [x] `src/app/(cabinet)/requests/page.tsx`, `…/[number]/page.tsx`,
  `src/app/api/requests/[number]/route.ts`, `src/app/not-found.tsx` —
  первые потребители слоя; один 404 на всё. Специально БЕЗ `loading.tsx`
  над `[number]`: Suspense-граница включает стриминг, и статус 404 не
  успевает выставиться (проверено e2e; см. комментарий в detail-странице).
- [x] `src/app/(auth)/login/page.tsx` — bootstrap демо-данных до первого
  входа (in-memory прототип).
- [x] `src/server/auth/store.ts`, `src/server/data/db.ts`, `bootstrap.ts` —
  globalThis-синглтоны (dev-бандлы страниц и API-роутов); `next.config.ts` —
  `turbopack.root` (стабильный build, гейты зелёные).

## Проверка

- [x] `npx vitest run` — 125 тестов (8 файлов) зелёные.
- [x] `npm run lint` / `npm run typecheck` / `npm run build` — зелёные.
- [x] `node scripts/swarm/gates.mjs` — GATES_SUMMARY: green.
- [x] `pnpm e2e` — 16/16 зелёные (desktop-1440 и mobile-360), включая
  IDOR-сценарий Анна/Илья (страница + API + отсутствие оракула).

## Документация

- [x] `openspec/changes/dig-12-data-isolation/` — proposal, tasks,
  delta-спека `specs/data-isolation/spec.md`.
- [x] `docs/security.md` — раздел про слой данных и единый 404.
- [x] `CHANGELOG.md`, `docs/ai-log/2026-11-11-dig-12.md`.
