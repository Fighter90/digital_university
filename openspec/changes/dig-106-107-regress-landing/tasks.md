# tasks.md — DIG-106+107

- [x] 1. Red-first: юнит-тест `tests/landing-locale-anonymous.test.ts` —
      анонимный `setLocale` не уводит на /login и пишет cookie (падал на guard'е).
- [x] 2. Фикс `src/server/actions/locale.ts`: убрать owner-scope с setLocale
      (локаль — cookie-предпочтение, whitelist, httpOnly; IDOR невозможен).
- [x] 3. e2e-регресс `e2e/zz-dig-106-107-regress.spec.ts`: секции RU/EN, меню
      (Личный кабинет→/dashboard, Справка→/help, якоря), переключатель языка,
      параллакс-орбы, плавающие карточки, plain-версия (класс/цвета/≥20px/
      без анимаций, футер-ссылка), тумблеры Настроек (large-text/no-effects)
      с проверкой сохранения; скриншоты 1440/360 → `shots/`.
- [x] 4. Минимальный фикс устаревшего e2e-селектора `e2e/landing.spec.ts`
      («Справки с QR» → «Справки с проверкой подлинности», копирайт 67b8bac).
- [x] 5. Дельта-спека `specs/landing-screen/spec.md` (секции + переключатель).
- [x] 6. Отчёт `REGRESSION-FINDINGS-106.md` (дефекты, наблюдения, инферра).
- [x] 7. Гейты (lint/typecheck/unit) зелёные; коммит с `DIG-106/107`; push.
