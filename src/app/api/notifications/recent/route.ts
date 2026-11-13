import { listNotifications, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { toNotificationFeedItem } from '@/lib/notification-view';

// DIG-35 — лента для панели колокольчика и опроса экрана «Уведомления».
// Скоуп: requireDataCtx → только строки владельца сессии (запрет IDOR).
// Сотруднику — пустой агрегат БЕЗ обращения к listNotifications: шапка
// опрашивает этот эндпоинт на каждой странице, аудит-шума быть не должно.
// Аноним недопускается middleware'ем (редирект на /login).

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const ctx = await requireDataCtx('/api/notifications/recent');

  const rawLimit = Number(new URL(request.url).searchParams.get('limit') ?? '');
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  if (ctx.studentId === null) {
    return Response.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const rows = await listNotifications(dataDb, ctx);
  const items = [...rows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map(toNotificationFeedItem);

  return Response.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
