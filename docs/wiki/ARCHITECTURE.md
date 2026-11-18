# Архитектура (кратко для агентов и новичков)

## Слои
1. **Экраны** `src/app/(cabinet)/**` — серверные компоненты; клиентские острова только для интерактива.
2. **Server Actions** `src/server/actions/**` — все мутации; вход через `requireDataCtx()/requireStaff()`, мутации owner-scoped по `ctx.studentId`.
3. **Фасады домена** `src/server/data/<модуль>.ts` — бизнес-правила, аудиты, View-типы.
4. **Порт** `src/server/data/port.ts` — интерфейс `DataDb`; доступ к данным ТОЛЬКО через `@/server/data` (ESLint закрепляет).
5. **Адаптеры**: `memory-db.ts` (детерминированный сид, домен прототипа) и Prisma (auth/пользователи/сессии).
6. **Сид** `src/server/data/demo-seed.ts` — вымышленные данные; идемпотентный Prisma-сид — `prisma/seed.ts`.

## Безопасность
- Login: rate-limit 30/15 мин на IP → lock после 5 неудач → argon2 → сессия (в БД только SHA-256 токена).
- Куки `__Host-session` + `__Host-role` (HMAC от AUTH_SECRET; fail-closed без секрета).
- Middleware: /staff* студенту 403; same-origin для мутаций; единый 404 без оракула существования.
- Отказы → AuditLog (OWNERSHIP_DENIED / OUTSIDE_FACULTY / ROLE_MISMATCH / NOT_FOUND).

## i18n
`src/lib/i18n/{ru,en}.ts` — плоские ключи (паритет типами + тест); `t(locale,key,vars)`; cookie `du-locale`; action `setLocale`; RU по умолчанию байт-в-байт.

## Машина статусов (DIG-30)
`RequestStatus`: SUBMITTED → ACCEPTED → IN_PROGRESS → READY → ISSUED; ветки NEEDS_FIX / NEEDS_REVISION / REJECTED / CANCELLED / COMPLETED. Переходы через `lib/request-machine`; матрица сотрудника — `lib/staff-transitions.ts`.
