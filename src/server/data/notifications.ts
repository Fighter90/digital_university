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

/**
 * DIG-35 — число непрочитанных владельца сессии. У сотрудника персональной
 * ленты нет: 0 без записи в аудит — счётчик запрашивается шапкой на КАЖДОЙ
 * странице, аудита «staff смотрит свой же колокольчик» быть не должно.
 */
export async function countUnreadNotifications(db: DataDb, ctx: DataCtx): Promise<number> {
  if (ctx.studentId === null) return 0;
  return db.countUnreadNotificationsByStudent(ctx.studentId);
}

/**
 * DIG-35 — «Отметить все прочитанными» (owner-scoped). Сотруднику — отказ с
 * аудитом ROLE_MISMATCH, как у прочих student-мутаций; возвращает число
 * изменённых строк.
 */
export async function markAllNotificationsRead(db: DataDb, ctx: DataCtx): Promise<number> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'mark-all-read',
      reason: 'ROLE_MISMATCH',
    });
    return 0;
  }
  return db.markAllNotificationsReadByStudent(ctx.studentId);
}
