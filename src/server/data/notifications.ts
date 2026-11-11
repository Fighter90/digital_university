// DIG-12 — notifications: reads and the mark-as-read mutation are both scoped.

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx, NotificationRow } from './types';

const RESOURCE = 'notification';

export async function listNotifications(db: DataDb, ctx: DataCtx): Promise<NotificationRow[]> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listNotificationsByStudent(ctx.studentId);
}

/**
 * Marks a notification as read. Returns false — identically — for a foreign
 * and for a missing id; a foreign id additionally lands in the audit log.
 */
export async function markNotificationRead(db: DataDb, ctx: DataCtx, id: string): Promise<boolean> {
  if (ctx.studentId === null) {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef: id, reason: 'ROLE_MISMATCH' });
    return false;
  }
  const own = await db.markNotificationReadByStudent(ctx.studentId, id);
  if (own) return true;
  const probed = await db.probeNotificationById(id);
  await denyAccess(db, {
    ctx,
    resourceType: RESOURCE,
    resourceRef: id,
    reason: probed ? 'OWNERSHIP_DENIED' : 'NOT_FOUND',
  });
  return false;
}
