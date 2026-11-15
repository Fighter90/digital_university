# DIG-56 — задачи

## Red-first (тесты до реализации)

- [x] `tests/week-grid-scroll.test.tsx` — сетка как скролл-контейнер:
  фиксированное окно 480 px при контенте 768 px (`overflow-auto`),
  минимальная ширина контента «56 px + N × 160 px», Shift+wheel и `deltaX`
  прокручивают сетку по горизонтали, drag мышью за порогом 5 px
  панорамирует и глушит клик по паре, микро-сдвиг клик не глушит,
  touch-жест не перехватывается (нативный pan).
- [x] `e2e/schedule-week-scroll.spec.ts` (desktop-1440): drag → scrollLeft
  изменился; Shift+wheel → горизонталь; вертикальное колесо → scrollTop
  внутри сетки, окно страницы не двинулось; drag, начатый на паре, НЕ
  открывает детали; клик по паре открывает детали; после закрытия панели
  позиция сетки (scrollLeft/scrollTop) сохранилась.

## Реализация

- [x] `src/lib/schedule-view.ts` — константы `WEEK_GUTTER_PX` (56),
  `WEEK_MIN_COLUMN_PX` (160), `WEEK_GRID_VIEWPORT_PX` (480),
  `WEEK_DRAG_THRESHOLD_PX` (5).
- [x] `src/components/schedule/week-view.tsx` — сетка перестроена в
  скролл-контейнер: контент шире окна (min-width = гуттер + колонки),
  шапка дней sticky top, гуттер часов sticky left, pointer-drag мыши с
  порогом и подавлением клика, непассивный wheel (Shift+колесо и deltaX).

## Проверка

- [x] `npx vitest run tests/week-grid-scroll.test.tsx` — 7/7 зелёные;
  соседние schedule-тесты (page, page-day-month, screen, view) — зелёные.
- [x] `npm run lint` (0 ошибок), `npm run typecheck`, `pnpm build` — зелёные.
- [x] e2e desktop-1440: новый spec (2 сценария) и `e2e/schedule.spec.ts` —
  зелёные; mobile-360 проект — зелёный, включая «week grid is hidden … no
  horizontal scroll». Исключение: `e2e/schedule-day-month.spec.ts`
  «клик по дню ленты» падает 15 ноября 2026 (воскресенье) — «завтра» вне
  недели ленты; воспроизводится на ветке ДО изменений DIG-56 (проверено
  git stash), пре-существующий датозависимый флейм DIG-23, вне скоупа.
- [x] Скриншоты: 1440×900 — сетка с drag/колесом (sticky шапка и гуттер,
  колонка «сегодня» с парами видна после прокрутки); 360×800 — мобильный
  вид без изменений, горизонтальный overflow страницы = 0.
- [x] `node scripts/swarm/gates.mjs`: lint/typecheck/build = pass; test =
  fail только на `tests/grades-page.test.tsx` («семестр без оценок») —
  пре-существующий датозависимый фейл DIG-26, воспроизводится на ветке
  ДО изменений DIG-56 (проверено git stash); остальные 880 тестов зелёные.

## Раунд 2 — замечания ревью (красные гейты)

- [x] `tests/cabinet-shell.test.ts` — lint-гейт падал «Parsing error:
  Merge conflict marker encountered»: в рабочем дереве остался
  незавершённый конфликт stash-pop (маркеры `<<<<<<< Updated upstream` /
  `>>>>>>> Stashed changes`, unmerged-записи в индексе). Разрешён в пользу
  HEAD-версии (8 разделов меню — ровно то, что в `nav-items.ts`; сторона
  «Stashed changes» с `/people` и `/help` — salvage чужих DIG-38/39, этих
  роутов в ветке нет). Файл стал байт-в-байт равен HEAD, коммит не нужен.
- [x] `tests/grades-page.test.tsx` — тест «семестр без оценок» сгнил по
  календарю: `nextAssessment` фильтрует `date > now`, зачёт «Базы данных»
  (14.11.2026 10:00) стал прошлым 15.11.2026, подсказка переключилась на
  «Информатика» 24 декабря. Фикс теста (без прод-кода): `vi.useFakeTimers({
  toFake: ['Date'] })` + `vi.setSystemTime(13.11.2026)` внутри теста —
  подсказка детерминирована, prerender живёт на реальном event loop.
- [x] `node scripts/swarm/gates.mjs` — GATES_SUMMARY: green
  (lint=pass typecheck=pass build=pass test=pass, 896 тестов).
  10 eslint-warnings в чужих файлах (orchestrator, grades/session,
  gradebook, transcript-pdf, memory-db, settings-page, swarm-тест) —
  пре-существующие, `npm run lint` = голый eslint без `--max-warnings`,
  гейт не валят; файлы вне скоупа задачи не тронуты.

