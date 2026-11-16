# Tasks: экран «Справочник» — преподаватели и сотрудники — DIG-37

- [x] 1. Red-first: `tests/people-catalog.test.ts` — контракт каталога:
  уникальные id, полнота полей (email/должность/подразделение/часы
  консультаций), имена преподавателей сшиты с сидом (teacherName DIG-12),
  `findPersonById` (белый список), `personHrefByFullName`, поиск по ФИО/
  дисциплине/подразделению без учёта регистра, подсветка `splitHighlight`,
  метки фильтров. Падало до реализации (каталог отсутствовал).
- [x] 2. Red-first: `tests/people-data.test.ts` — слой данных:
  `getPeopleDirectory` — пометки isMyTeacher/isMyDeanery/isMyManager строго
  из скоупа сессии (Анна ПИ-21/ИТ: преподаватели группы, деканат ИТ,
  менеджер «Прикладной информатики»; ЭК-11 не попадает), сортировка
  «свои» поверх, myDisciplines; `getPersonCard` — контакты, дисциплины
  с кодом, ближайшие пары (без отменённых, от «сейчас», лимит 5),
  null на неизвестный id; сотруднику — персональных секций нет.
  Падало до реализации.
- [x] 3. Red-first: `tests/people-page.test.tsx` — контракт /people (SSR):
  заголовок, поиск, три фильтра-пилюли, карточка (инициалы аватара,
  ФИО-ссылка, должность, подразделение, «Ваши дисциплины»), «Ваш
  менеджер» в списке, сотрудник без персональных секций. Падало до
  реализации.
- [x] 4. Red-first: `tests/person-page.test.tsx` — контракт /people/[id]
  (SSR): шапка с бейджами («Ваш менеджер», «Ведёт у вас»), контакты
  (mailto/tel/кабинет), часы консультаций, дисциплины с пометкой «ваша»,
  «Ближайшие пары» со ссылками на день расписания и пустым состоянием,
  кнопка-заглушка консультации, «Написать письмо», единый 404 на
  неизвестный id (в т.ч. битый %-энкодинг). Падало до реализации.
- [x] 5. Red-first: `tests/request-person-link.test.tsx` + правки контрактов
  расписания/дисциплины — переходы на карточку человека из детали пары,
  карточки дисциплины и заявки; имя вне справочника остаётся текстом.
  Падало до реализации.
- [x] 6. `src/lib/people-catalog.ts` — вымышленный каталог (5 преподавателей
  + деканаты/службы), типы, метки фильтров, `findPersonById`,
  `personHrefByFullName`, `matchPerson`, `splitHighlight`.
- [x] 7. Слой данных `src/server/data/people.ts` (`getPeopleDirectory`,
  `getPersonCard`), barrel `@/server/data`, экспорт типов.
- [x] 8. Экран `/people` (+ скелетон в route-группе `(list)`): страница RSC,
  клиентский `PeopleBrowser` (поиск с подсветкой, пилюли-фильтры, сетка
  карточек 1/2 колонки, пустые состояния).
- [x] 9. Карточка `/people/[id]`: шапка, контакты, часы консультаций,
  дисциплины, ближайшие пары, mailto + заглушка записи, единый 404
  (без loading.tsx в сегменте — контракт requests).
- [x] 10. Переходы: `event-card.tsx` (пара), `grades/[disciplineId]`
  (дисциплина), `requests/[number]` (заявка); «Справочник» в навигации
  (desktop + «Ещё»), иконка Contact.
- [x] 11. Red-first e2e: `e2e/people.spec.ts` (9 сценариев) — поиск,
  фильтры, «Ваш менеджер», карточка, mailto, 404, переходы из пары/
  дисциплины/заявки, 360 px — одна колонка, 1440 px — две.
- [x] 12. Зелёные гейты: узкие vitest-прогоны, полный `vitest run`,
  `npm run lint`, `npm run typecheck`, `node scripts/swarm/gates.mjs`.
- [x] 13. Change-папка openspec/changes/dig-37-people (proposal, tasks,
  delta-спека people).

## Раунд 2 (ревью вернуло с замечаниями)

- [x] 14. Red-first `tests/people-data.test.ts`: метка «Ведёт у вас» едина
  в списке и карточке — преподаватель с дисциплинами группы без пар в
  расписании помечен одинаково (падало: карточка давала false).
- [x] 15. `src/server/data/people.ts` — общий предикат `isMyTeacherMark`
  для `getPeopleDirectory` и `getPersonCard` (было: список учитывал
  дисциплины группы, карточка — только расписание).
- [x] 16. `people-browser.tsx` — подсветка `<mark>` стилизована токенами
  (как в service-card DIG-29), имя-ссылка через `next/link` вместо
  полного `<a>`-reload.
- [x] 17. `people/[id]/page.tsx` — опечатка в пояснении заглушки
  («письму» → «письмо»).
- [x] 18. `grades/[disciplineId]/page.tsx` — `personHrefByFullName`
  вычисляется один раз (было дважды: проверка + `!` в JSX).
- [x] 19. Гейты: полный `vitest run` (802 green), `npm run lint` (0
  errors), `npm run typecheck`, `node scripts/swarm/gates.mjs`.

## Раунд 3 (ревью вернуло с замечаниями)

- [x] 20. Вычистить из ветки чужой DIG-36: salvage-коммит (7d9b54a) принёс
  сюда целиком экран «Новости» (страницы, компоненты, каталог, тесты, e2e,
  public, change-папку), хотя у DIG-36 есть своя каноническая ветка
  (origin/pochtasergeia/dig-36-…) с более поздними правками раунда 3.
  Дубль удалён: news-файлы — `git rm`, общие файлы (news.ts, memory-db,
  port, types, demo-seed, sections.tsx, dashboard-page тест, скриншоты)
  возвращены к базе ветки, в index.ts оставлены только экспорты people.
  DIG-36 доедет до main своей веткой и своим PR — без конфликтов версий.
- [x] 21. Герметичный typecheck: `npm run typecheck` теперь чистит
  устаревшие `.next/types` перед `next typegen` + `tsc` (тот же подход,
  что в канонической ветке DIG-36) — иначе после удаления сегментов
  маршрутов tsc падает на стейл-типах.
- [x] 22. Аудит пунктов ревью: сессия (requireDataCtx на обеих страницах),
  loading-иерархия ((list)/loading.tsx есть; [id] — без loading.tsx,
  задокументированный контракт 404), тесты, сид — замечаний нет.
- [x] 23. Гейты: полный `vitest run` (755 green = 801 − 46 тестов DIG-36),
  lint (0 errors), typecheck, `node scripts/swarm/gates.mjs` — зелёные;
  e2e people 16 passed (+2 skipped desktop-проектом), dashboard/shell e2e
  18 passed.

## Раунд 4 (pipeline роя падал на гейтах — причина экологическая)

- [x] 24. Диагноз «gates failed after 3 rounds»: код ни при чём. (1) Осиротевший
  `next build` роя продолжал писать в `.next` параллельно с гейт-сборкой —
  гонка на `route.js.nft.json` в фазе «Collecting build traces» роняла build;
  процесс убит, `.next` пересобран. (2) `@playwright/test` обновился при
  переустановке зависимостей, а бинарник `chromium_headless_shell-1254` в кэше
  отсутствовал — все e2е падали на `browserType.launch`; поставлен
  `npx playwright install chromium`. (3) Переиспользуемый прод-сервер на :3000
  держал манифесты старой сборки — остановлен, e2e подняли свой свежий.
- [x] 25. Верификация раунда: `node scripts/swarm/gates.mjs` —
  `lint=pass typecheck=pass build=pass test=pass` на чистой среде;
  `e2e/people.spec.ts` — 16 passed + 2 skipped (при `--workers=2`: дефолтный
  fullyParallel-прогон двух проектов ловит 30-секундный test-timeout под
  нагрузкой — флейк среды, не сценария; изолированный прогон зелёный).
  Код задачи не менялся, замечаний по существу нет.
