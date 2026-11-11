// DIG-12 — appeals: cuid-addressed, ownership re-verified on every read.

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { AppealMessageRow, AppealRow, DataCtx } from './types';

const RESOURCE = 'appeal';

export async function listAppeals(db: DataDb, ctx: DataCtx): Promise<AppealRow[]> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listAppealsByStudent(ctx.studentId);
}

/** null for foreign and missing cuids alike; the difference is audit-only. */
export async function getAppeal(
  db: DataDb,
  ctx: DataCtx,
  appealId: string,
): Promise<AppealRow | null> {
  const probed = await db.probeAppealById(appealId);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: appealId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  if (ctx.studentId === null || probed.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: appealId,
      reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
    });
    return null;
  }
  return db.findAppealByStudentAndId(ctx.studentId, appealId);
}

export async function listAppealMessages(
  db: DataDb,
  ctx: DataCtx,
  appealId: string,
): Promise<AppealMessageRow[] | null> {
  const appeal = await getAppeal(db, ctx, appealId);
  if (!appeal) return null;
  return db.listAppealMessages(appealId);
}
