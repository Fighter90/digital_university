# DIG-76 — задачи

## Слой данных

- [x] `src/server/data/events.ts` — `MAX_DASHBOARD_EVENTS` (3),
  `EventsSummary`, `getDashboardEvents(db, ctx, now, limit)`:
  `db.listEventsByRange(now)` → slice(limit) → toEventView (агрегаты +
  registeredByMe владельца сессии).
- [x] `src/server/data/index.ts` — экспорт `getDashboardEvents` /
  `EventsSummary` (в секцию мероприятий).

## UI

- [x] `src/lib/i18n/ru.ts` + `en.ts` — ключи `dashboard.section.events`,
  `dashboard.events.all` (RU канон, EN зеркало).
- [x] `src/components/dashboard/sections.tsx` — `EventsSection`:
  секция `DashboardSection<EventsSummary>`, мини-карточки (дата/время,
  название, место/«Онлайн», «Осталось N мест», чип «Записан», ссылка
  /events/<slug>), «Все мероприятия» → /events, empty-state «скоро
  появятся», изолированное состояние ошибки блока; EN-рендер через
  localizedEvent + Intl-даты.
- [x] `src/app/(cabinet)/dashboard/page.tsx` — `getEventsSectionSafe`
  (изоляция сбоя), параллельное чтение с агрегатом, секция получает
  данные.
- [x] `src/components/dashboard/dashboard-skeleton.tsx` — блок
  skeleton-events.

## Тесты (red-first)

- [x] `tests/dashboard-events-widget.test.tsx` — слой данных (ближайшие
  будущие от now, агрегаты, owner-scope registeredByMe у студента и
  отсутствие у сотрудника, лимит 3, пустой список без будущих) и рендер
  (мини-карточки, чип, места, «Все мероприятия», empty-state, сбой блока,
  EN без кириллицы). Сначала red (10 упавших), затем green.
- [x] `tests/dashboard-page.test.tsx` — мок `getDashboardEvents` + сквозные
  тесты страницы: события на главной, empty-state, изоляция сбоя.
- [x] `tests/cabinet-shell.test.ts` — мок `getDashboardEvents` (каркасный
  рендер главной).

## Гейты

- [x] `npx vitest run tests/dashboard-events-widget.test.tsx` — 11/11.
- [x] lint (0 errors) / typecheck — green.
- [x] `node scripts/swarm/gates.mjs` — green (общие поверхности).
