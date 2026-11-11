// DIG-12 — schedule and exam sessions: scoped to the ctx student's OWN group.
// A student of group A never receives events of group B, and staff has no
// group scope at all (staff screens get a separate faculty-scoped API).

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx, ExamSessionRow, ScheduleEventRow } from './types';

export async function listSchedule(db: DataDb, ctx: DataCtx): Promise<ScheduleEventRow[]> {
  if (ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: 'schedule',
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listScheduleByGroup(ctx.groupName);
}

export async function listExams(db: DataDb, ctx: DataCtx): Promise<ExamSessionRow[]> {
  if (ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: 'exams',
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listExamsByGroup(ctx.groupName);
}
