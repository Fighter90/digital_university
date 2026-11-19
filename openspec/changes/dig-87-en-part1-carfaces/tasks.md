# Tasks: DIG-87 — EN-локализация часть 1

## 1. Словари

- [x] 1.1 Расширить `ru.ts`/`en.ts` ключами dashboard (hero, плитки, виджеты
      Today/Deadlines/Tasks/Progress/Requests/News/Events, пустые состояния).
- [x] 1.2 Расширить ключами schedule (виды, фильтры, карточка пары, детали
      пары, переносы/отмены, мини-календарь, семестр).
- [x] 1.3 Расширить ключами requests (список, фильтры, карточка, степпер,
      статусы канона, формы мастера) и tasks/voice.
- [x] 1.4 RU-строки новых ключей байт-в-байт равны прежним захардкоженным
      (пинется тестом 5-й секции приёмки).

## 2. Dashboard

- [x] 2.1 `sections.tsx`, `dashboard/page.tsx`, `dashboard-skeleton.tsx`,
      `server/data/dashboard.ts` — строки через `t(locale, …)`, пропс locale.
- [x] 2.2 `dashboard-format.ts` — хвостовой `locale` у хелперов hero/плиток.

## 3. Schedule

- [x] 3.1 Виды (day/week/month), переключатель, лента, мобильный список —
      компоненты schedule/* с пропсом locale.
- [x] 3.2 Карточка пары и aria-подписи (`schedule-cards.ts`).
- [x] 3.3 Недельная сетка и «было: …» (`schedule-view.ts`, ключи
      `schedule.was` / `schedule.was.room` / `schedule.was.time` для строчной
      формы части «было»).
- [x] 3.4 Детали пары (`event-details.ts`, `event-details-panel.tsx`).
- [x] 3.5 EN-форматы дат: «Thu, November 12», «Wednesday, November 11»,
      «November 9 – 15, 2026» (число отрезается и с конца для en-US).
- [x] 3.6 Озвучка дня (`voice-assistant.ts`) и задачи виджета (`task-format.ts`).

## 4. Requests

- [x] 4.1 Список и фильтры (`requests/page.tsx`, `requests-view.ts`).
- [x] 4.2 Карточка заявки: статусы, «подана», действия; номер транслитом
      на EN (`requestNumberLabel`), ссылки — канонический номер.
- [x] 4.3 Степпер: aria по словарю (`request-stepper.tsx`).
- [x] 4.4 Мастер заказа (все 3 шага, диалог выхода, экран успеха) —
      `order-wizard.tsx`, `request-order-map.ts`, `request-wizard-schema.ts`,
      `request-question-form.tsx`.

## 5. Тесты и гейты

- [x] 5.1 Red-first `tests/i18n-en-surfaces.test.tsx` — «no Cyrillic on EN
      render» по словарю, hero/виджетам, карточкам расписания, деталям,
      мастеру (jsdom + Portal) и карточке заявки; RU-пины байт-в-байт.
- [x] 5.2 Полный `npm test` зелёный (RU-тесты без правок).
- [x] 5.3 `npm run lint`, `npm run typecheck` — зелёные.
