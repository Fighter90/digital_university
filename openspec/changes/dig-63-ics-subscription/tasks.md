# DIG-63 — задачи

## Red-first (тесты до реализации)

- [x] `tests/calendar-subscription.test.ts` — контракт lib/calendar-token
  (mint/parse, подделка, чужой секрет), выдача подписки студенту
  (стабильность ссылки, null + аудит сотруднику, fail closed без секрета),
  состав фида (пары семестра + контрольные, пометка «Отменена», изоляция
  групп, сортировка), отзыв при выходе (старая ссылка умирает навсегда,
  новый вход — новая ссылка, идемпотентность, изоляция отзыва по логину).
  Падало красным (модулей не существовало).
- [x] `tests/access-control.test.ts` — `/api/calendar/ics` публичен
  (календарные клиенты без кук), кабинет остаётся закрыт. Падало красным.
- [x] `tests/session-page.test.tsx` — SSR «Сессии»: карточка подписки с
  абсолютной подписанной ссылкой; подписка не выдана — карточки нет,
  экран жив; сотруднику карточки нет. Падало красным (старая кнопка
  `/api/session/ics`).

## Реализация

- [x] `src/lib/calendar-token.ts` — чистый модуль: tokenId (128 бит
  base64url), HMAC-подпись `v1.<tokenId>.<hmac>`, разбор с
  timingSafeEqual; без серверных импортов.
- [x] `src/server/data/types.ts` — `CalendarSubscriptionRow`
  (studentId, tokenId, createdAt, rotatedAt).
- [x] `src/server/data/port.ts` — пять методов подписки; поиск по tokenId
  задокументирован как осознанное исключение из owner-scope (образец —
  `findCertificateByCode` DIG-47).
- [x] `src/server/data/memory-db.ts` — адаптер: upsert/поиск/удаление по
  студенту и по логину + seed-секция.
- [x] `src/server/data/calendar.ts` — выдача/фид/отзыв: стабильная ссылка,
  аудит ROLE_MISMATCH сотруднику, секрет `ICS_TOKEN_SECRET`→`AUTH_SECRET`,
  фид = пары семестра + контрольные точки (экзамены/зачёты/пересдачи),
  пометки отмены и переносов в описаниях, сортировка по времени.
- [x] `src/app/api/calendar/ics/route.ts` — публичный фид: единый 404,
  `text/calendar`, `Content-Disposition: inline`, `private, no-store`.
- [x] `src/lib/route-guard.ts` — `/api/calendar/ics` в PUBLIC_EXACT_PATHS.
- [x] `src/server/actions/auth.ts` — оба выхода отзывают подписку по
  логину живой сессии (до удаления сессии; сбой не блокирует выход).
- [x] `src/components/session/calendar-subscribe-card.tsx` — карточка
  (клиент): URL + «Скопировать», подсказка Google/Apple, статус ссылки
  «до выхода из кабинета»; 1440 и 360 px.
- [x] `src/app/(cabinet)/grades/session/page.tsx` — карточка вместо
  кнопки-файла; origin из заголовков прокси; сбой подписки не роняет экран.
- [x] Удалён `src/app/api/session/ics/route.ts` (переработан в подписку);
  `src/lib/ics.ts` (сборщик VCALENDAR) переиспользуется фидом.

## e2e

- [x] `e2e/calendar-subscription.spec.ts` — валидность ICS (CRLF,
  VCALENDAR/VEVENT, PRODID), соответствие расписанию группы и контрольным
  (пара/консультация/отменена/перенос/экзамен/пересдача), изоляция чужой
  группы, стабильность ссылки между визитами, отзыв при выходе и
  «не оживание» прежней ссылки после повторного входа, единый 404 без
  токена, 360 px, сотруднику карточки нет.
- [x] `e2e/session.spec.ts` — обновлены шаги ICS на подписку; сотрудник:
  заглушка без карточки.
- [x] `e2e/prod-crawl.spec.ts` — гость: без редирект-шага по удалённому
  роуту; студент: фид по ссылке из карточки отвечает 200 text/calendar.

## Проверка

- [x] `npx vitest run` — 1003 passed; `npm run lint` — 0 errors;
  `npm run typecheck` — зелёный; `npm run build` — зелёный.
- [x] `node scripts/swarm/gates.mjs` — GATES_SUMMARY: green.
- [x] e2e `calendar-subscription` + `session` + `prod-crawl` на
  desktop-1440 и mobile-360 — зелёные.
