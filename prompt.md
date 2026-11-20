DIG-112+113: Справка «максимальная полнота» (гайд по каждому экрану) + актуализация README/wiki/docs. Работай только в /tmp/dig-112.
1. Справка /help (src/lib/help-content.ts, faq-kb-catalog.ts): пройди ВСЕ экраны кабинета (dashboard, schedule, grades, requests, notifications, deanery, feedback, events, msp, dpo, people, news, finance, profile, settings, tasks, ai-assistant, mcp, staff*) — у каждого должна быть статья: как пользоваться, частые вопросы. Дополни недостающие статьи RU+EN (паттерн DIG-88: двуязычные поля). Поиск по словоформам должен находить новые статьи.
2. README.md/README.en.md: проверь актуальность (кол-во разделов, ссылки на docs/mcp.md, DIG-100 a11y, share/export — упоминались ли); обнови устаревшее.
3. docs/wiki/ и docs/docx-описание: пометь в REPORT-112.md что устарело (не переписывай всё — список).
4. Юнит-тест: справка содержит статью для каждого раздела меню; RU/EN паритет статей.
5. DoD: gates green; коммит на pochtasergeia/dig-112-regress с DIG-112/113, push. НЕ PR.
