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
