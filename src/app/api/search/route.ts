// DIG-45 — поисковый API командной палитры. Ответ строится ТОЛЬКО из
// контекста сессии (requireDataCtx): аноним уходит на /login redirect'ом,
// чужие данные недостижимы по построению (IDOR-правило, AGENTS.md).
// no-store: выдача персональная — кешировать запрещено.
import { requireDataCtx, searchCabinet } from '@/server/data';
import { dataDb } from '@/server/data/db';

export const dynamic = 'force-dynamic';

const MAX_QUERY_LENGTH = 80;

export async function GET(request: Request) {
  const rawQuery = (new URL(request.url).searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);
  const ctx = await requireDataCtx('/api/search');

  const started = performance.now();
  const result = await searchCabinet(dataDb, ctx, rawQuery);
  const tookMs = Math.round(performance.now() - started);

  return Response.json({ ...result, tookMs }, { headers: { 'Cache-Control': 'no-store' } });
}
