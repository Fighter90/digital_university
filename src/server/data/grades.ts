// DIG-12 — grades: list is scoped by the ctx owner; staff has no student scope.

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx, GradeRow } from './types';

const RESOURCE = 'grades';

export async function listGrades(db: DataDb, ctx: DataCtx): Promise<GradeRow[]> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listGradesByStudent(ctx.studentId);
}
