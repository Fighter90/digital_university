# DIG-50 — delta-спека

## AUTH-STORE

### Selection (уточнение)

- Приложение выбирает auth-store ТОЛЬКО по наличию непустого
  `process.env.DATABASE_URL`: задан → prisma-store (generated client
  `@/generated/prisma` + драйвер-адаптер `@prisma/adapter-pg`); не задан →
  memory-store.
- Откат на memory при заданном `DATABASE_URL` ЗАПРЕЩЁН: недоступность
  PostgreSQL проявляется ошибкой на конкретном запросе (fail loud), а не
  молчаливой деградацией в память.
- Запуск на memory-store без `DATABASE_URL` логирует WARN с именем переменной
  и последствием (сессии/пользователи в памяти процесса).

### Session adapter (уточнение DIG-11)

- `findSessionByTokenHash` обязана запрашивать владельца сессии
  (`include: { user: true }`): сессия без владельца трактуется как
  отсутствующая (fail closed), а не как ошибка запроса.

## OBSERVABILITY

### Health

- `GET /api/health` возвращает `{ ok: true, authStore: 'prisma' | 'memory' }`
  без секретов и идентификаторов — enough для ops/security-проверки
  «memory-store не активен на проде».

## CABINET SHELL

### Header identity

- Личность в шапке кабинета строится из реальной сессии: профиль владельца
  логина (студент — ФИО/email/группа, сотрудник — ФИО/email/должность);
  при отсутствии строки профиля — логин сессии. Резолвер НЕ редиректит:
  отсутствие профиля в слое данных не выбрасывает вошедшего пользователя.

## DEPLOY

### Standalone

- Сгенерированный клиент Prisma (`src/generated/prisma`) попадает в
  Docker-образ явной COPY в runner-стадии.
- `outputFileTracingIncludes` не используется (ломает turbopack-standalone
  в Next 15.5.29 — теряются ssr-чанки); пин в `tests/docker.test.ts`.

## DEMO DATA

### Unified demo credentials

- Логины и пароли demo-набора DIG-12 (memory) совпадают с сидом БД
  (prisma/seed-data.ts): `anna.smirnova`, `ilya.petrov`, `dean.kovaleva`;
  пароли — публичные по дизайну прототипа (`anna-demo-2026`,
  `ilya-demo-2026`, `dean-demo-2026`), отображаются чипами экрана входа.
