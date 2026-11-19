# Digital Deanery MCP server

> For agents: connect to `https://ostrovok.store/api/mcp` (Streamable HTTP, MCP `2025-06-18`)
> to read a specific student's schedule, grades and notifications — with their consent, and only
> their data. Token issuance: portal → **Settings → “MCP setup”**.

## What it is

The **Deanery MCP server** (Model Context Protocol) is a standard interface that lets any compatible
AI assistant (Claude, Cursor, Codex and others) safely access the student portal data: today's
schedule, recent grades, unread notifications.

The server implements the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18)
over **Streamable HTTP** transport (JSON-RPC 2.0: `initialize` → `tools/list` → `tools/call`,
`notifications/initialized`, `ping`).

- You can only read the **token owner's** data: every call is scoped to the token owner (IDOR is
  impossible by construction).
- Tokens are personal and stored only as a SHA-256 hash; re-issuing takes one click.
- There are no write tools — the server is **read-only by design**.

## Endpoint

```
https://ostrovok.store/api/mcp
```

- Transport: **Streamable HTTP** (`POST`, JSON-RPC 2.0, response `application/json`; no SSE stream).
- Authentication: `Authorization: Bearer <personal token>`.
- Without a token: `401` with JSON-RPC error `-32001` and header `WWW-Authenticate: Bearer realm="digital-deanery-mcp"`.
- IP-based rate limiting (anti-bruteforce) — same as on login and `/verify`.

## Issuing a token

1. Sign in with a demo account (`anna.smirnova / anna-demo-2026`).
2. **Settings → “MCP setup” tab**.
3. Click “Issue token” — the token is shown once (only its SHA-256 hash is stored).
4. Copy the ready JSON config for your client right from the page.

## Connecting

### Claude Code

```sh
claude mcp add --transport http deanery https://ostrovok.store/api/mcp \
  --header "Authorization: Bearer <YOUR_TOKEN>"
```

Verify: run `/mcp` inside a Claude Code session — the server should be connected.

### Claude Desktop / Cursor / Windsurf (mcp.json)

```json
{
  "mcpServers": {
    "deanery": {
      "url": "https://ostrovok.store/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_TOKEN>"
      }
    }
  }
}
```

### VS Code / Zed / clients without Streamable HTTP

Via the `mcp-remote` bridge (npx):

```json
{
  "mcpServers": {
    "deanery": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://ostrovok.store/api/mcp", "--header", "Authorization: Bearer <YOUR_TOKEN>"]
    }
  }
}
```

### Codex

```sh
codex mcp add deanery --url https://ostrovok.store/api/mcp
```

Pass the token as the `Authorization: Bearer <YOUR_TOKEN>` header on first call.

### Any other client

- Transport: **HTTP (Streamable)**, URL: `https://ostrovok.store/api/mcp`
- Headers: `Authorization: Bearer <YOUR_TOKEN>`

## Tools

The catalog is published via `tools/list`; as of version 1.0.0 there are three tools, all read-only:

| Tool | Returns |
|---|---|
| `my_schedule_today` | The student's lessons for today (Moscow time): time, course, class type, room, teacher. Reschedules and cancellations are marked; an empty day says “no classes”. |
| `my_grades` | Recent assessment grades: course, item, score out of maximum, weight, date. Up to 20 latest grades + total counter. |
| `my_unread` | Unread notifications: type, title, excerpt, time — as in the portal feed. |

No input arguments are required (`inputSchema` is an empty object) — the data is strictly personal.

## Connection check (curl)

A session follows the spec: `initialize` → `notifications/initialized` → `tools/list` → `tools/call`.

```sh
TOKEN="<YOUR_TOKEN>"; URL=https://ostrovok.store/api/mcp

# 1. initialize — negotiate protocol version, get serverInfo
curl -s $URL -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","clientInfo":{"name":"curl","version":"1.0"}}}'

# 2. notifications/initialized — notification without id, answers 202
curl -s -o /dev/null -w "%{http_code}\n" $URL -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3. tools/list — the tool catalog
curl -s $URL -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 4. tools/call — today's schedule
curl -s $URL -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"my_schedule_today","arguments":{}}}'

# 5. ping — health
curl -s $URL -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"ping"}'

# Without a token — 401 + JSON-RPC -32001
curl -s $URL -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

Live production response to a tokenless call (verified 2026-11-19):

```json
{"jsonrpc":"2.0","id":null,"error":{"code":-32001,
 "message":"Требуется персональный демо-токен: Authorization: Bearer <токен> (выпустите его во вкладке «Настройка MCP» кабинета)."}}
```

## Example prompts for your assistant

<details>
<summary>“What do I have today?”</summary>

> You are a student's assistant. Call the `my_schedule_today` tool of the deanery MCP server and
> answer with a friendly 2–3 sentence summary: what classes, where and when, any reschedules.
> If there are no classes, say so.
</details>

<details>
<summary>“How am I doing academically?”</summary>

> Call `my_grades` and `my_unread`, then answer: the average of recent grades, what could be improved,
> and whether there are unread important notifications (e.g. deadlines). Never invent data —
> only use what the tools returned.
</details>

<details>
<summary>Morning briefing</summary>

> Every day at 8:00 (the user's local time), call `my_schedule_today` and `my_unread` and send a
> short morning briefing: the day's schedule + the number of unread notifications + the most
> important ones.
</details>

## Security

- **Owner-scope by construction:** a token resolves to the owner's internal context; tools read data
  only through owner-scoped data-layer functions — another student is unreachable via a token
  (covered by `tests/mcp-api.test.ts` — “IDOR”).
- **Token:** shown once, stored as SHA-256 only. Compromised? “Revoke and re-issue” in Settings.
- **Read-only:** no tool mutates data.
- **IP rate limiting** on `/api/mcp` (brute-force protection).
- **Server secrets** live in `.env` and never enter the repository.

## FAQ

<details>
<summary>Is SSE transport supported?</summary>
No. The spec's primary transport is implemented — Streamable HTTP (`POST /api/mcp`).
No SSE fallback: the demo server answers plain JSON to every POST.
</details>

<details>
<summary>Which protocol versions are supported?</summary>
`2025-06-18` (default) and `2025-03-26`. A client version the server knows is returned as is;
an unknown one gets the server's latest supported version (per the MCP spec).
</details>

<details>
<summary>The token stopped working (401)</summary>
The token may have been revoked/re-issued by its owner — issue a new one in Settings → “MCP setup”
and update the `Authorization` header in your client config. Also check the rate limit
(wait a minute and retry).
</details>

<details>
<summary>Can the assistant see another student's data?</summary>
No. Tools are scoped to the token owner at the data layer; this is covered by IDOR unit tests.
If it looks otherwise — check whose token is configured in your client.
</details>

<details>
<summary>Where to read more?</summary>
The “Connect your assistant (MCP)” page in the portal (`/mcp`) is the interactive version of this
documentation with token issuance. The “How to connect your assistant” article is in the Help
section (`/help`), in RU and EN.
</details>
