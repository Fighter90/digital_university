# Задачи — DIG-81 (сид-согласованность: чипы/уведомления/ЭК-11)

- [x] 1. Change-папка openspec (proposal, tasks, delta-спека demo-seed).
- [x] 2. Red-тест `tests/demo-seed-consistency.test.ts`: чипы↔сид (BUG-07),
      уведомления↔расписание/сессия (BUG-08), ЭК-11 ≥ 3 (BUG-11).
      На HEAD до реализации: 8 failed / 3 passed — падает по задумке.
- [x] 3. `src/components/auth/test-accounts.ts` — единый источник чипов;
      канон: «Анна Смирнова · ПИ-21», «Илья Петров · ЭК-11», «Сотрудник
      деканата»; `login-form.tsx` импортирует и реэкспортирует.
- [x] 4. `demo-seed.ts`: ФИО/emails канона (Смирнова/Петров/Ковалёва);
      уведомления строятся функцией `buildDemoNotifications()` из записей
      `schedule`/`exams` (перенос 214→305, матан 9:00 вместо 10:40, отмена
      физики с текстом «Что делать» из пары, пересдача «Информатика» —
      дата/время/кабинет из записи сессии); без фантомных аудиторий.
- [x] 5. `people-catalog.ts`, `news-catalog.ts`, `assistant.ts` — то же ФИО
      сотрудника («Мария Ковалёва»), slug `staff-kovaleva`.
- [x] 6. README.md, README.en.md, docs/help.md, docs/user-guide-ru.md —
      таблица тестовых аккаунтов в каноне (ФИО ↔ логины, группы/курсы
      демо-сида).
- [x] 7. Снапшоты имён в существующих тестах обновлены (finance-data,
      people-catalog, people-data, request-card-actions,
      request-person-link, notifications-screen); полный vitest —
      143 файла / 1974 теста зелёные.
- [x] 8. e2e: чипы во всех специках, `notifications.spec.ts` (новый заголовок
      переноса), `profile-settings`, `people` (staff-kovaleva),
      `schedule-event-details` (changeAuthor), `request-card` (email
      Ильи), `news`, `deanery`, `assistant`, `staff-cabinet` — точечные
      прогоны зелёные. Вне задачи (есть на main): staff-чип ждёт
      `/dashboard`, а DIG-72 ведёт на `/staff`; Telegram-переключателей
      6 вместо 5.
- [x] 9. `npx vitest run` — зелёный; `npm run lint` — 0 ошибок;
      `npm run typecheck` — зелёный; `node scripts/swarm/gates.mjs` →
      GATES_SUMMARY: green.
- [x] 10. Коммит `fix(seed): canonical identities (login↔name chips), schedule/
      session-derived notifications, ЭК-11 pinned ≥ 3 (BUG-07/08/11) — DIG-81`.
