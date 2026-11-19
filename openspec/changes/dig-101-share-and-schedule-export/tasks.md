# DIG-101 — Задачи

## Часть 1 — Поделиться

- [x] Спека delta: specs/share/spec.md (требования + сценарии)
- [x] Юнит-тесты red: src/lib/share-urls.ts (URL шеров, encodeURIComponent),
      компонент ShareButtons (jsdom: hrefs, aria-labels, копирование,
      подтверждение «Ссылка скопирована», фолбэк execCommand)
- [x] Компонент src/components/share/share-buttons.tsx (client)
- [x] Размещение на /help/[slug]
- [x] Размещение на /news/[id] (testid news-share/news-share-status сохранены)
- [x] Размещение в панели «Детали пары» (безопасная ссылка на день
      /schedule?date=…&share=lesson-…)
- [x] Ключи словаря share.* и schedule.share.dayTitle парой RU/EN

## Часть 2 — Экспорт расписания

- [x] Спека delta: specs/schedule-export/spec.md
- [x] Юнит-тесты red: генераторы md/xlsx/pdf (состав, заголовки колонок RU/EN,
      пустой диапазон), резолвер диапазона day/week + имя файла, XLSX-писатель
      (ZIP-структура, CRC32, worksheet XML, экранирование)
- [x] src/lib/schedule-export.ts (модели + сборка MD/XLSX/PDF)
- [x] src/lib/xlsx/xlsx-writer.ts (собственный минимальный OOXML-писатель,
      без новых зависимостей)
- [x] Роуты /api/export/schedule.md|xlsx|pdf: owner-scope, content-type,
      Content-Disposition, private no-store, staff → 404
- [x] Роут-тесты: тип контента, owner-scope (чужая группа не попадает),
      staff → 404
- [x] Блок «Экспорт» на /schedule (day/week; в месяце нет), testid
- [x] Ключи словаря schedule.export.* парой RU/EN

## Гейты

- [x] npx vitest run (узкие) — зелёные
- [x] npm run lint / typecheck / build / test — зелёные
- [x] node scripts/swarm/gates.mjs → GATES_SUMMARY: green
