# Tasks: DIG-16 — бренд-ассеты

## 1. Red-first тесты

- [x] 1.1 `tests/brand-assets.test.ts` — инвентарь ассетов (WebP ≤ 80 КБ),
  реестр иллюстраций, иконки/manifest/favicon, OG 1200×630, подключение в
  экраны, docs/ai-log/assets.md + THIRD_PARTY_LICENSES.md + change-папка.
- [x] 1.2 `tests/brand-illustration.test.tsx` — контракт `Illustration`
  (alt="", aria-hidden, draggable, реестр), EmptyState/ErrorState с
  `illustration` и без (обратная совместимость).
- [x] 1.3 Убедиться, что тесты красные (21/21 fail до реализации).

## 2. Генерация ассетов

- [x] 2.1 Проба логотипа в Higgsfield (`z_image`) → `assets-src/`.
- [x] 2.2 6 иллюстраций (Recraft V4.1, палитра DIG-13), исходники в
  `docs/ai-log/assets-src/`, продакшен-WebP ≤ 80 КБ в `public/illustrations/`.
- [x] 2.3 OG 1200×630 + обложка PDF с текстовыми оверлеями (SVG→sharp).
- [x] 2.4 Логотип SVG + иконки 48/180/192/512, удалён дефолтный favicon.ico.

## 3. Код

- [x] 3.1 `src/lib/illustrations.ts` (реестр) + `src/components/ui/illustration.tsx`
  (next/image, alt="", aria-hidden), экспорт из ui/index.ts.
- [x] 3.2 EmptyState/ErrorState: опциональный `illustration`.
- [x] 3.3 Экраны: дашборд, расписание, заявки, уведомления, мастер заказа,
  404, вход (hero + BrandLogo), top-bar (BrandLogo вместо «ЦД»).
- [x] 3.4 `src/app/manifest.ts` + OG/Twitter в layout metadata.

## 4. Документы

- [x] 4.1 `docs/ai-log/assets.md` — инструменты, все промпты, исходники.
- [x] 4.2 `THIRD_PARTY_LICENSES.md` — лицензия сгенерированных изображений.
- [x] 4.3 ai-log записи (2026-11-16-dig-16.md), changelog.

## 5. Проверка

- [x] 5.1 Узкие тесты зелёные; полный vitest без регрессий.
- [x] 5.2 lint + typecheck; e2e login/notifications/requests/schedule не сломаны.
- [x] 5.3 Веса всех картинок ≤ 80 КБ (проверено тестом).
