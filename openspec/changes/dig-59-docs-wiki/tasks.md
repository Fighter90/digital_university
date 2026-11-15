# DIG-59 — задачи

## Спека

- [x] delta-спека `specs/docs/spec.md` (документация wiki, ссылки из кабинета)

## Документы

- [x] `docs/help.md` — справка студента (вход, расписание, оценки, заявки,
      уведомления, справки с QR; пометки «в разработке» где раздел-заглушка)
- [x] `docs/assistant.md` — цифровой ассистент (возможности, примеры
      запросов, ограничения, MCP: Product Hunt, Календарь, Деканат-API)
- [x] `docs/architecture.md` — раздел «Безопасность» + перекрёстные ссылки
- [x] README: скриншоты (1440/360) + быстрые ссылки на документацию

## Перекрёстные ссылки из кабинета

- [x] `src/lib/docs-links.ts` — единый источник ссылок (GitHub blob/main)
- [x] `/settings?tab=home` — карточка «Справка и документация» (3 ссылки)
- [x] `/settings?tab=mcp` — ссылка на docs/assistant.md в справке MCP
- [x] `/ai-assistant` — ссылка на справку ассистента

## Тесты (red-first)

- [x] tests/docs-links.test.ts — ссылки покрывают help/assistant/architecture,
      файлы существуют на диске, README ссылается на help.md и assistant.md
- [x] tests/settings-page.test.tsx — карточка документации на «Главной»,
      ссылка на ассистента на вкладке MCP
- [x] tests/ai-assistant-page.test.tsx — страница AI-ассистента ведёт на
      docs/assistant.md

## Проверки

- [x] vitest: 64 файла / 965 тестов зелёные; node --test (swarm): 36 зелёных
- [x] gates: lint=pass typecheck=pass build=pass test=pass (GATES_SUMMARY: green)

## Раунд 2 — замечания ревью (факты docs vs код)

- [x] tests/docs-facts.test.ts — red-first: документация не расходится с
      кодом (хэши, пути слоёв, формат номера, подписи UI)
- [x] README: «NextAuth (bcrypt)» → собственные cookie-сессии на argon2id
      (3 места: стек, тестовые аккаунты, безопасность)
- [x] docs/architecture.md: реальные пути слоёв — `(cabinet)` вместо `(app)`,
      `src/server/auth/`, `src/server/data/` (in-memory демо-стора),
      токены в `src/app/globals.css`; ER и «ручные фрагменты»: номер заявки
      `SR-<год>-<5 случайных>` из `src/server/data/request-number.ts`
      (ЗД-фрагмент миграции — legacy канона DIG-9), FTS готов к Prisma-сторе,
      сейчас поиск в памяти; продление сессии описано точно
- [x] docs/help.md: категории каталога с «Помощь» (CATEGORY_LABELS), бейдж
      «перенос»/«отменена» как в UI, матрица уведомлений без «Системы»
      (NOTIFICATION_SETTING_TYPES), профиль: «студенческий билет»
      (замаскирован), «учебный год», кнопка «Нашли ошибку в данных?»
      (data-error-report.tsx)
- [x] docs/assistant.md: хэндофф из поиска ⌘K (FAQ — внутри выдачи поиска),
      контекст `?q=`/`?intent=` передают ссылки, диалог подхватит в DIG-46
- [x] gates повторно: зелёные (см. финальный запуск в раунде 2)
