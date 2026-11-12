// DIG-28 — «Добавить всю сессию в календарь»: ICS-файл с контрольными
// и консультациями группы студента.
//
// Скоуп: requireDataCtx → getSession (контрольные/консультации по
// ctx.groupName). Сотруднику — единый 404 JSON (тот же контракт, что у
// выписки /api/grades/transcript), аноним недопускается middleware'ем.
// Файл детерминирован при равных входах (DTSTAMP — момент выдачи).
import { requireDataCtx, getSession, uniformNotFoundResponse } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { buildIcsCalendar, type IcsEventInput } from '@/lib/ics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireDataCtx('/api/session/ics');
  // Сотрудник: пустой агрегат (ROLE_MISMATCH, аудит уже записан слоем) —
  // единый 404 без раскрытия причины.
  if (ctx.role !== 'STUDENT') {
    return uniformNotFoundResponse();
  }

  const session = await getSession(dataDb, ctx);
  const calendarName =
    session.rangeLabel !== null ? `${session.seasonTitle} · ${ctx.groupName}` : session.seasonTitle;

  const events: IcsEventInput[] = [
    ...session.exams.map((exam) => ({
      uid: `exam-${exam.examId}@digital-deanery`,
      title: `${exam.kindLabel}: ${exam.disciplineName}`,
      startsAt: exam.startsAt,
      endsAt: new Date(exam.startsAt.getTime() + 90 * 60_000),
      location: `каб. ${exam.room}`,
      description: [
        exam.teacherName ? `Преподаватель: ${exam.teacherName}` : null,
        exam.admissionReason ?? exam.statusLabel,
      ]
        .filter(Boolean)
        .join('. '),
    })),
    ...session.consultations.map((consult) => ({
      uid: `consult-${consult.eventId}@digital-deanery`,
      title: `Консультация: ${consult.disciplineName}`,
      startsAt: consult.startsAt,
      endsAt: consult.endsAt,
      location: `каб. ${consult.room}`,
      description: `Преподаватель: ${consult.teacherName}`,
    })),
  ];

  const ics = buildIcsCalendar(events, { name: calendarName });

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="session.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
