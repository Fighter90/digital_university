# Tasks — DIG-105: регресс EN (ноль кириллицы + качество терминов)

## Аудит

- [x] Прогон `e2e/zz-en-audit.spec.ts` против прода (AUDIT_BASE=
      https://ostrovok.store, PLAYWRIGHT_BASE_URL там же — без локального
      webServer): 31/31 маршрутов чисто в обоих профилях (desktop-1440,
      mobile-360); вывод сохранён в docs/shots/en-audit-105-output.txt.
- [x] Фикс скрипта аудита: `test.setTimeout(240_000)` (31 маршрут + два
      логина не влезают в дефолтные 30s; практика zz-shots*.spec.ts).

## Ручной свип EN-качества (anna.smirnova)

- [x] Свип dashboard/schedule/grades/requests/settings/mcp/people/
      notifications против прода: тексты + скриншоты сняты probe-скриптом
      (вне репо), термины сверены.
- [x] Даты/статусы в МСК: форматтеры проекта явно Europe/Moscow
      (dashboard-format, request-labels, notification-view) — на проде
      заявки «submitted … AM MSK», расписание/дедлайны по Москве. Нарушений
      не найдено.

## Red-first

- [x] tests/en-regression-105.test.ts: ночное приветствие EN ≠ «Good night»,
      EN-словарь «Requests in progress»/«pickup», старые уведомления EN
      «Nov 11»; RU-канон «Доброй ночи»/«Заявки в работе»/«11.11» — байт-в-байт.
      Подтверждён красный до реализации (4 падения из 8, канон-проверки
      зелёные).

## Фиксы (минимальные, только EN)

- [x] i18n/en.ts: dashboard.greeting.night → «Good evening».
- [x] i18n/en.ts: widgets.desc.requests → «Requests in progress and ready
      for pickup».
- [x] i18n/en.ts: staff.home.requests.title → «Requests in progress».
- [x] notification-view.ts: formatNotificationTime(…, locale='ru'), EN —
      «Nov 18» (en-US short month, явная Europe/Moscow).
- [x] notification-item-row.tsx: передать locale в formatNotificationTime.

## Findings (не EN-дефекты — без правок)

- [x] REGRESSION-FINDINGS-105.md: спорные термины и наблюдения свипа
      («Debts», «Study Office», «Credit test», «Discipline credit transfer»,
      «Threshold not guaranteed yet») с серьёзностью и рекомендацией.

## Проверка

- [x] npx vitest run — затронутые suites зелёные (9 файлов, 131 тест).
- [x] eslint / typecheck — зелёные.
- [x] node scripts/swarm/gates.mjs → GATES_SUMMARY: green.
