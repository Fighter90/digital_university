# DIG-77 — задачи

## Диагностика

- [x] Воспроизвести регресс на проде: CDP-зонд (playwright + Network.
  responseReceivedExtraInfo) на ostrovok.store — куки воскресают после
  «Назад» с тем же токеном; на свежей прод-сборке локально — гонка
  воспроизводится недетерминированно (2 из 3 прогонов e2e).
- [x] Проверить sign-out action'ы (меню и настройки): оба ставят
  `buildClearedSessionCookie()` И `buildClearedRoleHintCookie()`
  (`src/server/auth/session.ts`) — подтверждено, изменений не требует.
- [x] Проверить атрибуты куки-очистки (path/domain-гипотеза задачи):
  совпадают с выдачей по name/Path, Domain отсутствует у обеих —
  гипотеза отклонена, атрибуты верны.
- [x] Поймать гонщика: prefetch-шторм дашборда и RSC-навигация на
  `/login?signedOut=1` завершаются ПОСЛЕ куки-очистки; middleware
  sliding re-issue пере-выдаёт живые куки поверх очистки.

## Red-first (тесты до реализации)

- [x] `tests/access-control.test.ts` — новые правила слайдинга падают
  красным: fetch-ответ (RSC prefetch/навигация, `Sec-Fetch-Dest ≠
  document`) не продлевает куки; `/login` и `/forgot-password` не
  продлевают; документ-навигации продлевают; fail-open без
  Fetch-Metadata. (3 теста падали «expected true to be false».)
- [x] `tests/auth-core.test.ts` — DoD «cleared-спеки удаляют обе куки»:
  `buildClearedRoleHintCookie` — `__Host-role`, `Max-Age=0`, атрибуты
  совпадают с выдачей (покрытия не было).

## Реализация

- [x] `src/lib/route-guard.ts` — `SlideContext { path,
  isDocumentNavigation }`; слайд только для документ-навигаций вне
  auth-экранов; fail-open для клиентов без Fetch-Metadata; комментарий
  с механизмом гонки и ссылкой на документацию Next.js (зачистка
  `rsc`/`next-router-prefetch` из request.headers middleware).
- [x] `src/middleware.ts` — передать `pathname` и `sec-fetch-dest`
  (document → слайд; empty/прочее → нет; нет заголовка → слайд).
- [x] `.env.example` — `SESSION_SECRET` (мёртвое имя) → `AUTH_SECRET`
  (реально читается кодом), имена без значений.

## e2e

- [x] `e2e/auth.spec.ts` DIG-55-группа: удаление `__Host-role` проверяется
  наряду с `__Host-session`; после «Назад» — ни одной `__Host-*` куки
  (пин гонки DIG-77); добавлен сценарий «Выйти на всех устройствах» из
  настроек (`signOutAllDevicesAction`) с проверкой обеих кук.
- [x] Стабилизация чип-логинов DIG-18 в том же файле (паттерн файла:
  ждать подстановку значений до сабмита); ассерт лендинга сотрудника
  обновлён на 63db150 (staff → `/staff`, «Сводка деканата»).

## Верификация

- [x] `npx vitest run tests/access-control.test.ts tests/auth-core.test.ts` — 91/91.
- [x] `npm run typecheck` — зелёный; `npm run lint` — зелёный.
- [x] e2e прод-конфигурация (свежий `pnpm build && pnpm start`,
  DATABASE_URL → Prisma, AUTH_SECRET задан): DIG-55-группа 4/4 (×повторы),
  весь `auth.spec` desktop 13/13 + mobile — на прод-конфигурации.
- [x] CDP-зонд на фиксед-сервере: после клика «Выйти» — ровно один
  Set-Cookie (CLEARED×2), через 2.5 c кук `__Host-*` нет (3/3 прогона).
