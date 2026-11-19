# delta: auth-session — куки сессии и role-hint

## ADDED

### Requirement: Скользящее продление кук не выполняется на prefetch-запросах роутера

Middleware НЕ переиздаёт `__Host-session` и `__Host-role` на запросах с
заголовком `Next-Router-Prefetch: 1` (speculative prefetch роутера Next.js).

Prefetch-ответ может быть применён браузером в произвольный момент — в том
числе ПОСЛЕ ответа sign-out action'а, сбросившего обе куки (maxAge 0).
Продление на prefetch «воскресило» бы куку сессии в браузере после выхода
(регресс e2e auth.spec:188, DIG-77).

#### Scenario: Prefetch защищённого пути не продлевает куки

- **WHEN** GET-запрос на защищённый путь несёт валидную куку `__Host-session`
  и заголовки `RSC: 1`, `Next-Router-Prefetch: 1`
- **THEN** ответ имеет статус 200 и НЕ содержит `Set-Cookie` ни для
  `__Host-session`, ни для `__Host-role`

#### Scenario: Prefetch публичного пути не продлевает куки

- **WHEN** GET-запрос на публичный путь (например, `/login`) несёт куку
  `__Host-session` и заголовок `Next-Router-Prefetch: 1`
- **THEN** ответ НЕ содержит `Set-Cookie` для auth-кук

#### Scenario: Настоящая RSC-навигация продлевает куку по-прежнему

- **WHEN** GET-запрос несёт куку `__Host-session` и `RSC: 1` БЕЗ
  `Next-Router-Prefetch: 1`
- **THEN** ответ переиздаёт `__Host-session` с тем же значением токена и
  полным `Max-Age=604800` (контракт review round 3 DIG-55 сохранён)

## MODIFIED

### Requirement: Оба sign-out action'а сбрасывают обе куки

Server actions `signOutAction` (меню Shell) и `signOutAllDevicesAction`
(«Настройки») удаляют строку сессии в БД и выставляют ОБЕ куки в
сбрасывающее состояние — `buildClearedSessionCookie()` и
`buildClearedRoleHintCookie()`: `value: ''`, `maxAge: 0`, `path: '/'`,
`httpOnly`, `secure`, `sameSite: 'lax'` (соответствие DIG-55).

#### Scenario: «Выйти» на текущем устройстве

- **WHEN** вызван `signOutCurrentSession` при живой сессии
- **THEN** строка сессии удалена из БД по tokenHash; `cookies().set` вызван
  для `__Host-session` и `__Host-role` с `value ''`, `maxAge 0`, `path '/'`

#### Scenario: «Выйти на всех устройствах»

- **WHEN** вызван `signOutAllDevices` при живой сессии
- **THEN** отозваны все сессии пользователя; обе куки выставлены в
  сбрасывающее состояние (`value ''`, `maxAge 0`, `path '/'`)

#### Scenario: E2E-контракт выхода

- **WHEN** пользователь нажал «Выйти» и оказался на `/login?signedOut=1`
- **THEN** куки `__Host-session` и `__Host-role` в браузере отсутствуют —
  независимо от prefetch-трафика, ушедшего до клика
