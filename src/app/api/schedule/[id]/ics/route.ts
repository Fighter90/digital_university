// DIG-24 — «Добавить в календарь»: ICS-файл ОДНОЙ пары из панели деталей.
//
// Скоуп: requireDataCtx → getEventDetails (DIG-21): пара должна относиться
// к группе студента — чужая пара, несуществующий id и сотрудник дают
// ОДИНАКОВЫЙ 404 JSON (uniformNotFoundResponse, тот же контракт, что у
// выписки /api/grades/transcript и ICS сессии /api/session/ics).
// Cache-Control private, no-store — файл персональный.
import { requireDataCtx, getEventDetails, uniformNotFoundResponse } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { buildIcsCalendar } from '@/lib/ics';
import { toEventDetailsView, toEventIcsInput } from '@/lib/event-details';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireDataCtx('/api/schedule/[id]/ics');
  // Чужая пара / мусорный id / сотрудник — единый 404 без раскрытия причины
  // (аудит уже записан слоем данных).
  const details = await getEventDetails(dataDb, ctx, id);
  if (!details) return uniformNotFoundResponse();

  const ics = buildIcsCalendar([toEventIcsInput(toEventDetailsView(details.event))]);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lesson.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
