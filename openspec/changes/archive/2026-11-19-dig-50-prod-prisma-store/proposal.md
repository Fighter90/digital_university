# DIG-50 — Prod: prisma-store при наличии DATABASE_URL, standalone несёт клиент Prisma, логин работает на ostrovok.store

## Зачем

Прод (https://ostrovok.store) работал на memory-store: `requireUser()` возвращал
заглушку «Анна Студентова», `signIn` смотрел в пустой in-memory store — вход был
невозможен для любого аккаунта, хотя сид в БД корректный (argon2id, User/Session).
Причины: (1) приложение выбирало auth-store без учёта `DATABASE_URL`, падение
клиента молча откатывало на memory; (2) standalone-сборка не гарантировала
наличие сгенерированного клиента Prisma в образе.

## Что

- Выбор store по окружению: чистая функция `selectAuthStoreKind()` +
  `createAppAuthStore()` в `src/server/auth/store.ts` — при заданном
  `DATABASE_URL` приложение работает на prisma-store (generated client из
  `src/generated/prisma` + драйвер-адаптер `@prisma/adapter-pg`); без него
  допустим memory-store, но только с явным `console.warn` при старте.
  Молчаливый откат на memory запрещён и покрыт тестами.
- Фикс адаптера: `findSessionByTokenHash` читает сессию с
  `include: { user: true }` — реальный клиент Prisma не отдаёт связь, пока её
  не запросишь (фейк в тестах всегда вкладывал user, поэтому расхождение
  всплыло только на живой БД: сессии создавались, но `requireUser()` их не
  находил → редирект на /login). Контракт закреплён фейком в
  `tests/auth-store.test.ts`.
- Клиент Prisma в образе: явная `COPY /app/src/generated ./src/generated`
  в runner-стадию `deploy/Dockerfile`. `outputFileTracingIncludes` НЕ
  используется: в Next 15.5.29 + Turbopack любая конфигурация этой опции
  ломает сборку standalone (теряются ssr-чанки .next/standalone, проверено
  эмпирически: 73 → 25/0 файлов, страницы отдают 500). Turbopack инлайнит
  клиент в серверные бандлы; `@prisma/client-runtime-utils` объявлен в
  dependencies (иначе сборка не резолвит импорт сгенерированного клиента).
- Заглушка `src/server/auth.ts` удалена; `(cabinet)`-layout использует
  реальный `requireUser()` из `src/server/auth/session.ts`, а личность в шапке
  Shell строит новый fail-soft резолвер `resolveShellUser()` (слой данных):
  профиль владельца логина, при отсутствии строки профиля — личность сессии
  (без redirect — БД-пользователь не выбрасывается на /login).
- Единые демо-креды: логины/пароли demo-набора DIG-12 выровнены с сидом БД
  (`anna.smirnova`/`anna-demo-2026`, `ilya.petrov`/`ilya-demo-2026`,
  `dean.kovaleva`/`dean-demo-2026`) — чипы экрана входа работают одинаково на
  memory-store и на prisma-проде, e2e не зависит от режима.
- `/api/health` публикует активный `authStore` (prisma | memory) — security
  может проверить на проде: memory-store не активен при заданном DATABASE_URL.
- e2e прод-режима `e2e/prod-auth.spec.ts`: вход `anna.smirnova` на
  prod-сборке → `/dashboard`, кука `__Host-session` (HttpOnly, SameSite=Lax),
  реальный пользователь в меню, изоляция `ilya ≠ anna` (свой токен сессии,
  чужая заявка — единый 404). Спека активна только на prisma-store.
- `e2e/cabinet-shell.spec.ts` заходит в кабинет под сессией (middleware DIG-11
  защищает /dashboard); `e2e/profile-settings.spec.ts` — точный
  `getByLabel('Пароль', { exact: true })` (чип «Показать пароль» ломал
  строгий локатор).

## Риски / границы

- Данные кабинета (расписание, заявки, оценки) продолжают отдаваться из
  demo-набора DIG-12 в памяти процесса — подключение слоя данных к PostgreSQL
  (prisma-адаптер DataDb) — отдельная задача; на проде login/sessions живут в
  БД, учебные данные остаются вымышленными.
- IP-лимитер входа остаётся in-memory (per-process) — достаточно для
  прототипа; перенос в БД/Redis — за рамками задачи.
