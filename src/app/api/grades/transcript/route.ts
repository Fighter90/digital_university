// DIG-27 — мгновенная выписка из зачётной книжки (PDF).
//
// Приёмка: «Выписка PDF скачивается без заявки и очереди» — документ
// собирается на лету по скоупу живой сессии (requireDataCtx → getGradebook);
// ни заявок, ни очереди. Сотруднику — единый 404 JSON (тот же контракт, что
// у /api/requests/[number]), аноним недопускается middleware'ем. Документ
// детерминирован при равных входах (код проверки — свежий случайный на
// каждую выдачу, 160 бит — формат кода проверки DIG-47).
import {
  requireDataCtx,
  getGradebook,
  uniformNotFoundResponse,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  buildTranscriptPdf,
  newVerificationCode,
  transcriptFilename,
  type TranscriptData,
} from '@/lib/transcript-pdf';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireDataCtx('/api/grades/transcript');

  const gradebook = await getGradebook(dataDb, ctx);
  // Сотрудник: пустой агрегат (ROLE_MISMATCH, аудит уже записан слоем) —
  // отвечаем единым 404 без раскрытия причины. Студент без оценок получает
  // пустую выписку (без заявки и очереди — как и с оценками).
  if (ctx.role !== 'STUDENT') {
    return uniformNotFoundResponse();
  }

  const now = new Date();
  const data: TranscriptData = {
    student: gradebook.student,
    semesters: gradebook.semesters.map((semester) => ({
      label: semester.label,
      average: semester.average,
      creditsEarned: semester.creditsEarned,
      creditsTotal: semester.creditsTotal,
      disciplines: semester.disciplines.map((discipline) => ({
        name: discipline.disciplineName,
        controlType: discipline.controlTypeLabel,
        credits: discipline.credits,
        grade: discipline.finalGrade,
        completedAt: discipline.completedAt,
      })),
    })),
    overallAverage: gradebook.overallAverage,
    creditsEarned: gradebook.creditsEarned,
    creditsRequired: gradebook.creditsRequired,
  };

  const pdf = buildTranscriptPdf(data, { now, code: newVerificationCode() });

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${transcriptFilename(now)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
