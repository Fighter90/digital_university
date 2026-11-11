import { getUnreadCount } from '@/server/notifications';

// DIG-14: источник счётчика непрочитанных для опроса из UnreadBadge.
// Ответ всегда только для текущей сессии (запрет IDOR, AGENTS.md).
export const dynamic = 'force-dynamic';

export async function GET() {
  const count = await getUnreadCount();
  return Response.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
}
