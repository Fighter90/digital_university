// DIG-64 — rate limit демо-MCP-сервера: перебор персональных токенов по
// эндпоинту /api/mcp должен быть дорогим.
//
// Тот же контракт, что у входа (DIG-11) и проверки справок (DIG-47):
// скользящее окно по ключу (IP из trusted-заголовков, request-ip.ts),
// чистая структура с инъекцией времени; экземпляр приложения в globalThis
// (в dev страницы и API-роуты — разные бандлы).

import {
  createVerifyRateLimiter,
  type RateHitResult,
  type VerifyRateLimiter,
} from '@/server/verify/rate-limit';

/** Окно — 1 минута: MCP-трафик редкий, а перебор длинных токенов бессмыслен. */
export const MCP_RATE_WINDOW_MS = 60 * 1000;
/** Лимит обращений с одного IP за окно. */
export const MCP_RATE_MAX_ATTEMPTS = 30;

export type McpRateHitResult = RateHitResult;
export type McpRateLimiter = VerifyRateLimiter;

/** Чистая фабрика (для тестов — с инъекцией лимита/окна). */
export function createMcpRateLimiter(options?: {
  windowMs?: number;
  maxAttempts?: number;
}): McpRateLimiter {
  return createVerifyRateLimiter({
    windowMs: options?.windowMs ?? MCP_RATE_WINDOW_MS,
    maxAttempts: options?.maxAttempts ?? MCP_RATE_MAX_ATTEMPTS,
  });
}

const globals = globalThis as unknown as { __mcpRateLimiter?: McpRateLimiter };

/** Экземпляр приложения (создаётся один раз на процесс). */
export const mcpRateLimiter: McpRateLimiter = (globals.__mcpRateLimiter ??= createMcpRateLimiter());
