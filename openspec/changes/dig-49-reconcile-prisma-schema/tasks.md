# Задачи: dig-49-reconcile-prisma-schema

- [x] Red: `tests/prisma-schema.test.mjs` — сняты `test.skip` с 11 контрактов,
      прогон подтверждает падение (11/14 red).
- [x] `prisma/schema.prisma`: канон DIG-9 объединён с добавками сидов DIG-10
      и auth-моделями DIG-11; `prisma validate` — зелёный.
- [x] Разрешены конфликты имён (RequestType/RequestKind, RequestStatus 8,
      ScheduleEvent, Grade, RequestEvent, Notification, FaqArticle) —
      решения задокументированы в шапке схемы.
- [x] `prisma/seed.ts`: User-строки для трёх тестовых аккаунтов (пароли —
      только в User), маппинг статусов/форм обучения/уведомлений на словари
      канона; сид идемпотентен (прогон дважды, одинаковые счётчики).
- [x] Миграция регенерирована на чистой БД (`migrate dev --create-only` +
      ручные фрагменты + применение): sequence, CHECK номера и оценки,
      FTS+GIN — проверены в psql.
- [x] `npx prisma generate` — клиент перегенерирован.
- [x] `node --test tests/*.test.mjs` — 24/24 зелёные (в т.ч. 14 контрактов).
- [x] `npx vitest run` — 305/305 зелёные (сид-контракты DIG-10 не сломаны).
- [x] `npm run lint` (0 ошибок), `npm run typecheck`, `npm run build` — зелёные;
      `node scripts/swarm/gates.mjs` — green.
