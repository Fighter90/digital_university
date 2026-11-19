# Tasks: режим доступности «Крупный текст и без эффектов» (DIG-86)

- [x] 1. Red-first: юнит-тест tests/a11y-mode.test.tsx — cookie-контракт
      du-a11y (парс/сериализация/round-trip/независимые тумблеры), классы
      на <html> по кукам (SSR root layout с cookie и без), CSS-контракт
      globals.css (font-size ≥ 112,5%, приоритет над font-lg/font-xl,
      transition-duration: 0, animation: none, тени, reveal видим),
      вкладка «Доступность» (тумблеры role="switch" из cookie),
      i18n-паритет RU/EN; подтверждено падение до реализации.
- [x] 2. `src/lib/a11y.ts` (чистый модуль: A11Y_COOKIE, тип A11yPrefs,
      parse/serialize/withA11yPref/a11yClasses) + `src/lib/a11y/server.ts`
      (getA11yPrefs, fail-soft — паттерн src/lib/i18n/server.ts).
- [x] 3. `src/server/actions/a11y.ts` — setA11y: owner-scoped
      (requireDataCtx), whitelist значений, запись/удаление cookie,
      revalidatePath('/', 'layout').
- [x] 4. `src/app/layout.tsx`: cookie → классы a11y-large-text /
      a11y-no-effects на <html> рядом с appearanceClasses (DIG-44).
- [x] 5. globals.css: блок DIG-86 вне media-запросов (независимость от
      prefers-reduced-motion), без переопределения токенов дизайн-системы.
- [x] 6. Вкладка «Доступность»: settings-tabs.ts (+ id accessibility),
      i18n RU/EN (settings.tab.accessibility, settings.a11y*),
      компонент AccessibilitySettings (два клавиатурных тумблера,
      aria-label, aria-live-статус), раздел на странице настроек.
- [x] 7. e2e-реестр prod-crawl: вкладка «Доступность» (?tab=accessibility,
      маркер контента) — чтобы обход настроек оставался полным.
- [x] 8. Зелёные: vitest (новый файл 28 passed + смежные: settings-page,
      i18n, design-tokens, micro-animations, scaffold), gates
      (node scripts/swarm/gates.mjs), delta-спека settings в этой папке.
