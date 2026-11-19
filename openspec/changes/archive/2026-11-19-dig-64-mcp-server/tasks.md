# DIG-64 — задачи

## Спека

- [x] proposal.md (зачем, что, non-goals)
- [x] delta-спека `specs/mcp/spec.md` (сервер, токен, инструменты)
- [x] delta-спека `specs/settings/spec.md` (карточка «MCP-сервер деканата»)

## Протокол и форматирование (lib, чистые модули)

- [x] `src/lib/mcp-protocol.ts`: JSON-RPC-диспетчер (initialize / tools/list /
      tools/call / ping / notifications → 202), каталог 3 инструментов,
      переговоры protocolVersion, обработка ошибок (-32601/-32602/-32700)
- [x] `src/lib/mcp-format.ts`: форматирование «расписание на сегодня»,
      «оценки», «непрочитанные» (переносы/отмены пар, лимиты, счётчики)

## Данные и доступ (IDOR)

- [x] `StudentSettingsRow.mcpToken` (tokenHash/tokenPreview/createdAt/userId)
      + нормализация легаси-строк (пусто/мусор → null)
- [x] порт `findStudentByMcpTokenHash` (осознанное исключение из owner-scope,
      документировано как `findCertificateByCode`) + реализация в memory-db
- [x] `src/server/data/mcp.ts`: getOwnMcpTokenView / rotateOwnMcpToken
      (staff → ROLE_MISMATCH в аудит) / resolveMcpDemoToken (хэш → ctx)
- [x] `src/server/mcp/token.ts`: генерация `demo-mcp-…` (192 бита энтропии),
      хранится только SHA-256-хэш
- [x] rate limit `src/server/mcp/rate-limit.ts` (скользящее окно по IP,
      контракт как у входа/verify)

## MCP-сервер

- [x] `src/app/api/mcp/route.ts`: POST (Bearer → ctx → JSON-RPC), 401 без/
      с неверным токеном (+ WWW-Authenticate), 429 при rate limit,
      GET/PUT/DELETE → 405, OPTIONS → CORS
- [x] `src/server/mcp/tools.ts`: запуск инструментов на скоупленном data-слое
      (getToday / listGrades / listNotifications)
- [x] route-guard: `/api/mcp` — публичный путь и осознанное исключение из
      CSRF-правила (Bearer-токен вместо cookie → CSRF невозможен, внешние
      MCP-клиенты без Origin); найдено на e2e (middleware отвечал 403)

## Экран `/settings?tab=mcp`

- [x] карточка «MCP-сервер деканата»: URL (из заголовков запроса), состояние
      токена (превью), «Создать токен» / «Перевыпустить», plaintext один раз
- [x] инструкции подключения к ChatGPT и Claude (шаги + JSON-конфиг mcp-remote)
- [x] server action `rotateMcpTokenAction` (requireStudentCtx, staff → fail)

## Тесты (red-first)

- [x] tests/mcp-server.test.ts — протокол, каталог, токен (IDOR/аудит/ротация),
      нормализация, форматирование
- [x] tests/mcp-api.test.ts — POST-роут end-to-end (initialize/tools/call),
      401/405/429, изоляция студентов (токен Анны не видит данные Ильи)
- [x] tests/settings-mcp-page.test.tsx — SSR-контракт карточки сервера
- [x] e2e/mcp-server.spec.ts — создание токена в UI → тестовый вызов
      initialize + tools/call на живом сервере, 401 без токена
