// DIG-31 — мгновенная справка из мастера заказа: PDF по публичному номеру.
//
// IDOR-контракт (как у /api/requests/[number] и выписки DIG-27): запрос
// скоупится живой сессией (requireDataCtx → getRequestByNumber); чужой
// номер и несуществующий отвечают ОДИНАКОВО — единый 404 без оракула
// существования, попытка записана в AuditLog. PDF отдаётся только у
// ВЫПОЛНЕННОЙ заявки (мгновенные из мастера рождается COMPLETED);
// заявка в работе документа ещё не имеет — тот же единый 404.
import {
  requireDataCtx,
  getRequestByNumber,
  normalizeRequestNumber,
  uniformNotFoundResponse,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import { buildCertificatePdf, certificateFilename } from '@/lib/certificate-pdf';
import { newVerificationCode } from '@/lib/transcript-pdf';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number: rawNumber } = await params;
  const number = normalizeRequestNumber(decodeURIComponent(rawNumber));
  const ctx = await requireDataCtx('/api/requests/[number]/pdf');

  const request = await getRequestByNumber(dataDb, ctx, number);
  if (!request || request.status !== 'COMPLETED') {
    return uniformNotFoundResponse();
  }

  const student = ctx.studentId === null ? null : await dataDb.findStudentById(ctx.studentId);
  const now = new Date();
  const pdf = buildCertificatePdf({
    title: request.title,
    number: request.number,
    issuedAt: now,
    code: newVerificationCode(),
    student: student
      ? {
          fullName: student.fullName,
          groupName: student.groupName,
          course: student.course,
          program: student.program,
          gradebookNumber: student.gradebookNumber,
        }
      : null,
  });

  return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${certificateFilename(request.number)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
