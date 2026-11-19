# Tasks: dig-85-p2-low-defects (DIG-85, BUG-12…BUG-20)

## Red (тесты прежде реализации)

- [x] BUG-14: red-кейсы в `tests/schedule-view.test.ts` и
  `tests/schedule-cards.test.ts` — «было <время>» скрыто при неизменном
  времени, «было ауд.» скрыто при неизменной аудитории; живые части «было»
  остаются.
- [x] BUG-15: `tests/room-style.test.ts` — канон «ауд. {room}» в i18n,
  справочнике сотрудников, ICS-локациях; обновить старые ожидания
  (`session-page`, `demo-seed-consistency`, `person-page`, `i18n-en-part3`).
- [x] BUG-16: red-кейсы в `tests/certificate-pdf.test.ts` — невидимый
  текстовый слой (3 Tr, Helvetica, /Lang), код проверки и URL копируются,
  кириллица транслитерирована.
- [x] BUG-17: red-кейс в `tests/week-grid-scroll.test.tsx` — после клика
  «Синхронизировать» появляется видимый статус.
- [x] BUG-18: red-кейсы в `tests/voice-assistant-components.test.tsx` — без
  старта озвучки через сторож появляется role="status"-сообщение, состояние
  сбрасывается; исключение при speak тоже даёт сообщение.
- [x] BUG-19: red-кейс в `tests/login-screen.test.tsx` — при ошибке входа
  `signedOut` уходит из адреса, устаревший статус скрыт.
- [x] BUG-20: red-кейс в `tests/requests-order-wizard.test.tsx` — пояснение
  рядом с неактивной «Отправить», исчезает после чекбокса.
- [x] BUG-12: `tests/hydration-tz-guard.test.ts` — сканер клиентских
  компонентов на форматирование дат без timeZone (гард; на текущем коде
  зелёный — остаток #418 отсутствует).
- [x] BUG-13: `tests/build-chunks.test.ts` — гард консистентности сборки
  (манифест ↔ .next/static), на текущей сборке зелёный.

## Green (реализация)

- [x] BUG-14: `src/lib/schedule-view.ts` + `src/lib/schedule-cards.ts` —
  части «было» только при реальном изменении (время — по московскому
  настенному HH:MM, аудитория — по строке).
- [x] BUG-15: `i18n/ru.ts` (session.room.short, текст деканата),
  `server/data/calendar.ts`, `server/data/session.ts`,
  `server/data/demo-seed.ts`, `server/data/news.ts`, `lib/people-catalog.ts`,
  `lib/ru-translit.ts` (правило понимает «ауд.»).
- [x] BUG-16: `src/lib/pdf/pdf-writer.ts` — TextOp (невидимый слой,
  транслит кириллицы, экранирование), /Resources/F1 Helvetica,
  /Lang (ru-RU) в каталоге.
- [x] BUG-17: `src/components/schedule/week-view.tsx` — статус
  (aria-live) «Обновляем…»/«Расписание обновлено»; ключи i18n ru/en.
- [x] BUG-18: `src/components/schedule/listen-day-button.tsx` — сторож по
  onstart, запасное сообщение role="status"; ключи i18n ru/en.
- [x] BUG-19: `src/components/auth/login-form.tsx` (+ пропс) и
  `src/app/(auth)/login/page.tsx` — чистка `signedOut`, скрытие статуса.
- [x] BUG-20: `src/components/requests/order-wizard.tsx` — пояснение у
  кнопки; ключи i18n ru/en.

## Проверка

- [x] Узкие vitest-прогоны всех затронутых файлов — зелёные.
- [x] `npm run lint` / `npm run typecheck` / `npm test` — зелёные.
- [x] `node scripts/swarm/gates.mjs` — green.
