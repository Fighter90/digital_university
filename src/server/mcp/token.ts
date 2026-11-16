// DIG-64 — выпуск персонального демо-MCP-токена и разбор заголовка
// Authorization.
//
// Токен — вымышленный по конвенции прототипа (префикс `demo-`) и при этом
// криптостойкий: 24 случайных байта (192 бита энтропии), как у сессий
// DIG-11. В хранилище попадает только SHA-256-хэш (hashToken из auth —
// тот же примитив, что у cookie-сессий); plaintext показывается владельцу
// ровно один раз после выпуска.

import { randomBytes } from 'node:crypto';
import { hashToken } from '@/server/auth/tokens';

/** Максимальная длина значения Authorization (defensive-лимит). */
const MAX_BEARER_LENGTH = 300;

export interface GeneratedMcpToken {
  token: string;
  tokenHash: string;
  tokenPreview: string;
  createdAt: Date;
}

/** Новый демо-токен: `demo-mcp-<43 символа base64url>`. */
export function generateMcpDemoToken(now: Date = new Date()): GeneratedMcpToken {
  const token = `demo-mcp-${randomBytes(24).toString('base64url')}`;
  return {
    token,
    tokenHash: hashToken(token),
    // Превью для вкладки настроек: префикс + последние 4 символа.
    tokenPreview: `${token.slice(0, 8)}…${token.slice(-4)}`,
    createdAt: now,
  };
}

/**
 * `Authorization: Bearer <token>` → token (внешние пробелы снимаются).
 * Не-Bearer схемы, отсутствие заголовка и переполнение — null.
 */
export function bearerTokenFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1]?.trim() ?? '';
  if (token.length === 0 || token.length > MAX_BEARER_LENGTH) return null;
  return token;
}
