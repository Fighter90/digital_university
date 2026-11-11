# Tasks: экран входа — DIG-18

- [x] 1. Red-first: `tests/login-screen.test.tsx` (jsdom) — чипы тестовых
  аккаунтов заполняют форму, переключатель видимости пароля, ссылка
  «Забыли пароль?», сохранение контракта DIG-11 (autocomplete, role="alert",
  pending «Входим…», hidden next). Падало до реализации (чипов не было,
  страницы /forgot-password не существовало).
- [x] 2. Red-first: `tests/access-control.test.ts` — `/forgot-password`
  публичен (isPublicPath). Падало до правки route-guard.
- [x] 3. Red-first: e2e `e2e/auth.spec.ts` — чипы, показать пароль, заглушка
  «Забыли пароль?», неверный пароль реального аккаунта, вход каждым
  тестовым аккаунтом, блокировка после 5 неудач, `?next=`, мобильный 360
  (иллюстрация скрыта, поля 48 px), десктоп 1440 (разделённый экран).
- [x] 4. `src/lib/route-guard.ts`: `/forgot-password` в публичных путях.
- [x] 5. `src/components/auth/login-form.tsx`: поля 48 px, показать/скрыть
  пароль, чипы TEST_ACCOUNTS (канонический датасет DIG-12), «Забыли
  пароль?», role="alert", «Входим…», «Госуслуги (демо)» disabled.
- [x] 6. `src/app/(auth)/login/page.tsx`: разделённый экран — коралловый
  герой с aria-hidden «парящими» карточками (du-float, reduced-motion),
  форма справа; `ensureAppData()` до рендера (фикс первого входа на свежем
  старте); безопасный `next` из DIG-11.
- [x] 7. `src/app/(auth)/forgot-password/page.tsx`: заглушка «восстановление
  через деканат» + возврат ко входу.
- [x] 8. Ремонт DIG-13: `src/app/layout.tsx` подключает Onest 400–800
  (latin+cyrillic, `--font-onest`) — тест design-tokens падал на кончике
  ветки; `pnpm-lock.yaml` синхронизирован с package.json.
- [x] 9. Зелёные: vitest 261/261; e2e auth.spec 20 passed / 4 skipped
  (viewport-специфичные); `node scripts/swarm/gates.mjs`:
  lint=pass typecheck=pass (node --test: 2 предсуществующих красных
  DIG-9-контракта миграций, помечены «skip until reconcile task» в самом
  репозитории — вне скоупа DIG-18).
