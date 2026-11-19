# Tasks: EN-локализация часть 2 — guide/help/FAQ + AI-ассистент + MCP (DIG-88)

- [x] 1. Красный-первый: `tests/i18n-en-help-assistant-mcp.test.tsx` — EN-рендер
      страниц /guide, /help (+ статья), /mcp, /ai-assistant (мок getLocale='en')
      без кириллицы; EN-каталоги, движок, RAG, компоненты; RU-байт-в-байт пины.
- [x] 2. Словари `i18n/ru.ts` + `en.ts`: ключи `assistant.*`, `help.*`,
      `guide.*`, `mcp.*`, `callout.*`, `meta.*` (паритет, RU — прежние строки).
- [x] 3. `lib/help-content.ts`: EN-каталог GUIDE_SECTIONS_EN, селекторы
      `guideSections/guideHeading/guideIntro/emptySearch*/guideStepCountLabel`.
- [x] 4. `lib/faq-kb-catalog.ts`: EN-тексты статей, метки категорий, EN-подсказки
      популярного поиска, `faqArticles/getFaqArticleLocalized/
      getRelatedFaqArticlesLocalized`, `searchFaqArticles(query, locale)`,
      EN-стоп-слова в `faqStems` (латинские токены только).
- [x] 5. `lib/faq-catalog.ts`: EN-варианты записей ⌘K-каталога, `faqEntries(locale)`.
- [x] 6. `lib/mcp-docs.ts`: EN-версии секций/шагов/примеров/каталога инструментов,
      плейсхолдер «&lt;YOUR_TOKEN&gt;», `buildMcpConfigSnippet(url, locale)`.
- [x] 7. `lib/assistant-engine.ts`: EN-подсказки, EN-фразы и источники,
      EN-варианты регэкспов намерений, проценты с точкой,
      `buildAssistantReply(q, ctx, locale)`.
- [x] 8. `lib/floating-assistant-knowledge.ts` + `server/ai/floating-assistant.ts` +
      `server/actions/floating-assistant.ts`: EN-чанки/промпт/подписи источников,
      EN-fallback и ошибки, локаль из cookie в action.
- [x] 9. `server/data/assistant.ts`: `getAssistantContext(..., locale)` —
      подписи расписания/плана по локали.
- [x] 10. Компоненты ассистента (`assistant-chat/cards/panel`, floating popup)
      и Shell: пропс locale, словарные подписи.
- [x] 11. Компоненты справки (`help-search`, `help-browser`, `help-feedback`,
      `callout`) и карточка MCP-подключения: пропс locale.
- [x] 12. Страницы: `/guide`, `/help`, `/help/[slug]`, `/mcp`, `/ai-assistant`
      (getLocale + generateMetadata), маршрут `/api/search` и `searchCabinet`.
- [x] 13. Гейты: lint/typecheck/build/test зелёные; юниты 27 поверхностей
      зелёные; фикс теста SLA-фикстуры staff-pages (дата-зависимый, ред-на-базе).
