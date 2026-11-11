# Tasks: «Расписание: неделя» — DIG-22

- [x] 1. Red-first: `tests/schedule-view.test.ts` — 23 контракта чистой
  вью-логики: ключ ISO-недели «2026-W46» (четверговый трюк, границы года
  2025→2026-W01, существование 2026-W53 и отсутствие 2027-W53, round-trip
  104 недель), подпись недели «9 – 15 ноября 2026» (переход месяца/года),
  сетка 08:00–20:00 по 64 px (`top = (start − 480)/60·64`,
  `height = duration/60·64`, клампы за границы сетки), раскладка
  пересечений (кластер из 2 колонок, «встык» — не пересечение,
  неотсортированный вход), `aria-label` блоков («Семинар, Математический
  анализ, 11:10–12:30, ауд. 305, перенос» / «…, отменена» / «…, онлайн»),
  «было: ауд. 214» и «было: 11:10» из previousRoom/previousStartsAt,
  цвета типов на дизайн-токенах, мини-календарь месяца целыми строками
  Пн–Вс (ноябрь 2026: 26 октября – 6 декабря). Падало до реализации
  (модуль не существовал).
- [x] 2. Red-first: `tests/schedule-page.test.tsx` — SSR-контракт страницы:
  тулбар («Сегодня», ‹ › с href соседних недель, подпись недели,
  radiogroup День/Неделя/Месяц с отключёнными День и Месяц,
  «Синхронизировать»), сетка с часами 08:00–19:00 и `data-today`,
  aria-label блоков пар, перенос (штриховка repeating-linear-gradient,
  пунктир, бейдж «Перенос», «было: ауд. 214», причина), отмена
  (line-through, бледный блок, бейдж «Отменена», заметка), пересечение
  (width:50% / width:100%), мини-календарь и фильтры (чекбоксы,
  счётчики data-count, select преподавателя), валидный/мусорный/
  вне-семестровый `?week=`, STAFF-заглушка, мобильная замена, loading.tsx,
  пустая неделя. Падало до реализации (страница — плейсхолдер).
- [x] 3. Red-first: e2e `e2e/schedule.spec.ts` (1440 + 360): тулбар,
  мини-календарь, фильтры, сетка с часами, листание стрелками БЕЗ
  перезагрузки (маркер в window переживает навигацию) с URL
  `?week=<ключ>`, клавиатура ←/→ и Esc, красная линия после mount,
  фильтр типа скрывает/возвращает блок, отменённая пара, на 360 px
  недельный вид скрыт и видна мобильная заглушка без горизонтального
  скролла. Зелёные на прод-сборке (`pnpm build && pnpm start`).
- [x] 4. `src/lib/schedule-view.ts` — чистая вью-логика (см. proposal):
  ISO-ключи недели, weekLabel, eventTopPx/eventHeightPx, layoutDayEvents,
  toScheduleEventViews (aria-label, roomLabel «ауд. N/онлайн»,
  previousRoomLabel/previousTimeLabel), LESSON_KIND_META (block/checkbox/
  swatch на токенах DIG-13), FILTER_KIND_ORDER, miniCalendarCells,
  resolveWeekPage (валидация ?week=, кламп pageMoscowWeek, соседние
  недели, isCurrent), WEEKDAY_SHORT.
- [x] 5. `src/app/(cabinet)/schedule/page.tsx` — серверная страница:
  requireDataCtx, STAFF-заглушка, resolveWeekPage, getSchedule за
  [from, to), ErrorState на сбой, EmptyState «На этой неделе пар нет»,
  серийализуемые пропсы клиенту; `loading.tsx` — скелетон.
- [x] 6. `src/components/schedule/week-view.tsx` — клиентский WeekView
  (тулбар, левая колонка: мини-календарь/фильтры типов со счётчиками/
  фильтр преподавателя, сетка с колонкой «сегодня» в coral-50, блоки
  пар-кнопки с aria-label, штриховка/пунктир «Перенос», зачёркнутая
  «Отменена», пересечения по layoutDayEvents, красная линия раз в минуту
  client-only, Sheet деталей, клавиатура ←/→/Esc с обходом input и
  radiogroup, «Синхронизировать» = router.refresh), мобильная замена
  `< 768 px`.
- [x] 7. `src/components/ui/segmented.tsx` — аддитивная опция `disabled`
  (aria-disabled, skip в roving-навигации); существующие использования
  не тронуты (vitest ui-components зелёный).
- [x] 8. Зелёные гейты: vitest 423/423, lint 0 ошибок, typecheck чисто,
  e2e schedule.spec 7/7 (desktop-1440 + mobile-360, прод-сборка).
- [x] 9. Change-папка openspec/changes/dig-22-schedule-week-view
  (proposal, tasks, delta-спека schedule-screen).
