# DIG-77 — Баг: «Выйти» не удаляет куку __Host-session (regression e2e auth)

## Why

Регресс e2e `auth.spec:188` («Выйти» → кука `__Host-session` обязана исчезнуть):
тест падал **нестабильно** — в части прогонов после выхода в браузере оставалась
живая кука `__Host-session` с тем же токеном и свежим 7-дневным `Max-Age`.
Воспроизведено локально на прод-сборке (Playwright, desktop-1440, 1 из 2
повторов падал).

Оба server action'а выхода (`signOutAction` из меню Shell и
`signOutAllDevicesAction` из «Настроек») уже корректно ставили ОБЕ куки-очистки
`buildClearedSessionCookie()` + `buildClearedRoleHintCookie()` (maxAge 0,
path `/`, комментарий DIG-55) — юнит-контракт `tests/signout-cookies.test.ts`
был зелёным. Причина гонки в другом слое: **скользящее продление кук в
middleware**.

Механизм (подтверждён трассировкой ответов):

1. Сайдбар кабинета префетчит ссылки роутера (`Next-Router-Prefetch: 1`,
   `RSC: 1`): `/tasks?_rsc=…`, `/settings?_rsc=…` и т.д. — каждый prefetch
   несёт живую куку сессии.
2. Пользователь нажимает «Выйти»: server action удаляет сессию в БД и отвечает
   `Set-Cookie: __Host-session=; Max-Age=0` + `__Host-role=; Max-Age=0` + 303
   на `/login?signedOut=1`.
3. Prefetch, отправленный **до** клика, приходит с ответом **после** ответа
   action'а (гонка порядка применения Set-Cookie в браузере). Middleware
   пропускает prefetch как GET-«навигацию» и продлевает куку: тот же токен,
   свежий полный `Max-Age=604800` — кука «воскресает» в джаре браузера.
4. e2e видит куку живой → падение. Сессия в БД удалена (безопасность не
   нарушена), но контракт «после выхода куки нет» — нарушен, и кука-мусор
   остаётся в браузере.

## What Changes

- **Middleware не продлевает куки на prefetch-запросах роутера**:
  `shouldSlideAuthCookies(…, isRouterPrefetch)` возвращает `false`, когда
  запрос помечен `Next-Router-Prefetch: 1`. Prefetch — спекулятивный запрос,
  момент применения его ответа не контролируется, поэтому писать
  auth-куки на нём нельзя.
- **Настоящая навигация не теряет продление**: документ-GET и настоящий
  RSC-переход (`RSC: 1` без prefetch-заголовка) продлевают куки, как раньше —
  контракт «скользящего продления» (review round 3 DIG-55) сохранён.
- Оба sign-out action'а продолжают ставить обе куки-очистки
  (`buildClearedSessionCookie()` + `buildClearedRoleHintCookie()`, maxAge 0,
  path `/`) — поведение не менялось, покрытие `tests/signout-cookies.test.ts`
  усилено явной проверкой `path: '/'`.
- e2e `auth.spec:188` («Выйти» → кука undefined) зелёный стабильно:
  3/3 повторов + полный прогон.

## Non-goals

- Не менять форму/имена кук, TTL, механизм сессий и role-hint.
- Не менять решение о доступе (`decideAccess`) и проверки CSRF/Origin.
- Не трогать server-side sliding (`resolveSession`, session-policy.ts) —
  продление строки сессии в БД остаётся на любой активности.
- Не чинить устаревшее ожидание e2e «вход каждым» (staff теперь лендится на
  `/staff` после 63db150; тест ожидает `/dashboard`) — отдельная задача,
  к регрессии выхода не относится.

## Impact

- `src/lib/route-guard.ts` — сигнатура `shouldSlideAuthCookies` (+1
  опциональный параметр, поведение по умолчанию прежнее).
- `src/middleware.ts` — чтение заголовка `next-router-prefetch`, передача в
  shouldSlideAuthCookies.
- Тесты: `tests/middleware.test.ts` (+3), `tests/access-control.test.ts` (+2),
  `tests/signout-cookies.test.ts` (усилены 2 проверки path).
