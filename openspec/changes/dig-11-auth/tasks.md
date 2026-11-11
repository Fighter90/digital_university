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

- [x] `npx vitest run tests/auth-*.test.ts tests/access-control.test.ts` — зелёные.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — зелёные.
- [x] e2e (`pnpm e2e`) — 12/12 зелёных в раунде 2 (desktop-1440 + mobile-360,
  auth + smoke, dev-сервер на in-memory store; раунд 1 не запускался —
  замечание ревью устранено, запуск приложен в журнале).

## Раунд 2 — замечания ревью

- [x] e2e `pnpm e2e` прогнан до мерджа: 12/12 зелёных (замечание 1).
- [x] IP для rate limit больше не берётся из первого (клиентского) элемента
  `X-Forwarded-For`: `src/lib/request-ip.ts` — `X-Real-IP` от прокси
  (контракт Caddy `header_up X-Real-IP {remote_host}`) с фолбэком на последний
  hop; тесты `tests/request-ip.test.ts`; контракт описан в `docs/security.md`
  (замечание 2).
- [x] Origin-проверка мутационных API — fail-closed: запрос без Origin
  отклоняется 403; тест в `tests/access-control.test.ts` перевернут,
  поведение зафиксировано в спеке и `docs/security.md` (замечание 3).
- [x] Компромисс `ACCOUNT_LOCKED` (раскрывает существование логина) отмечен
  в `docs/security.md` (замечание 4).
- [x] `role-cookie.ts`: тип-хак `as unknown as ArrayBuffer` заменён на
  точный тип `Uint8Array<ArrayBuffer>`; «Как устроен вход» сжат до
  6 предложений (замечание 5).

## Раунд 3 — замечания ревью (блокеры)

- [x] Блокер 1: «скользящее продление» фактически не работало —
  `resolveSession` продлевал только строку в хранилище, а cookie
  `__Host-session` жила фиксированные 7 дней от входа: активного
  пользователя браузер разлогинивал ровно через 7 дней. Теперь middleware
  на каждом разрешённом запросе пере-выдаёт cookie с тем же токеном и
  полным Max-Age (red-first: `tests/middleware.test.ts` — сам middleware,
  форма и Max-Age Set-Cookie; `tests/access-control.test.ts` — чистое
  решение `shouldSlideAuthCookies`).
- [x] Блокер 2 (тот же класс, найден аудитом): hint `__Host-role` тоже
  жил 7 дней от входа — активный сотрудник терял middleware-пропуск в
  `/staff` (redirect на `/dashboard`) до повторного входа. Hint
  пере-выдаётся вместе с сессией только при проверенной подписи;
  redirect/CSRF-отказ и непроверяемая подпись cookie не продлевают
  (тесты в том же `tests/middleware.test.ts`).
- [x] Спека (`specs/auth/spec.md`) и `docs/security.md` обновлены:
  продление описано по обе стороны (хранилище + cookie), добавлен
  сценарий «Активный сотрудник не теряет /staff».
- [x] Гейты: vitest / lint / typecheck / build — зелёные.
