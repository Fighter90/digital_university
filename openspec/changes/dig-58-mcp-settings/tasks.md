# DIG-58 — задачи

## Спека и модель

- [x] delta-спека `specs/settings/spec.md` (вкладка «Настройка MCP»,
      статусы, справка)
- [x] каталог демо MCP-серверов `src/lib/mcp-servers.ts`: id/имя/что даёт,
      демо-токен, deep-ссылка, шаги установки, частые ошибки; хелперы
      `normalizeMcpConnections` / `setMcpConnected` / `isMcpServerId`
- [x] `StudentSettingsRow.mcpConnections` + нормализация старых строк

## Данные и доступ (IDOR)

- [x] `updateOwnMcpConnection` (data-слой): только STUDENT-ctx, whitelist id,
      ROLE_MISMATCH в аудит
- [x] server action `setMcpServerConnectionAction` (валидирует аргументы)

## Экран `/settings?tab=mcp`

- [x] вкладка «Настройка MCP» в `settings-tabs` (ссылка, aria-current)
- [x] список серверов: имя, статус, «Подключить» с инструкцией
      (deep-ссылка + демо-токен, копирование), «Отключить»
- [x] карточки-примеры: Product Hunt (тренды), Календарь, Деканат-API
- [x] справка: как работает MCP, безопасность токенов, пошаговая
      установка, частые ошибки; пометка «демо, реальных ключей нет»

## Тесты (red-first)

- [x] tests/settings-mcp.test.ts — каталог, normalize/toggle хелперы,
      mutator (персистентность + IDOR + unknown id)
- [x] tests/settings-mcp-page.test.tsx — SSR-контракт вкладки (статусы,
      кнопки, карточки, справка)
- [x] e2e/settings-mcp.spec.ts — пункт «Настройка MCP» виден, страница
      открывается, подключение сохраняется в демо-хранилище (reload)
