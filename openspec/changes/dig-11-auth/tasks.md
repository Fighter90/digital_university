# DIG-11 — задачи

## Red-first (тесты до реализации)

- [x] `tests/auth-core.test.ts` — argon2id-параметры, токены, вход (единая
  ошибка, блокировка после 5 попыток, IP-лимит), истечение сессии, скользящее
  продление, выход / выход со всех устройств, форма cookie.
- [x] `tests/auth-store.test.ts` — Prisma-адаптер: в БД нет открытых паролей
  и открытых токенов сессий; блокировка через `failedLogins/lockedUntil`;
  истечение/продление сессий.
- [x] `tests/access-control.test.ts` — публичные/защищённые маршруты,
  open-redirect-safe `next`, подпись role-hint, решения middleware
  (кабинет, /staff, Origin-проверка API).

## Реализация

- [x] `src/server/auth/password.ts` — argon2id (OWASP 19 MiB / 2 / 1).
- [x] `src/server/auth/tokens.ts` — токен 256 бит + SHA-256.
- [x] `src/server/auth/types.ts` — порты AuthStore/IpRateLimiter и константы.
- [x] `src/server/auth/memory-store.ts` — in-memory хранилище + IP-лимитер.
- [x] `src/server/auth/prisma-store.ts` — адаптер на схему DIG-9.
- [x] `src/server/auth/login.ts` — вход: IP-лимит → блокировка → argon2id →
  сессия; единая ошибка; timing-выравнивание.
- [x] `src/server/auth/session-policy.ts` + `session.ts` — скользящее
  продление, `requireUser()` / `requireStaff()`, выход, выход со всех устройств.
- [x] `src/server/auth/cookies.ts` + `role-cookie.ts` — `__Host-session`
  (HttpOnly/Secure/SameSite=Lax/Path=/) и подписанный `__Host-role` (HMAC).
- [x] `src/server/auth/store.ts` — подключение хранилища приложения
  (in-memory до смержа DIG-9/DIG-10, переключение одной строкой).
- [x] `src/server/actions/auth.ts` — signIn/signOut/signOutAll actions.
- [x] `src/lib/route-guard.ts` + `src/middleware.ts` — защита кабинета,
  /staff, Origin-проверка мутационных API.
- [x] Форма входа работает (`src/components/auth/login-form.tsx`), неактивная
  кнопка «Войти через Госуслуги (демо)»; кнопки выхода в кабинете.

## Документация

- [x] `docs/security.md` — раздел «Как устроен вход» (7 предложений без
  жаргона) + обновлён раздел про пароли (argon2id вместо bcrypt).
- [x] `.env.example` — AUTH_SECRET (уже был) теперь реально используется
  (подпись role-hint); NextAuth-переменные убраны как неиспользуемые.
- [x] `THIRD_PARTY_LICENSES.md` — запись `@node-rs/argon2` (MIT).

## Проверка

- [x] `npx vitest run tests/auth-*.test.ts tests/access-control.test.ts` — 46 зелёных.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — зелёные.
- [ ] e2e (`pnpm e2e`) — запуск в среде с dev-сервером (без БД smoke проходит:
  redirects middleware + форма входа; сценарии входа — после смержа DIG-10).
