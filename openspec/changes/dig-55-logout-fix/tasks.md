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

## Раунд 2 — замечания ревью (тест-гейты)

- [x] `scripts/build-lock.mjs` + `tests/build-lock.test.mjs` (red-first) —
  причина красного гейта build: два параллельных `next build` на общем
  checkout (на машине живут несколько orchestrator'ов) гоняются за один
  `.next` → `unhandledRejection ENOENT copyfile
  .next/server/edge-runtime-webpack.js → .next/standalone/…` на этапе
  «Collecting build traces» (воспроизведено косвенно: `rm -rf .next` поймал
  «Directory not empty» от параллельной записи). `npm run build` теперь
  берёт эксклюзивный mkdir-lock (`.next-build.lock`, в .gitignore): gates,
  e2e webServer (`pnpm build`) и Dockerfile выстраиваются в очередь; lock
  от убитого процесса крадётся по мёртвому pid или staleMs.
  scripts/swarm/ не тронут.
- [x] `src/app/(cabinet)/grades/session/page.tsx` — убран неиспользуемый
  импорт `SessionSkeleton` (скелетон подключает loading.tsx).
- [x] `src/components/gradebook/gradebook-list.tsx` — убран мёртвый
  `fillTone` (прогресс-бара в компоненте нет).
- [x] `src/lib/transcript-pdf.ts` — убрана неиспользуемая константа
  `COL_DATE` (таблица PDF без колонки дат в паддинге).
- [x] `src/server/data/memory-db.ts` — убран неиспользуемый type-import
  `SchedulePeriod` (параметр типизируется интерфейсом порта).
- [x] `tests/build-hermetic.test.ts` — контракт `scripts.build` обновлён
  (red-first: гейт test поймал старое ожидание `build === 'next build'`):
  обёртка build-lock сохраняет инвариант DIG-12 (чистый webpack-прогон без
  чистящей прелюдии), добавляя только сериализацию параллельных сборок.
- [x] Повторный прогон гейтов — lint/typecheck/build/test зелёные
  (замечания «unused-vars» из хвоста ревью устранены, build детерминирован).

## Раунд 3 — замечания ревью (повтор: тот же красный хвост гейтов)

- [x] Диагностика: хвост ревью раунда 3 повторяет замечания раунда 2 (те же
  четыре `no-unused-vars` в `src/` + ENOENT на «Collecting build traces»,
  но с другим исчезнувшим файлом — `routes-manifest.json` вместо
  `edge-runtime-webpack.js`). Проверка HEAD: все четыре предупреждения уже
  убраны коммитом build-lock, `npm run build` через lock проходит
  (standalone-копирование завершается). В логе локального e2e-прогона
  видно подтверждение причины: `[build-lock] stealing stale lock
  (holder pid=…)` — параллельная сборка другого executor'а застала ревью
  до прилёта фикса (устаревший снимок). Замечания уже покрыты HEAD.
- [x] Закоммичен оборванный фикс из раунда 3: `tests/eslint-isolation-rule.test.ts`
  — явные таймауты прогрева ESLint-конфига (120s) и самих lint-тестов (90s)
  вместо глобальных 30s: на машине роя воркеры Vitest гоняются параллельно
  с другими executor'ами, холодная компиляция конфига (compat + jiti + плагины
  Next) превышала hookTimeout — beforeAll падал по таймауту, отсюда «упавшие
  тест-гейты» без содержательных отказов.
- [x] `tests/signout-cookies.test.ts` (новый, 4 теста) — закреплён server-side
  контракт выхода, который браузерный e2e не видит: signOutCurrentSession
  удаляет строку сессии из БД по tokenHash и выставляет ОБЕ куки
  (`__Host-session` и `__Host-role`) в сбрасывающее состояние (value '',
  maxAge 0); signOutAllDevices — то же по userId (отзыв всех сессий);
  без куки сессии БД-удаления нет, но куки всё равно сбрасываются.
  Границы (`next/headers`, auth store) замоканы; session.ts, cookies.ts,
  tokens.ts, session-policy.ts — реальные. Закрывает последний непокрытый
  пункт приёмки (сброс `__Host-role` ранее не проверялся нигде).
- [x] Финальный прогон: `npx vitest run` — 57 файлов / 909 тестов зелёные;
  `node --test tests/*.test.mjs` — 36/36; `npm run lint` — 0 ошибок;
  `npm run typecheck` — зелёный; `npm run build` (через build-lock) —
  standalone-сборка без ENOENT; e2e DIG-55 приёмка на прод-сборке
  (desktop-1440) — зелёная.

## Раунд 3 — замечания ревью (тест-гейты)

- [x] `tests/eslint-isolation-rule.test.ts` — единственное падение гейта:
  `beforeAll` warm-up ESLint-конфига (compat + jiti + плагины `next/*`)
  превышает глобальный `hookTimeout: 30_000` на насыщенной машине роя
  (воркеры Vitest всех файлов тестов + параллельные executor'ы) и хук
  умирает по таймауту до первого assertions. Red-first: воспроизведено
  эмуляцией загруженной машины — `npx vitest run
  tests/eslint-isolation-rule.test.ts --hookTimeout=2000` даёт ровно тот же
  «Hook timed out in 2000ms» (холодная компиляция ≈4-5s > кап).
  Фикс (только тест, продуктовый код не тронут): собственные таймауты
  последним аргументом перекрывают глобальный кап — warm-up 120s,
  каждый тест 90s (если warm-up прерван, первый тест переоплачивает
  холодную компиляцию). Green: тот же запуск с капами 2s теперь зелёный.
  Семантика теста не ослаблена — реальный конфиг `eslint.config.mjs`
  по-прежнему выполняется, inline-копия правила не заводилась.
- [x] Шум `stderr «DATABASE_URL не задан — auth store работает в памяти»`
  в хвосте гейта — не падение (fallback memory-store задокументирован,
  suites с этими предупреждениями зелёные), исправления не требует.
- [x] Повторный `npx vitest run` — 905/905 (56 файлов) + `node --test`
  36/36; `npm run typecheck` — зелёный. `node scripts/swarm/gates.mjs`
  финальный прогон — после освобождения checkout от чужой параллельной
  сборки (посторонний `npx next build` в основном checkout'е другой
  сессии, мимо build-lock — внешняя контенция, не дефект ветки).
