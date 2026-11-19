# MCP-сервер цифрового деканата

> Для агентов: подключайтесь к `https://ostrovok.store/api/mcp` (Streamable HTTP, MCP `2025-06-18`),
> чтобы читать расписание, оценки и уведомления конкретного студента — с его согласия и только его данные.
> Выпуск персонального токена: кабинет → **Настройки → «Настройка MCP»**.

## Что это

**MCP-сервер деканата** (Model Context Protocol) — стандартный интерфейс, через который любой
совместимый ИИ-ассистент (Claude, Cursor, Codex и другие) может безопасно обращаться к данным
личного кабинета: расписание на сегодня, последние оценки, непрочитанные уведомления.

Сервер реализует [спецификацию MCP](https://modelcontextprotocol.io/specification/2025-06-18)
по транспорту **Streamable HTTP** (JSON-RPC 2.0: `initialize` → `tools/list` → `tools/call`,
`notifications/initialized`, `ping`).

- Читать можно только **свои** данные: каждый вызов скоуплен владельцем токена (IDOR исключён по построению).
- Токен персональный, хранится только как SHA-256-хэш; перевыпуск в один клик.
- Записей нет — сервер **только для чтения** (read-only by design).

## Endpoint

```
https://ostrovok.store/api/mcp
```

- Транспорт: **Streamable HTTP** (`POST`, JSON-RPC 2.0, ответ `application/json`; SSE-поток не ведётся).
- Аутентификация: `Authorization: Bearer <персональный токен>`.
- Без токена: `401` c JSON-RPC-ошибкой `-32001` и заголовком `WWW-Authenticate: Bearer realm="digital-deanery-mcp"`.
- Ограничение частоты (anti-bruteforce) по IP — как на входе и `/verify`.

## Выпуск токена

1. Войдите в кабинет демо-аккаунтом (`anna.smirnova / anna-demo-2026`).
2. **Настройки → вкладка «Настройка MCP»**.
3. Нажмите «Выпустить токен» — токен показывается один раз (в БД только SHA-256).
4. Скопируйте JSON-конфиг для вашего клиента прямо со страницы (кнопки под каждый клиент).

## Подключение

### Claude Code

```sh
claude mcp add --transport http deanery https://ostrovok.store/api/mcp \
  --header "Authorization: Bearer <ВАШ_ТОКЕН>"
```

Проверка: в сессии Claude Code выполните `/mcp` — сервер должен быть connected.

### Claude Desktop / Cursor / Windsurf (mcp.json)

```json
{
  "mcpServers": {
    "deanery": {
      "url": "https://ostrovok.store/api/mcp",
      "headers": {
        "Authorization": "Bearer <ВАШ_ТОКЕН>"
      }
    }
  }
}
```

### VS Code / Zed / клиенты без Streamable HTTP

Через мост `mcp-remote` (npx):

```json
{
  "mcpServers": {
    "deanery": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://ostrovok.store/api/mcp", "--header", "Authorization: Bearer <ВАШ_ТОКЕН>"]
    }
  }
}
```

### Codex

```sh
codex mcp add deanery --url https://ostrovok.store/api/mcp
```

При первом вызове передайте токен заголовком `Authorization: Bearer <ВАШ_ТОКЕН>`
(конфиг: `~/.codex/config.toml` → `[mcp_servers.deanery] url = "https://ostrovok.store/api/mcp"`).

### Любой другой клиент

- Тип транспорта: **HTTP (Streamable)**, URL: `https://ostrovok.store/api/mcp`
- Заголовки: `Authorization: Bearer <ВАШ_ТОКЕН>`

## Инструменты

Каталог публикуется через `tools/list`; на момент версии 1.0.0 — три инструмента, все read-only:

| Инструмент | Что возвращает |
|---|---|
| `my_schedule_today` | Пары студента на сегодня (МСК): время, дисциплина, тип занятия, аудитория, преподаватель. Переносы и отмены помечены; пустой день — «пар нет». |
| `my_grades` | Последние оценки за элементы контроля: дисциплина, элемент, балл из максимума, вес, дата. До 20 свежих оценок + общий счётчик. |
| `my_unread` | Непрочитанные уведомления: тип, заголовок, выдержка, время — в ленте кабинета. |

Входные аргументы не требуются (`inputSchema` пустой объект) — данные строго персональные.

## Проверка подключения (curl)

Сессия строится по спецификации: `initialize` → `notifications/initialized` → `tools/list` → `tools/call`.

```sh
TOKEN="<ВАШ_ТОКЕН>"; URL=https://ostrovok.store/api/mcp

# 1. initialize — согласовываем версию протокола, получаем serverInfo
curl -s $URL -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","clientInfo":{"name":"curl","version":"1.0"}}}'
# → {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":false}},
#    "serverInfo":{"name":"digital-deanery","title":"MCP-сервер цифрового деканата (демо)","version":"1.0.0"}, ...}}

# 2. notifications/initialized — уведомление без id, ответ 202
curl -s -o /dev/null -w "%{http_code}\n" $URL -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3. tools/list — каталог инструментов
curl -s $URL -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 4. tools/call — расписание на сегодня
curl -s $URL -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"my_schedule_today","arguments":{}}}'

# 5. ping — здоровье
curl -s $URL -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"ping"}'

# Без токена (чужой агент постучался) — 401 + JSON-RPC -32001:
curl -s $URL -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

Живой ответ прода на вызов без токена (проверено 2026-11-19):

```json
{"jsonrpc":"2.0","id":null,"error":{"code":-32001,
 "message":"Требуется персональный демо-токен: Authorization: Bearer <токен> (выпустите его во вкладке «Настройка MCP» кабинета)."}}
```

## Примеры промптов для ассистента

<details>
<summary>«Что у меня сегодня?»</summary>

> Ты ассистент студента. Вызови инструмент `my_schedule_today` MCP-сервера деканата и
> ответь дружелюбной сводкой на 2–3 предложения: что за пары, где и когда, есть ли переносы.
> Если пар нет — так и скажи.
</details>

<details>
<summary>«Как мои дела с учёбой?»</summary>

> Вызови `my_grades` и `my_unread`, затем ответь: среднее по свежим оценкам, что можно подтянуть,
> и есть ли непрочитанные важные уведомления (например, про дедлайны). Не выдумывай данные —
> только то, что вернули инструменты.
</details>

<details>
<summary>Утренний брифинг</summary>

> Каждый день в 8:00 (по расписанию пользователя) вызывай `my_schedule_today` и `my_unread`
> и отправляй краткий утренний брифинг: расписание дня + число непрочитанных уведомлений
> + самые важные из них.
</details>

## Безопасность

- **Owner-scope по построению:** токен резолвится во внутренний контекст владельца; инструменты читают
  данные только через скоупленные функции слоя данных — чужой студент через токен недостижим
  (закреплено тестами `tests/mcp-api.test.ts` — «IDOR»).
- **Токен:** показывается один раз, в БД — только SHA-256. Скомпрометирован? «Отозвать и выпустить новый» в Настройках.
- **Только чтение:** инструменты не изменяют данные.
- **Rate-limit по IP** на `/api/mcp` (защита от перебора токенов).
- **Секреты сервера** — в `.env`, в репозиторий не попадают.

## FAQ

<details>
<summary>Поддерживается ли SSE-транспорт?</summary>
Нет. Реализован основной транспорт спецификации — Streamable HTTP (`POST /api/mcp`).
SSE-фолбэк не ведётся: демо-сервер отвечает обычным JSON на каждый POST.
</details>

<details>
<summary>Какие версии протокола поддержаны?</summary>
`2025-06-18` (по умолчанию) и `2025-03-26`. Версия клиента, которую знает сервер, возвращается как есть;
неизвестная — сервер отвечает своей последней поддержанной (поведение по спецификации MCP).
</details>

<details>
<summary>Токен перестал работать (401)</summary>
Токен мог быть отозван/перевыпущен владельцем — выпустите новый в Настройках → «Настройка MCP»
и обновите заголовок `Authorization` в конфиге клиента. Также проверьте, что не истёк rate-limit
(подождите минуту и повторите).
</details>

<details>
<summary>Ассистент видит данные другого студента?</summary>
Нет. Инструменты скоуплены владельцем токена на уровне слоя данных; это покрыто юнит-тестами IDOR.
Если кажется, что видит — проверьте, чей токен вписан в конфиг клиента.
</details>

<details>
<summary>Где ещё почитать?</summary>
Страница «Подключение ассистента (MCP)» в кабинете (`/mcp`) — интерактивная версия этой документации
с выпуском токена. Статья «Как подключить ассистента» — в справке (`/help`), на RU и EN.
</details>
