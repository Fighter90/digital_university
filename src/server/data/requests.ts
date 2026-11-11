// DIG-12 — requests: the flagship entity of the isolation contract.
//
// Public key is the request NUMBER (never the id, never sequential), and even
// a correctly guessed number is useless without the owner's session: both a
// foreign and a missing number produce the same null → the caller answers 404.
// The distinction (OWNERSHIP_DENIED vs NOT_FOUND) exists only in the audit log.

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx, RequestEventRow, ServiceRequestRow } from './types';

const RESOURCE = 'request';

/** All requests of the ctx owner (STUDENT); staff gets [] + audited ROLE_MISMATCH. */
export async function listRequests(db: DataDb, ctx: DataCtx): Promise<ServiceRequestRow[]> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listRequestsByStudent(ctx.studentId);
}

/**
 * One request by its public number. Returns null for a foreign AND for a
 * missing number — the only difference is the audit reason. The caller must
 * answer with an identical 404 in both cases.
 */
export async function getRequestByNumber(
  db: DataDb,
  ctx: DataCtx,
  number: string,
): Promise<ServiceRequestRow | null> {
  const probed = await db.probeRequestByNumber(number);
  if (!probed) {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef: number, reason: 'NOT_FOUND' });
    return null;
  }
  if (ctx.studentId === null || probed.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: number,
      reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
    });
    return null;
  }
  return db.findRequestByStudentAndNumber(ctx.studentId, number);
}

/**
 * Timeline of a request addressed by its cuid (detail page data). Ownership is
 * re-verified here — the cuid is never trusted from the URL alone.
 */
export async function listRequestEvents(
  db: DataDb,
  ctx: DataCtx,
  requestId: string,
): Promise<RequestEventRow[] | null> {
  const probed = await db.probeRequestById(requestId);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: requestId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  if (ctx.studentId === null || probed.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: requestId,
      reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
    });
    return null;
  }
  return db.listRequestEvents(requestId);
}
