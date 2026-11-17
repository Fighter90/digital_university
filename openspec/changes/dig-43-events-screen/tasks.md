# DIG-43 — задачи

## Реализация (тесты контракта — до UI, см. tests/events-data.test.ts)

- [x] `src/lib/events.ts` — клиентский словарь: типы `CampusEventKind` /
  `EventsFilter`, подписи бейджей и фильтров, палитра обложек-заглушек
  (FNV-хэш названия, без random), «Осталось N мест» с плюрализацией.
- [x] `src/server/data/types.ts` — `EventRow`, `EventRegistrationRow`
  (в конец секций).
- [x] `src/server/data/port.ts` — `listEventsByRange`,
  `listEventRegistrationsByStudent`, `toggleEventRegistration`,
  `listEventAttendeeCount` (в конец секций).
- [x] `src/server/data/memory-db.ts` — адаптер: лента с сортировкой,
  toggle с защитой capacity и UNIQUE-парой, агрегат занятости; seed-секция.
- [x] `src/server/data/demo-seed.ts` — 8 вымышленных событий (+1..+30
  дней, 3 онлайн) и записи демо-студентов; экскурсия 5/5.
- [x] `src/server/data/events.ts` — фасад: `getEventsPage` (фильтры,
  сортировка), `openEventView` (slug, аудит NOT_FOUND),
  `toggleEventRegistrationForStudent` (ROLE_MISMATCH / NOT_FOUND /
  «Мест нет»), `normalizeEventSlug`.
- [x] `src/server/data/index.ts` — экспорты (в конец секций).
- [x] `src/server/actions/events.ts` — `toggleEventRegistrationAction`
  (validate + requireDataCtx + revalidatePath; NOTE: в /schedule запись
  не попадает — прототип).
- [x] `src/components/events/` — event-cover, event-card,
  event-register-button, events-filter-chips.
- [x] `src/app/(cabinet)/events/(feed)/page.tsx` + `loading.tsx` — лента,
  чипы ?filter=, скелетон (route-group).
- [x] `src/app/(cabinet)/events/[slug]/page.tsx` — карточка события,
  вместимость/занято, запись, «Друзья не пойдут» (заглушка), notFound().
- [x] `src/components/shell/nav-items.ts` + `nav-icons.tsx` — пункт
  «Мероприятия» в «Ещё», иконка CalendarHeart.
- [x] `tests/cabinet-shell.test.ts` — точное ожидание MORE_SECTIONS += /events.

## Гейты

- [x] `pnpm exec vitest run tests/events-data.test.ts` — 20/20.
- [x] lint / typecheck / build / test (scripts/swarm/gates.mjs) — green.
- [ ] e2e — не запускается (по задаче; сводит оператор).
