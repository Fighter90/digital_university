// DIG-46 — контекст чата ассистента для плавающей панели на любых экранах.
// Ответ — только данные владельца сессии (requireDataCtx → скоуп слоя
// данных); anonymous → redirect /login. no-store: контекст зависит от
// «сегодня» и живых данных кабинета.
import { getAssistantContext, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireDataCtx('/ai-assistant');
  const context = await getAssistantContext(dataDb, ctx);
  return Response.json(context, { headers: { 'Cache-Control': 'no-store' } });
}
