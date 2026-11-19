# DIG-73 — tasks

## Спека и данные

- [x] openspec/changes/dig-73-mcp-docs-page: proposal.md, tasks.md, delta-спека mcp-docs

## Red-first (тесты)

- [x] tests/mcp-docs-page.test.tsx — рендер /mcp: секции «Что это / Что доступно / Как подключить / Безопасность», JSON-сниппет с плейсхолдером токена (без реальных ключей), кнопка «Скопировать конфиг», примеры вопросов, пункт меню в «Ещё», иконка /mcp, i18n-паритет menu/title, раздел /guide и FAQ-статья
- [x] tests/cabinet-shell.test.ts — пин списка «Ещё» дополнен /mcp

## Реализация

- [x] src/lib/mcp-docs.ts — чистый модуль: разделы страницы, плейсхолдер токена, buildMcpConfigSnippet, примеры вопросов
- [x] src/components/mcp/mcp-connect-card.tsx — client-карточка подключения: превью токена/«создать в настройках», сниппет, «Скопировать конфиг»
- [x] src/app/(cabinet)/mcp/page.tsx — GET-only страница /mcp (студент и сотрудник)
- [x] src/components/shell/nav-items.ts — MORE_SECTIONS += /mcp «Подключить ассистента (MCP)»
- [x] src/components/shell/nav-icons.tsx — иконка Plug для /mcp
- [x] src/lib/i18n/{ru,en}.ts + index.ts — ключи menu.mcp/title.mcp, маппинги
- [x] src/lib/help-content.ts — раздел /guide «Подключить внешнего AI-ассистента (MCP)»
- [x] src/lib/faq-kb-catalog.ts — FAQ-статья про MCP (IT, CTA на /mcp)

## e2e

- [x] e2e/mcp-docs.spec.ts — mobile 360: «Ещё» → /mcp (заголовки, сниппет, токен-маска); desktop 1440: сотрудник открывает /mcp. ВНИМАНИЕ: у кабинета per-IP лимит входа (30/15 мин, DIG-11), все e2e — с одного IP; спек расходует всего 2 логина, но комбинированные прогоны с cabinet-shell + help (≈29 логинов без нас) сидят на грани лимита — известное свойство набора, вне скоупа задачи

## Гейты

- [x] vitest (новые + регресс), lint, typecheck, gates
- [x] e2e mcp-docs — зелёные (изолированно и с MCP-спеками)
