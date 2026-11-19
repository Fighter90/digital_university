# DIG-77 — tasks

## Диагностика

- [x] Найдены оба action'а выхода: `signOutAction` / `signOutAllDevicesAction`
      (src/server/actions/auth.ts; UI: меню Shell `user-menu.tsx` + «Настройки»
      `sessions-list.tsx`) — оба уже ставят `buildClearedSessionCookie()` +
      `buildClearedRoleHintCookie()` через `signOutCurrentSession` /
      `signOutAllDevices` (src/server/auth/session.ts)
- [x] Воспроизведён регресс e2e auth.spec:188 локально на прод-сборке
      (1 из 2 повторов: кука `__Host-session` выжила, свежий 7-дневный Max-Age)
- [x] Найден механизм: prefetch-запросы роутера (`Next-Router-Prefetch: 1`),
      отправленные до «Выйти», приходят после ответа action'а — скользящее
      продление в middleware перезаписывает куку-очистку живым значением

## Red-first (тесты)

- [x] tests/middleware.test.ts — prefetch GET (protected и public path) не
      реиздаёт ни `__Host-session`, ни `__Host-role`; настоящий RSC-переход
      (без prefetch-заголовка) продлевает как раньше. Подтверждён RED до фикса
- [x] tests/access-control.test.ts — чистая функция `shouldSlideAuthCookies`:
      `isRouterPrefetch=true` → false; `false` → true (RED до фикса)
- [x] tests/signout-cookies.test.ts — обе куки-очистки: `value ''`,
      `maxAge 0`, `path '/'` (усиление по ТЗ DIG-77)

## Реализация

- [x] src/lib/route-guard.ts — `shouldSlideAuthCookies(..., isRouterPrefetch)`:
      prefetch не продлевает куки, навигация — продлевает
- [x] src/middleware.ts — чтение `next-router-prefetch`, передача в
      shouldSlideAuthCookies, комментарий DIG-77

## Верификация

- [x] Юнит: `pnpm vitest run tests/middleware.test.ts
      tests/signout-cookies.test.ts tests/access-control.test.ts` — 86 green
- [x] e2e auth.spec:188 (desktop-1440) — 3/3 повторов зелёные на прод-сборке
      (до фикса падал 1 из 2)
- [x] node scripts/swarm/gates.mjs → GATES_SUMMARY: green

## Не входит (замечено по пути, отдельные задачи)

- e2e auth.spec:125 «вход каждым» ожидает для сотрудника лендинг `/dashboard`,
  а после 63db150 сотрудник лендится на `/staff` — тест устарел, падал и до
  этого изменения.
