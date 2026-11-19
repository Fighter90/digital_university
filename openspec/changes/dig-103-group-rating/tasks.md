# Tasks: рейтинг группы — DIG-103

- [x] 1. Red-first: `tests/group-rating.test.ts` (сортировка desc и
  алфавит при равенстве; равные средние — одно место; студенты без оценок
  после ранжированных; метка isViewer; формат среднего двумя знаками;
  фасад: места по единому расчёту DIG-80, совпадение среднего и места с
  getPerformance, приватность ключей строки, owner-scope чужой группы,
  сотрудник null + аудит, пустая группа, один студент; i18n-паритет
  grades.rating.*) и `tests/grades-rating-page.test.tsx` (render-контракт:
  таблица, «вы» на строке владельца, прогресс-бар к 100, empty-state,
  заглушка STAFF, title, скелетон) — RED подтверждён.
- [x] 2. Red: ссылка «Весь рейтинг группы» в блоке рейтинга сводки
  (`tests/grades-page.test.tsx`) — RED подтверждён.
- [x] 3. `src/lib/group-rating.ts` — чистые buildGroupRatingRows /
  formatAverageScore.
- [x] 4. `getGroupRating` в `src/server/data/performance.ts` — фасад на
  едином расчёте gpaOfStudent (DIG-80), owner-scope по ctx.groupName,
  аудит ROLE_MISMATCH сотруднику; экспорт из `src/server/data/index.ts`.
- [x] 5. i18n: `grades.rating.*`, `title/meta/loading.gradesRating` в
  ru.ts и en.ts парами; запись в TITLE_BY_HREF (/grades/rating).
- [x] 6. Страница `/grades/rating` (page.tsx + loading.tsx): таблица,
  подсветка и метка «вы», прогресс-бар к шкале 0–100, empty-state,
  заглушка STAFF, ссылка назад; ссылка «Весь рейтинг группы» на сводке.
- [x] 7. Change-папка openspec/changes/dig-103-group-rating (proposal,
  tasks, delta-спека performance).
- [x] 8. Узкие тесты зелёные (44/44: group-rating,
  grades-rating-page, grades-page); гейты `node scripts/swarm/gates.mjs`
  → GATES_SUMMARY: green.
