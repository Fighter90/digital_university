# Tasks: «Найти человека» + «Избранное» на /people — DIG-102

- [x] 1. Red-first: `tests/people-search.test.ts` — контракт поиска:
  словоформы ФИО (префикс слов, ё→е, несколько слов), email-подстрока
  (регистр), телефон с нормализацией пробелов/дефисов, прежние поля
  (дисциплина/подразделение) продолжают находиться, пустой запрос — всё.
- [x] 2. Red-first: `tests/people-favorites.test.ts` — контракт избранного:
  Prisma-модель/миграция консистентны, memory-адаптер owner-scoped
  (toggle добавляет/удаляет; A не видит избранное B и наоборот; группа
  одногруппника строго своя; сотруднику отказ), категории формируются
  верно.
- [x] 3. Схема: `prisma/schema.prisma` — модель `FavoritePerson`
  (UNIQUE пары, FK Student ON DELETE CASCADE, индекс) + связь на Student;
  миграция `prisma/migrations/20261119000000_favorite_person`; `prisma
  format/validate` зелёные.
- [x] 4. Порт и адаптер: `port.ts` (list/add/remove owner-scoped),
  `types.ts` (FavoritePersonRow), `memory-db.ts` (реализация).
- [x] 5. Поиск в `people-catalog.ts`: normalizePersonName/Phone,
  matchPersonFullName/Contacts/Entry, FAVORITES-пилюля, groupmate-id.
- [x] 6. Слой данных `people.ts`: groupmates (своя группа, кроме себя) в
  getPeopleDirectory, listFavoritePersons (с категориями), toggleFavoritePerson
  (whitelist + denyAccess); экспорт из data/index.ts.
- [x] 7. Server actions `src/server/actions/people.ts`:
  toggleFavoritePersonAction (форма), listFavoritePersons; revalidate.
- [x] 8. UI: `favorite-person-button.tsx` (Star, aria-pressed, RU/EN),
  `people-browser.tsx` (плейсхолдер, поиск с одногруппниками, вкладка
  «★ Избранное» с категориями и empty-state'ами, звёзды на карточках),
  страница /people и карточка /people/[id].
- [x] 9. Словари RU/EN парой (плейсхолдер «Ничего не найдено», категории,
  кнопки, empty-state); существующие RU-строки не менять.
- [x] 10. Контракты тестов страниц: `people-page.test.tsx`,
  `person-page.test.tsx` — моки слоя данных, новые проверки; e2e
  `people.spec.ts` — новое пустое состояние «Ничего не найдено».
- [x] 11. Гейты: `node scripts/swarm/gates.mjs` → GATES_SUMMARY: green.
