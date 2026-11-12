# Tasks: экран «Успеваемость: сводка» — DIG-26

> Раунд 1 был прерван (executor убит pressure-kill'ем, salvage-коммит
> 0c414f9: red-тесты + начало view-полей). Раунд 2 — доработка WIP.

- [x] 1. Red-first (раунд 1, коммит 0c414f9): `tests/performance-format.test.ts`
  (25 контрактов: параметр/подписи семестра, пилюли, фильтр семестра,
  семестровый GPA и дельта, карточки с уровнями и допуском, светофор,
  пустой семестр, долги, тултипы) и `tests/grades-page.test.tsx` (15
  render-контрактов: пилюли и дефолт семестра, кольцо GPA с дельтой,
  кредиты 9 из 240, рейтинг 2 из 5, тултипы, светофор, карточки, долги,
  нижние ссылки, завершённый семестр, мусорный ?semester=, пустой
  семестр, дефолт при пустом текущем, ошибка, STAFF, без <main>,
  скелетон loading.tsx).
- [x] 2. View-поля агрегата: `teacherName` (справочник группы),
  `hasExamElement` / `examGraded` (экзаменационный элемент плана, оценён
  ли — по строкам оценок с учётом пересдач) в
  `src/server/data/performance.ts`. Typecheck зелёный; 48/48
  tests/performance.test.ts (включая DIG-26 view-тесты) зелёные.
- [x] 3. `src/lib/performance-format.ts` — presentation-слой по
  контракту red-тестов (семестры, GPA/дельта, карточки, светофор,
  пустой семестр, долги, тултипы); 25/25 зелёные.
- [x] 4. Экран `src/app/(cabinet)/grades/page.tsx`: сводка (кольцо GPA
  + дельта, кредиты, рейтинг), пилюли семестров, светофор, карточки
  дисциплин, долги, нижние ссылки; дефолт семестра; пустые состояния,
  ErrorState, заглушка STAFF; 15/15 render-тестов зелёные.
- [x] 5. `loading.tsx` + `src/components/performance/grades-skeleton.tsx`
  (aria-busy, зеркалит структуру экрана).
- [x] 6. Change-папка openspec/changes/dig-26-grades-screen (proposal,
  tasks, delta-спека performance).
- [x] 7. Гейты: lint, typecheck, build, `node scripts/swarm/gates.mjs` →
  GATES green (lint=pass typecheck=pass build=pass test=pass); юниты
  633/633 (36 файлов), render-контракт экрана 15/15.

## Раунд 3 — восстановление экрана и гейты

Чужой смешанный коммит 4d94d7a (батч DIG-27 «rc visual smoke spec»)
случайно вернул `src/app/(cabinet)/grades/page.tsx` на заглушку,
затерев экран из bba3302. Сделано:

- [x] Экран восстановлен из bba3302 (commit 8d0c792) и дополнен:
  дельта GPA семестра показывается только у ИДУЩЕГО семестра — у
  завершённого «предыдущий» ещё не закрыт, сравнение обманчиво
  (рендер-контракт: у весны 25/26 `data-testid="gpa-delta"` нет).
- [x] Чистка слоя данных: удалён мёртвый дубликат
  `DisciplineComputationInternal` (остаток прерванного раунда 2);
  остался один экспортируемый `DisciplineComputation`
  (его импортирует gradebook.ts DIG-27).
- [x] Попутные type-фиксы (transcript Blob wrap) ушли в wip-коммит
  8cf16e9 параллельным процессом — конфликтов нет.

## Раунд 2 — замечания ревью/security

Новых не поступило (раунд 2 — продолжение прерванного раунда 1; замечания
DIG-25 по view-полям учтены в п. 2: gradedElements/isComplete уже считались
по различным элементам плана, бейдж допуска опирается на тот же дедуп).

## Deviations

- Коммит 049e3f7 (WIP) случайно захватил чужие red-файлы параллельного
  executor'а DIG-27 (tests/gradebook.test.ts, openspec/changes/
  dig-27-gradebook-screen/) — исправлено amend'ом: файлы возвращены в
  untracked нетронутыми, последующие коммиты добавляют только файлы
  задачи (git add по именам).
- `node scripts/swarm/gates.mjs` в общем checkout красный НЕ из-за DIG-26:
  untracked red-тесты DIG-27 (gradebook) и DIG-47 (transcript-pdf) падают
  на отсутствие их модулей — их executor'ы пишут реализации параллельно.
  Собственные гейты задачи (lint, typecheck без чужих файлов, узкие
  тесты 88/88) — зелёные, см. tasks.md п. 7.
