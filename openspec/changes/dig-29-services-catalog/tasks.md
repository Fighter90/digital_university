# Tasks: экран «Каталог сервисов» — DIG-29

- [x] 1. Red-first: `tests/services-catalog.test.ts` — контракт каталога
  и чистых функций: уникальные id, непустые тексты, польза одной строкой;
  `servicesForRole` (студенту — ни одной абитуриентской/сотруднической
  услуги, «Личный кабинет абитуриента» отфильтрован); 6 категорий с
  точными метками («Справки», …, «Финансы и стипендии»); метки сроков
  («Мгновенно», «2–3 дня» — en-dash) и форматов (PDF / Бумажная);
  ORDER ⇔ формат, OPEN ⇔ внутренняя ссылка; `picksForCourse(2)` — 4
  сервиса с выпиской, без дублей; QA-тексты: «ёлочки», en-dash в
  диапазонах, без двойных пробелов и «зачетн» без ё; `splitHighlight`
  (подсветка без учёта регистра) и `matchService` (по названию, пользе
  и категории). Падало до реализации (модуля нет).
- [x] 2. Red-first: `tests/services.test.ts` — слой данных: избранное
  owner-scoped (favorite Ильи не виден Анне), toggle идемпотентен,
  неизвестный и неролевой id — отказ без записи; лимит 6 (седьмой —
  отказ с сообщением), удаление — ок; `getServicesPage`: студент —
  избранное + подборка курса без дублей, сотрудник — пусто + аудит
  ROLE_MISMATCH. Падало до реализации.
- [x] 3. Red-first: `tests/services-page.test.tsx` — контракт /services
  (SSR): заголовок «Каталог сервисов», блок избранного с карточкой и
  «+ Добавить», «Часто нужно на 2 курсе» без дублей с избранным,
  каталог (поиск + 6 пилюль + сетка карточек: срок, формат, Заказать/
  Открыть), нет «абитуриент», пустое избранное, состояние сотрудника
  «Доступно студентам». Падало до реализации.
- [x] 4. Red-first: `e2e/services.spec.ts` — чёрный ящик: каталог Анны
  (карточки, поиск с `<mark>`, фильтр пилюлей), избранное сохраняется
  на сервере (перезагрузка), снятие звёздочки, подборка «Часто нужно на
  2 курсе» без дублей, нет «абитуриент», сотруднику — пустое состояние;
  360 px — карточки в одну колонку, пилюли горизонтально скроллятся;
  1440 px — сетка нескольких колонок. Падало до реализации.
- [x] 5. `src/lib/services-catalog.ts` — вымышленный каталог (17
  студенческих + 2 фильтруемые записи), типы, метки категорий/сроков/
  форматов, `servicesForRole`, `picksForCourse`, `matchService`,
  `splitHighlight`.
- [x] 6. Слой данных: порт (`listFavoriteServiceIdsByStudent`,
  `addFavoriteServiceByStudent`, `removeFavoriteServiceByStudent`),
  memory-адаптер (`serviceFavorites` в seed), `src/server/data/
  services.ts` (`getServicesPage`, `toggleFavoriteService` — лимит 6,
  whitelist каталога, аудит ROLE_MISMATCH), barrel `@/server/data`.
- [x] 7. `src/server/actions/services.ts` — `toggleFavoriteAction`:
  requireDataCtx, роль студент, whitelist id, revalidatePath('/services').
- [x] 8. Экран `/services` (+ loading-скелетон): страница (RSC) с
  блоками «Избранное и часто используемые», «Часто нужно на N курсе»,
  каталог; компоненты `src/components/services/*`: карточка (иконка,
  название, польза, срок, формат, звёздочка-форма, Заказать/Открыть),
  клиентский браузер (поиск с подсветкой + пилюли + сетка), звёздочка
  избранного (server action form). CTA «Каталог сервисов» на /requests.
- [x] 9. Зелёные гейты: узкие vitest-прогоны, полный `pnpm test`,
  `pnpm lint`, `pnpm typecheck`, `node scripts/swarm/gates.mjs`, e2e
  `e2e/services.spec.ts` (оба вьюпорта).
- [x] 10. Change-папка openspec/changes/dig-29-services-catalog
  (proposal, tasks, delta-спека services) — задачи отмечаются по ходу.
