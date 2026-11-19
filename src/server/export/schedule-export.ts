// DIG-101 — общий обработчик роутов экспорта расписания
// (/api/export/schedule.md|xlsx|pdf). Скоуп: живая сессия requireDataCtx →
// getSchedule (пары только своей группы; IDOR невозможен по построению,
// скоуп-параметров в URL нет — только view/date). Сотруднику (нет группы) —
// единый 404 JSON (uniform not-found, без причины). Ответы персональные —
// private, no-store; имена файлов ASCII (Content-Disposition).
import { dataDb } from '@/server/data/db';
import { getSchedule, requireDataCtx, uniformNotFoundResponse } from '@/server/data';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import {
  buildScheduleExportDays,
  buildScheduleMarkdown,
  buildSchedulePdf,
  buildScheduleXlsx,
  resolveScheduleExportRange,
  scheduleExportFilename,
  scheduleExportRangeLabel,
} from '@/lib/schedule-export';

export type ScheduleExportFormat = 'md' | 'xlsx' | 'pdf';

const CONTENT_TYPES: Record<ScheduleExportFormat, string> = {
  md: 'text/markdown; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/** Разобрать ?view=day|week&date=YYYY-MM-DD из запроса (мусор → дефолты). */
function parseExportQuery(request: Request): { view?: string; date?: string } {
  const params = new URL(request.url).searchParams;
  return { view: params.get('view') ?? undefined, date: params.get('date') ?? undefined };
}

/**
 * GET /api/export/schedule.<ext>: собрать файл по живой сессии.
 * Студент без пар в диапазоне получает документ с заголовком и «Пар нет»;
 * сотрудник — единый 404; аноним отсеян middleware'ом, а на случай прямого
 * вызова requireDataCtx сам делает redirect на /login.
 */
export async function handleScheduleExport(
  request: Request,
  format: ScheduleExportFormat,
): Promise<Response> {
  const ctx = await requireDataCtx(`/api/export/schedule.${format}`);
  if (ctx.role !== 'STUDENT') {
    return uniformNotFoundResponse();
  }
  const locale = await getLocale();
  const { view, date } = parseExportQuery(request);
  const range = resolveScheduleExportRange(view, date, new Date());
  const rows = await getSchedule(dataDb, ctx, { from: range.from, to: range.to });
  const days = buildScheduleExportDays(rows, locale);
  const docOptions = { locale, rangeLabel: scheduleExportRangeLabel(range, locale) };
  const filename = scheduleExportFilename(range.dateKey, range.view, format);

  const headers = new Headers({
    'Content-Type': CONTENT_TYPES[format],
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  });

  if (format === 'md') {
    return new Response(buildScheduleMarkdown(days, docOptions), { status: 200, headers });
  }
  const bytes =
    format === 'xlsx'
      ? buildScheduleXlsx(days, { ...docOptions, sheetName: t(locale, 'schedule.export.docTitle') })
      : buildSchedulePdf(days, docOptions);
  return new Response(new Blob([new Uint8Array(bytes)], { type: CONTENT_TYPES[format] }), {
    status: 200,
    headers,
  });
}
