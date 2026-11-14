# DIG-55 — задачи

## Red-first (тесты до реализации)

- [x] `tests/user-menu.test.tsx` — «Выйти» обязан быть submit-кнопкой в форме
  с `signOutAction` (не ссылкой на `/login`); клик вызывает action; остальные
  пункты — ссылки. Падало красным (был `<Link href="/login">`).
- [x] `tests/access-control.test.ts` — `cacheControlFor` (protected → no-store,
  public → null) и `shouldSlideAuthCookies(..., method)` — мутации не продлевают
  куки. Падало красным (функций не существовало).
- [x] `tests/middleware.test.ts` — реальный middleware: защищённый ответ несёт
  `Cache-Control: no-store`, публичный — не трогает, POST server action не
  пере-выставляет куки. Падало красным.
- [x] `tests/login-page.test.tsx` — `?signedOut=1` → `role="status"`-сообщение,
  без параметра — нет; guard залогиненного сохранён. Падало красным.
- [x] `e2e/auth.spec.ts` — приёмка: выход → `/login?signedOut=1` с сообщением →
  `__Host-session` удалена → Back → снова `/login` (не кабинет); защищённая
  страница отвечает с `no-store`.

## Реализация

- [x] `src/components/shell/user-menu.tsx` — «Выйти» = submit-форма
  `signOutAction`; без `onClick`-закрытия меню (размонтирование отменяет
  submit — найдено e2e и закреплено unit-тестом).
- [x] `src/server/actions/auth.ts` — оба выхода редиректят на
  `/login?signedOut=1`.
- [x] `src/app/(auth)/login/page.tsx` — `role="status"`-сообщение об успешном
  выходе при `?signedOut=1`.
- [x] `src/lib/route-guard.ts` — `cacheControlFor()` + `NO_STORE_CACHE_CONTROL`;
  `shouldSlideAuthCookies` учитывает метод (GET/HEAD только).
- [x] `src/middleware.ts` — no-store на защищённых экранах; метод передаётся
  в решение о продлении.
- [x] `e2e/profile-settings.spec.ts` — ожидание `/login?signedOut=1` в сценарии
  смены пароля (выход через «Настройки» идёт тем же action'ом).

## Проверка

- [x] `npx vitest run` — 905/905. Раунд 1: единственное падение —
  предсуществующий флак `tests/grades-page.test.tsx` DIG-26 (воспроизводится
  на чистой ветке). Раунд 2: выяснено — это дата-бомба (подсказка пустого
  семестра берёт первую контрольную в будущем; с 14.11.2026 fixture-ный зачёт
  «Базы данных» стал прошлым). Починено пином Date внутри одного теста
  (`toFake: ['Date']`), продуктовый код не тронут. Попутно раунд 2 убрал
  случайно попавшие на ветку артефакты DIG-38/39 (красные тесты несуществующих
  экранов), ломавшие гейт typecheck.
- [x] `npx playwright test` (прод-сборка, desktop-1440 + mobile-360) —
  DIG-55 приёмка зелёная; без новых падений.
- [x] `npm run lint` — 0 ошибок; `npm run typecheck` — зелёный.
- [x] `node scripts/swarm/gates.mjs` — см. финальный прогон.
