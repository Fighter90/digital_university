# DIG-99 — tasks

## Спека и данные

- [x] openspec/changes/dig-99-sidebar-mcp-item: proposal.md, tasks.md, delta-спека cabinet-shell

## Red-first (тесты)

- [x] tests/cabinet-shell.test.ts — пункт `/mcp` присутствует в
  `CABINET_SECTIONS` (href + подпись menu.mcp), соседствует с
  AI-ассистентом, активен на `/mcp` (без ложных префиксов), доступен в
  мобильном меню через «Ещё» (`resolveActiveTab('/mcp') === '/more'`);
  тест падал до реализации (RED подтверждён)

## Реализация

- [x] src/components/shell/nav-items.ts — `CABINET_SECTIONS` +=
  `{ href: '/mcp', label: 'Подключить ассистента (MCP)' }` после
  AI-ассистента (иконка Plug и ключи i18n уже существовали с DIG-73)

## Гейты

- [x] vitest (новый + регресс: cabinet-shell, mcp-docs-page, guide-page,
  search-data, search-core, i18n, i18n-en-surfaces, side-nav-deadline)
- [x] lint, typecheck, gates
