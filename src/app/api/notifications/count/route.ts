import { getUnreadCount } from '@/server/notifications';

// DIG-14: источник счётчика непрочитанных для опроса из UnreadBadge.
// DIG-35: значение стало реальным — число непрочитанных владельца сессии
// (fail-soft: без профиля/у сотрудника 0). Ответ всегда только для текущей
// сессии (запрет IDOR, AGENTS.md); аноним недопускается middleware'ем.
export const dynamic = 'force-dynamic';

export async function GET() {
  const count = await getUnreadCount();
  return Response.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
}
