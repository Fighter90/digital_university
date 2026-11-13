import { getAuthSession } from '@/server/auth/session';
import { countUnreadNotifications, listNotifications, toDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  NOTIFICATION_FEED_LIMIT,
  toNotificationFeedItem,
  type NotificationFeedItem,
} from '@/lib/notification-view';

// DIG-35: реальный счётчик непрочитанных и лента для шапки. Обе функции
// fail-soft: без сессии, без строки профиля и у сотрудника — 0/пусто вместо
// падения или редиректа (их вызывает каркас кабинета на каждой странице).
// Скоуп всегда по сессии (запрет IDOR, AGENTS.md); URL-параметров нет.

/** Число непрочитанных уведомлений владельца сессии (колокольчик в шапке). */
export async function getUnreadCount(): Promise<number> {
  const auth = await getAuthSession();
  if (!auth) return 0;
  const ctx = await toDataCtx(auth.user, dataDb);
  if (!ctx || ctx.studentId === null) return 0;
  return countUnreadNotifications(dataDb, ctx);
}

/**
 * Лента для шапки: топ `limit` свежих строк владельца + общий счётчик
 * непрочитанных. Сотруднику лента не запрашивается вовсе (без аудит-шума на
 * каждый page-view) — пустой агрегат.
 */
export async function getNotificationFeed(
  limit: number = NOTIFICATION_FEED_LIMIT,
): Promise<{ count: number; items: NotificationFeedItem[] }> {
  const auth = await getAuthSession();
  if (!auth) return { count: 0, items: [] };
  const ctx = await toDataCtx(auth.user, dataDb);
  if (!ctx || ctx.studentId === null) return { count: 0, items: [] };

  const rows = await listNotifications(dataDb, ctx);
  const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    count: rows.filter((row) => !row.isRead).length,
    items: sorted.slice(0, Math.max(0, limit)).map(toNotificationFeedItem),
  };
}
