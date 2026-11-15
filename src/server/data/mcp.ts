// DIG-64 — персональный демо-MCP-токен студента в data-слое.
//
// Контракт (тот же стиль, что requests.ts / profile.ts — каждый вызов несёт
// свой скоуп, staff-ctx отклоняется с ROLE_MISMATCH в аудит):
//  - `rotateOwnMcpToken` — сохраняет ВЫПУЩЕННЫЙ ЗАРАНЕЕ токен: в настройках
//    студента остаётся только SHA-256-хэш + превью + владелец (plaintext
//    живёт ровно один возврат из server action — «показывается один раз»);
//  - `getOwnMcpTokenView` — публичное представление записи (без хэша);
//  - `resolveMcpDemoToken` — lookup токена в ctx владельца (единственный
//    потребитель порт-исключения findStudentByMcpTokenHash, см. port.ts).

import { hashToken } from '@/server/auth/tokens';
import { denyAccess } from './access';
import { getOwnSettings } from './profile';
import type { DataDb } from './port';
import type { DataCtx } from './types';

const RESOURCE = 'profile';

/** Выпущенный токен: plaintext + то, что уходит в хранилище и наружу. */
export interface GeneratedMcpToken {
  token: string;
  tokenHash: string;
  tokenPreview: string;
  createdAt: Date;
}

/** Публичное представление токена (без хэша — его знает только сервер). */
export interface McpTokenView {
  tokenPreview: string;
  createdAt: Date;
}

/** Максимальная длина токена из внешнего ввода (defensive-лимит). */
export const MAX_MCP_TOKEN_LENGTH = 200;

/** staff-ctx не имеет скоупа студента: отказ с ROLE_MISMATCH в аудит. */
async function assertStudentCtx(db: DataDb, ctx: DataCtx): Promise<boolean> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'mcp-token',
      reason: 'ROLE_MISMATCH',
    });
    return false;
  }
  return true;
}

/**
 * Сохраняет выпущенный токен владельца ctx (перевыпуск отзывает прежний:
 * в настройках живёт ровно одна запись mcpToken). Возвращает превью.
 */
export async function rotateOwnMcpToken(
  db: DataDb,
  ctx: DataCtx,
  generated: GeneratedMcpToken,
): Promise<McpTokenView | null> {
  if (!(await assertStudentCtx(db, ctx))) return null;
  const settings = await getOwnSettings(db, ctx);
  if (!settings || ctx.studentId === null) return null;
  await db.saveSettingsByStudent(ctx.studentId, {
    ...settings,
    mcpToken: {
      tokenHash: generated.tokenHash,
      tokenPreview: generated.tokenPreview,
      userId: ctx.userId,
      createdAt: generated.createdAt,
    },
    updatedAt: generated.createdAt,
  });
  return { tokenPreview: generated.tokenPreview, createdAt: generated.createdAt };
}

/** Текущий токен владельца ctx (без хэша) или null, если не выпускался. */
export async function getOwnMcpTokenView(db: DataDb, ctx: DataCtx): Promise<McpTokenView | null> {
  if (!(await assertStudentCtx(db, ctx))) return null;
  const settings = await getOwnSettings(db, ctx);
  if (!settings?.mcpToken) return null;
  return { tokenPreview: settings.mcpToken.tokenPreview, createdAt: settings.mcpToken.createdAt };
}

/**
 * Токен → скоупленный ctx его владельца. Чужой/неверный/мусорный токен —
 * ОДИНАКОВЫЙ null: ответ не становится оракулом существования токенов.
 */
export async function resolveMcpDemoToken(db: DataDb, token: string): Promise<DataCtx | null> {
  // Без trim: токен сравнивается по хэшу дословно (пробел внутри = чужой
  // токен); внешние пробелы заголовка снимает bearerTokenFromHeader.
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_MCP_TOKEN_LENGTH) {
    return null;
  }
  const owner = await db.findStudentByMcpTokenHash(hashToken(token));
  if (!owner) return null;
  return {
    userId: owner.userId,
    login: owner.student.login,
    role: 'STUDENT',
    studentId: owner.student.id,
    groupName: owner.student.groupName,
    faculty: owner.student.faculty,
  };
}
