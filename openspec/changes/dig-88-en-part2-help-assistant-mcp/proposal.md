# Proposal: EN-локализация часть 2 — guide/help/FAQ + AI-ассистент + MCP-страница (DIG-88)

## Зачем

Продолжение волны локализации (DIG-87 перевёл каркас + dashboard + schedule +
requests). Требование приёмки: на локали `en` страницы `/guide`, `/help` (все
статьи, категории, поиск), `/ai-assistant` (попап-чат, карточки действий,
приветствие, fallback) и `/mcp` полностью на английском — НОЛЬ кириллицы в
видимом рендере. RU-версия не должна измениться ни на байт: контент-каталоги
(`help-content`, `faq-kb-catalog`, `faq-catalog`, `mcp-docs`) и фразы движка
ассистента (`assistant-engine`) захардкожены на русском.

## Что

- Контент-каталоги получают EN-параллели с выбором по локали (RU — канон,
  прежние экспорты байт-в-байт): `help-content` (`guideSections/guideHeading/
  guideIntro/emptySearch*`), `faq-kb-catalog` (`faqArticles`, метки категорий,
  `popularQueries`, `searchFaqArticles(query, locale)`), `faq-catalog`
  (`faqEntries(locale)`), `mcp-docs` (`mcpDocsWhatIs/Security/Steps`,
  `mcpExampleQuestions`, `mcpToolCatalog`, плейсхолдер токена
  «&lt;YOUR_TOKEN&gt;» и `buildMcpConfigSnippet(url, locale)`).
- Поиск по базе знаний на EN работает по EN-корпусу: в общий токенизатор
  `faqStems` добавлены EN-стоп-слова (на RU-поиск не влияют — фильтр только
  для латинских токенов).
- Движок ассистента: `assistantHints(locale)`, `buildAssistantReply(q, ctx,
  locale)` — EN-подсказки, EN-фразы всех намерений (включая отказы), EN-имена
  источников; EN-варианты распознавания намерений (tomorrow/exam/order/
  academic leave/foreign data/off-topic) добавлены к RU-регэкспам без change
  RU-поведения. Проценты на EN — с точкой (`formatPercent(v, locale)`).
- Слой данных контекста ассистента (`getAssistantContext(db, ctx, now,
  locale)`) локализует подписи расписания и плана контроля (тот же
  сериализатор, что у экрана расписания).
- RAG плавающего ассистента: `buildKnowledgeChunks(locale)` /
  `retrieveKnowledgeChunks(q, limit, locale)` — EN-чанки и EN-подписи
  источников; системный промпт OpenRouter на EN (`floatingSystemPrompt`);
  серверные видимые строки fallback/ошибок (`answerFloatingQuestion` c
  `locale` в deps) — EN при locale=en. Server action читает cookie.
- Компоненты: `AssistantChat`, `AssistantCardList`/карточки, `ReportWrongAnswer`,
  `AssistantPanel`, `FloatingAssistantPopup`, `HelpSearch`, `HelpBrowser`,
  `HelpFeedback`, `Callout`, `McpConnectCard` — пропс `locale` (дефолт 'ru');
  Shell передаёт локаль панели и попапу. Страницы `/guide`, `/help`,
  `/help/[slug]`, `/mcp`, `/ai-assistant` читают `getLocale()`; метаданные —
  ключи `meta.*`.
- Глобальный поиск ⌘K: `searchCabinet(..., locale)` отдаёт EN-вопросы/ответы
  FAQ-записей при locale=en (маршрут `/api/search` читает cookie).
- Словари `ru.ts`/`en.ts` расширены ключами `assistant.*`, `help.*`,
  `guide.*`, `mcp.*`, `callout.*`, `meta.*` — паритет набора ключей
  (компиляция + юнит-тест), RU-значения байт-в-байт равны прежним строкам.

## Non-goals

- Демо-контент (ФИО, названия дисциплин, новости) остаётся RU по дизайну.
- AiGuide (каркас Shell), голосовой ввод, вкладка настроек «Настройка MCP»
  (/settings?tab=mcp) и прочие поверхности вне четырёх целевых — не в задаче.
- Новых env-переменных и зависимостей нет.

## DoD

- Юнит red-first `tests/i18n-en-help-assistant-mcp.test.tsx`: страницы /guide,
  /help (+ статья), /mcp, /ai-assistant при locale=en (мок getLocale) — без
  кириллицы; EN-каталоги, EN-ответы всех намерений ассистента, EN-чанки RAG,
  EN-рендер клиентских компонентов — без кириллицы; RU-строки байт-в-байт.
- RU-рендер прежний: существующие тесты зелёные без правок контента.
- `node scripts/swarm/gates.mjs` → GATES_SUMMARY: green.
