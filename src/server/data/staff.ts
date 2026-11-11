// DIG-12 — staff scope: «сотрудник видит только студентов своего факультета».
// The faculty comes from the Staff row behind the session, never from input.
// Students calling these functions get [] / null + an audited ROLE_MISMATCH.

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx, StudentRow } from './types';

const RESOURCE = 'student';

export async function listFacultyStudents(db: DataDb, ctx: DataCtx): Promise<StudentRow[]> {
  if (ctx.role !== 'STAFF' || ctx.faculty === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listStudentsByFaculty(ctx.faculty);
}

/** null for a student outside the faculty and for a missing id — same answer. */
export async function getFacultyStudent(
  db: DataDb,
  ctx: DataCtx,
  studentId: string,
): Promise<StudentRow | null> {
  if (ctx.role !== 'STAFF' || ctx.faculty === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: studentId,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  const probed = await db.probeStudentById(studentId);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: studentId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  if (probed.faculty !== ctx.faculty) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: studentId,
      reason: 'OUTSIDE_FACULTY',
    });
    return null;
  }
  return probed;
}
