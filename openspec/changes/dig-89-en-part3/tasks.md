# Tasks — DIG-89 EN-локализация часть 3

## Red

- [x] tests/i18n-en-part3.test.tsx: «no Cyrillic on EN» — словарь, демо-контент,
      компоненты маршрутов, локализация уведомлений, source-scan страниц.

## Словарь и демо-контент

- [x] ru.ts/en.ts: новые ключи парой (deanery/feedback/finance/events/msp/news/
      people/profile/settings/tasks/notifications/services/staff/session/gradebook/meta).
- [x] src/lib/en-demo-content.ts: EN-маппинги демо-записей (events, dpo, msp,
      news, notifications seed, deadlines/tasks seed) + localizeNotification
      (чтение по шаблонам; таблицы RU-ключей — в src/lib/ru-translit.ts).

## Маршруты

- [x] /tasks (+ side-nav дедлайн, tasks-view, loading)
- [x] /notifications (screen, row, bell, view-хелперы, read-time EN)
- [x] /deanery (список, карточка, чат, формы, статус, loading)
- [x] /feedback (список, карточки, формы, статусы, lib/feedback, loading)
- [x] /events (лента, карточка, запись, фильтры, lib/events, demo EN)
- [x] /news (лента, карточка, полоса «Важно», вкладки, темы, share, demo EN)
- [x] /msp (лента, карточка, голос, комментарии, композер, запуск дня, demo EN)
- [x] /dpo (вкладки, карточки, документы, demo EN)
- [x] /people (список, карточка, браузер, demo EN)
- [x] /services (каталог, карточка, избранное, demo EN)
- [x] /finance (сводка, договор, платежи, документы, demo EN)
- [x] /profile (данные, контакты, тема, каналы, отчёт об ошибке)
- [x] /settings (вкладки и все карточки настроек, виджеты, тихие часы, MCP)
- [x] /grades/session (+ компоненты сессии, подписка календаря, skeleton)
- [x] /grades/gradebook (+ формула, апелляция, список)
- [x] /grades/[disciplineId] (карточка дисциплины)
- [x] /more, loading-состояния, <title> по locale (generateMetadata)
- [x] /staff (сводка, очередь+SLA, обращения+чат+шаблоны, объявления, карточка заявки)

## Проверка

- [x] npx vitest run tests/i18n-en-part3.test.tsx — зелёный
- [ ] все RU-тесты зелёные; node scripts/swarm/gates.mjs → green
- [ ] коммит(ы) с DIG-89
