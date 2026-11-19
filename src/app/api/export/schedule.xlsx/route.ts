// DIG-101 — экспорт расписания в XLSX (собственный OOXML-писатель проекта).
// Скоуп/заголовки/кэш — общий обработчик src/server/export/schedule-export.ts.
import { handleScheduleExport } from '@/server/export/schedule-export';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleScheduleExport(request, 'xlsx');
}
