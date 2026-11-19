# Tasks: сайдбар «Ближайший дедлайн» — динамический срок (DIG-83, BUG-06)

- [x] 1. Red-first: юнит-тест tests/side-nav-deadline.test.tsx — срок от фиксированного
      «сегодня» (fake timers), parity с карточкой «Дедлайны» («осталось 2 дня» 18.11,
      «Завтра» 19.11, «Сегодня» 20.11+), детерминизм SSR/гидрации при TZ=UTC и
      America/New_York; подтверждено падение до реализации (3 failed).
- [x] 2. `src/lib/dashboard-format.ts`: `calendarDaysLeft(due, now)` — разница
      календарных дней в Europe/Moscow (UTC+3), клиентски-безопасно.
- [x] 3. `src/components/shell/side-nav.tsx`: срок карточки через `calendarDaysLeft` +
      общий `daysLeftLabel`; дата дедлайна в явной зоне +03:00, текст через
      `formatLongDate`; дублирующая плюрализация и `Date.now()`-ceil удалены.
- [x] 4. Delta-спека cabinet-shell (specs/ в этой change-папке).
- [x] 5. Зелёные: vitest (новый файл 7 passed + смежные), gates
      (node scripts/swarm/gates.mjs).
