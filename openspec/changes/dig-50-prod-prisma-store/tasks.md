# DIG-50 — задачи

## Red-first (тесты до реализации)

- [x] `tests/store-selection.test.ts` — выбор store: `DATABASE_URL` → prisma,
  иначе memory с WARN; активный `authStoreKind` соответствует env;
  `/api/health` публикует вид хранилища.
- [x] `tests/require-user.test.ts` — заглушка `src/server/auth.ts` удалена,
  ни один файл не импортирует `@/server/auth`, вымышленная личность
  «Анна Студентова» не осталась в исходниках, layout идёт через
  `requireUser()` из `@/server/auth/session`.
- [x] `tests/shell-user.test.ts` — fail-soft резолвер личности шапки:
  студент/сотрудник с профилем → профиль, без строки профиля → личность
  сессии, без redirect и без исключений.
- [x] `tests/auth-store.test.ts` — фейковый клиент моделирует контракт
  реального Prisma: `findSessionByTokenHash` обязан передавать
  `include: { user: true }` (регрессия prod-логина).
- [x] `tests/docker.test.ts` — клиент Prisma в образе явной COPY
  (`deploy/Dockerfile`), `outputFileTracingIncludes` запрещён (ломает
  turbopack-standalone), `@prisma/client-runtime-utils` в dependencies.

## Реализация

- [x] `src/server/auth/store.ts` — `selectAuthStoreKind` + `createAppAuthStore`:
  `DATABASE_URL` → prisma-store (generated client + adapter-pg), иначе memory
  с явным WARN при старте; `authStoreKind` для health.
- [x] `src/server/auth/prisma-store.ts` — `include: { user: true }` в
  `findSessionByTokenHash` (фикс входа на живой БД).
- [x] `src/app/api/health/route.ts` — `{ ok, authStore }`.
- [x] `src/server/auth.ts` (заглушка) удалён; `(cabinet)/layout.tsx` и
  `src/server/notifications.ts` — реальная сессия (DIG-11).
- [x] `src/server/data/shell-user.ts` — `resolveShellUser` (fail-soft).
- [x] `next.config.ts` — без outputFileTracingIncludes (ломает standalone в
  Next 15.5.29 + Turbopack), комментарий с обоснованием.
- [x] `deploy/Dockerfile` — `COPY /app/src/generated ./src/generated` в runner.
- [x] `package.json` — `@prisma/client-runtime-utils` (резолвинг импортов
  сгенерированного клиента при сборке).
- [x] Единые креды demo-набора и сида БД: `src/server/data/demo-seed.ts`,
  `src/components/auth/login-form.tsx` (чипы), e2e-спеки.
- [x] `e2e/prod-auth.spec.ts` — приёмка на prod-сборке: вход `anna.smirnova`
  → `/dashboard`, `__Host-session`, реальный пользователь в шапке, изоляция
  `ilya ≠ anna` (свой токен, чужая заявка — единый 404); skip на memory-store.
- [x] `e2e/cabinet-shell.spec.ts` — вход под сессией перед проверкой каркаса;
  `e2e/profile-settings.spec.ts` — `exact: true` в локаторе пароля.

## Проверка

- [x] `npx vitest run` — зелёный; `node --test tests/*.test.mjs` — зелёный.
- [x] `npm run lint`, `npm run typecheck`, `npm run build` — зелёные.
- [x] Локальный prisma-стенд: сид БД (argon2id), логин `anna.smirnova` через
  форму на prod-сборке → `/dashboard`, шапка показывает владельца сессии,
  изоляция Ильи и Анны, чужая заявка — 404 (страница и API).
- [x] Standalone (`node .next/standalone/server.js` + COPY-контракт):
  health `{"ok":true,"authStore":"prisma"}`, вход работает.
- [x] e2e-прогон описан в ai-log; memory-режим (без DATABASE_URL) — новый
  spec честно пропускается, остальные сценарии не меняют поведения.
