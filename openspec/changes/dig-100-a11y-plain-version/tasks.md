# Tasks: «Версия для слабовидящих» — plain-режим (DIG-100)

- [x] 1. Red-first: tests/a11y-version.test.tsx (cookie du-a11y-version,
      action toggleA11yVersion: plain/off/битое значение/open redirect,
      класс a11y-plain на <html> по кукам — SSR root layout, сосуществование
      с DIG-86, словарь a11y.version.* RU/EN, CSS-контракт globals.css) и
      tests/a11y-version-places.test.tsx (полоска НАД шапкой и футер —
      Shell и лендинг, RU/EN, plain-режим); подтверждено падение до реализации.
- [x] 2. src/lib/a11y/version.ts (чистый модуль: A11Y_VERSION_COOKIE,
      A11Y_PLAIN_CLASS, isA11yVersion, isPlainVersionFromCookie) +
      isA11yPlain в src/lib/a11y/server.ts (fail-soft, паттерн getA11yPrefs).
- [x] 3. src/server/actions/a11y.ts — toggleA11yVersion: owner-scoped
      (requireDataCtx), whitelist 'plain'|'off', next — только внутренний
      путь, запись cookie, revalidatePath('/', 'layout').
- [x] 4. src/app/layout.tsx: cookie → класс a11y-plain на <html>.
- [x] 5. Компонент src/components/a11y/version-link.tsx (strip/footer,
      форма с server action — работает без JS); Shell: полоска над TopBar
      и футер; cabinet layout: cookie → проп a11yPlain.
- [x] 6. Лендинг: LandingContent (проп plain) — полоска над шапкой и
      ссылка в футере; page.tsx читает cookie.
- [x] 7. Словарь: a11y.version.plain / a11y.version.standard парой RU/EN
      (RU-тексты существующие не тронуты).
- [x] 8. globals.css: слой DIG-100 в самом конце (белый фон, чёрный текст,
      синие подчёркнутые ссылки, serif ≥20px, линейная колонка, без
      анимаций/теней/градиентов/фонов, media 360px); plain перекрывает
      DIG-44/DIG-86/prefers-reduced-motion.
- [x] 9. Зелёные: новые тесты 31 passed + смежные (a11y-mode — срез контракта
      DIG-86 на свой блок, i18n, landing-page, floating-assistant-popup,
      cabinet-shell), lint/typecheck/build/test (gates green).
