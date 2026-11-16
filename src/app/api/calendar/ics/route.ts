// DIG-63 — живая ICS-подписка: публичный фид по персональной подписанной
// ссылке (календарные клиенты Google/Apple Calendar ходят БЕЗ cookies,
// поэтому путь открыт в route-guard, а доступ держится на bearer-токене).
//
// Ссылка: /api/calendar/ics?token=v1.<tokenId>.<hmac> — HMAC-подпись
// проверяется в слое данных до обращения к хранилищу; владелец строки
// задаёт скоуп фида (пары группы + контрольные точки сессии). Любой отказ
// (мусор, подделка, отозванная при выходе ссылка) — единый 404 без причины
// (uniform not-found, нет оракула существования). Фид живой: изменения
// расписания деканатом попадают в календарь при следующем обновлении
// подписки клиентом. Персональные данные — no-store, чтобы фид не осел
// в общих кэшах.
import { buildIcsCalendar } from '@/lib/ics';
import { dataDb } from '@/server/data/db';
import { resolveCalendarFeed, uniformNotFoundResponse } from '@/server/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const feed = await resolveCalendarFeed(dataDb, token);
  if (!feed) return uniformNotFoundResponse();

  const ics = buildIcsCalendar(feed.events, { name: feed.name });
  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="calendar.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
