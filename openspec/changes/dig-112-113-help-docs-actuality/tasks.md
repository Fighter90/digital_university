# Tasks: DIG-112/113 — полнота справки + актуализация README/wiki/docs

## Справка (DIG-112)

- [x] Red-first: тест `tests/help-coverage.test.ts` — покрытие меню гайдом RU/EN,
      FAQ-статьями с cta, паритет каталогов, EN без кириллицы, словоформы (падает).
- [x] Гайд /guide: +10 разделов RU (dashboard, grades, notifications, news,
      profile, help-faq, staff, staff-requests, staff-appeals,
      staff-announcements) в `src/lib/help-content.ts`.
- [x] Гайд /guide: +10 параллельных EN-разделов с теми же id/шагами/callout.
- [x] FAQ /help: категория `CABINET` (order + метки RU/EN) в `src/lib/faq-kb-catalog.ts`.
- [x] FAQ /help: 18 статей RU с кнопкой-глубинкой в каждый экран меню.
- [x] FAQ /help: 18 EN-текстов в `FAQ_ARTICLES_EN_TEXT` (без кириллицы).
- [x] `tests/faq-catalog.test.ts`: 7 категорий; «стипендии сверху, посторонние —
      только CABINET» (поведение новой статьи cab-finance).
- [x] Словоформы находят новые статьи (уведомлений/зачётка/рейтинг группы/
      стартапом/объявления/мероприятию/notifications/dashboard/gradebook/staff queue).
- [x] Раунд 1 (гейты): «завтра» из ответа cab-ai-assistant убрано — мусорный
      запрос fallback плавающего ассистента снова находит ноль чанков
      (tests/floating-assistant-service.test.ts зелёный).

## Документация (DIG-113)

- [x] README.md: «Дополнительно» — МСП/новости/задачи/гайд, DIG-100 a11y,
      DIG-101 share/export; исправлена устаревшая строка «вход и БД в следующих
      задачах»; в быстрых ссылках добавлена docs/wiki/ + REPORT-112.
- [x] README.en.md: заполнен пустой «Mandatory core» (таблица + beyond the core),
      добавлены DIG-100/DIG-101, wiki-строка ссылается на REPORT-112.
- [x] docs/REPORT-112.md: список устаревшего в docs/wiki/ (GUIDE-SCREENS,
      ARCHITECTURE, SWARM-оговорка; MODULES/RUNBOOK — актуальны) и в
      docs/docx-описание/ (8 пунктов) — без переписывания самих документов.

## Проверки

- [x] `npx vitest run tests/help-coverage.test.ts tests/faq-catalog.test.ts
      tests/help-page.test.tsx tests/help-browser.test.tsx tests/guide-page.test.tsx
      tests/floating-assistant-knowledge.test.ts tests/faq-suggest.test.ts
      tests/i18n-en-help-assistant-mcp.test.tsx tests/i18n.test.tsx` — зелёные.
- [x] Гейты `node scripts/swarm/gates.mjs` — GATES_SUMMARY: green.
- [x] Коммит на ветке `pochtasergeia/dig-112-regress` с DIG-112/113, push, без PR.
