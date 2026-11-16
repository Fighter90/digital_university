// DIG-64 — демо-MCP-сервер цифрового деканата: POST /api/mcp.
//
// Транспорт — Streamable HTTP по спецификации MCP: POST с JSON-RPC 2.0,
// ответ application/json (SSE-поток демо не ведёт; GET/PUT/DELETE → 405).
//
// Доступ — по персональному демо-току студента (Authorization: Bearer):
// токен выпускается владельцем сессии на вкладке «Настройка MCP», в
// хранилище живёт только SHA-256-хэш. Резолв токена строит скоупленный
// DataCtx владельца — все инструменты читают только его данные (IDOR
// исключён, AGENTS.md). Перебор токенов ограничен rate limit'ом по IP
// (trusted-заголовки, request-ip.ts — как у входа и /verify).

import { dispatchMcpJsonRpc } from '@/lib/mcp-protocol';
import { clientIpFromHeaders } from '@/lib/request-ip';
import { ensureAppData } from '@/server/data/bootstrap';
import { dataDb } from '@/server/data/db';
import { resolveMcpDemoToken } from '@/server/data/mcp';
import { mcpRateLimiter } from '@/server/mcp/rate-limit';
import { bearerTokenFromHeader } from '@/server/mcp/token';
import { runDeaneryTool } from '@/server/mcp/tools';

export const dynamic = 'force-dynamic';

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

const WWW_AUTHENTICATE = 'Bearer realm="digital-deanery-mcp"';

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...headers },
  });

const unauthorized = (invalidToken: boolean) =>
  json(
    {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32001,
        message:
          'Требуется персональный демо-токен: Authorization: Bearer <токен> ' +
          '(выпустите его во вкладке «Настройка MCP» кабинета).',
      },
    },
    401,
    {
      'WWW-Authenticate': invalidToken
        ? `${WWW_AUTHENTICATE}, error="invalid_token"`
        : WWW_AUTHENTICATE,
    },
  );

export async function POST(request: Request): Promise<Response> {
  const headerOf = (name: string) => request.headers.get(name);
  const ip = clientIpFromHeaders(headerOf) ?? 'unknown';
  const limit = mcpRateLimiter.hit(`mcp:${ip}`, new Date());
  if (limit.limited) {
    return json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: 'Слишком много обращений к MCP-серверу. Повторите позже.' },
      },
      429,
      { 'Retry-After': String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))) },
    );
  }

  const token = bearerTokenFromHeader(headerOf('authorization'));
  if (!token) return unauthorized(false);

  await ensureAppData();
  const ctx = await resolveMcpDemoToken(dataDb, token);
  if (!ctx) return unauthorized(true);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = undefined; // → диспетчер ответит parse error -32700
  }

  const result = await dispatchMcpJsonRpc(payload, {
    runTool: (name) => runDeaneryTool(name, dataDb, ctx, new Date()),
  });
  return json(result.body, result.status, result.headers);
}

const methodNotAllowed = (): Response =>
  json({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' });

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function PUT(): Promise<Response> {
  return methodNotAllowed();
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowed();
}

/** CORS-preflight для браузерных MCP-клиентов (ChatGPT/Claude в браузере). */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
      'Access-Control-Max-Age': '600',
    },
  });
}
