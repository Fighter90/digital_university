// DIG-30 — скачивание документа мгновенной заявки.
//
// GET /api/requests/[number]/document: только владелец (слой данных
// скоупит по живой сессии), только заявка в READY/ISSUED мгновенного
// типа. «Справка об обучении» — собственный PDF (векторный шрифт,
// enrollment-certificate-pdf.ts), «Выписка оценок» — выписка из
// зачётки (transcript-pdf.ts). Чужой номер, несуществующий, бумажный
// тип или неготовая заявка отвечают ОДИНАКОВЫМ 404 без раскрытия
// причины (контракт DIG-12), попытка чужой — в аудите.
import {
  requireDataCtx,
  getCanonicalRequestByNumber,
  getGradebook,
  getOrCreateDocumentVerification,
  getOwnProfile,
  normalizeRequestNumber,
  decodeRequestNumberParam,
  uniformNotFoundResponse,
  CANONICAL_REQUEST_NUMBER_PATTERN,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  buildEnrollmentCertificatePdf,
  certificateFilename,
} from '@/lib/enrollment-certificate-pdf';
import { buildTranscriptPdf, transcriptFilename, type TranscriptData } from '@/lib/transcript-pdf';

export const dynamic = 'force-dynamic';

/** Мгновенные типы с цифровым документом; остальные — бумажный поток. */
const DOCUMENT_TYPES = new Set(['CERT_ENROLLMENT', 'GRADES_EXTRACT']);

export async function GET(
  httpRequest: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number: rawNumber } = await params;
  // Безопасное декодирование: «сырой» % в сегменте не должен ронять роут
  // с 500 — мусор дальше отсеется проверкой формата и даст единый 404.
  const number = normalizeRequestNumber(decodeRequestNumberParam(rawNumber));
  const ctx = await requireDataCtx(`/api/requests/${rawNumber}/document`);
  // DIG-33 — превью в карточке заявки: ?inline=1 отдаёт тот же PDF с
  // Content-Disposition: inline (по умолчанию — attachment, скачивание).
  const inline = new URL(httpRequest.url).searchParams.get('inline') === '1';

  // Номера мира сидов (SR-…) документов не имеют — тот же единый 404.
  if (!CANONICAL_REQUEST_NUMBER_PATTERN.test(number)) {
    return uniformNotFoundResponse();
  }

  const request = await getCanonicalRequestByNumber(dataDb, ctx, number);
  if (!request) return uniformNotFoundResponse();
  if (request.status !== 'READY' && request.status !== 'ISSUED') {
    return uniformNotFoundResponse();
  }
  if (!DOCUMENT_TYPES.has(request.typeCode) || ctx.role !== 'STUDENT') {
    return uniformNotFoundResponse();
  }

  const now = new Date();

  // DIG-82 — код проверки живёт в реестре справок (один код на заявку):
  // QR на документе ведёт на /verify/<код>, и страница обязана открыть
  // карточку. Код из криптографического ГСЧ (160 бит) — публичный ключ.
  const verification = await getOrCreateDocumentVerification(
    dataDb,
    ctx,
    {
      studentId: request.studentId,
      requestId: request.id,
      documentType: request.typeName,
      purpose: request.params['purpose'] ?? null,
    },
    now,
  );
  if (!verification) return uniformNotFoundResponse();
  const origin = new URL(httpRequest.url).origin;
  const verifyUrl = `${origin}/verify/${verification.verificationCode}`;

  if (request.typeCode === 'CERT_ENROLLMENT') {
    const student = await getOwnProfile(dataDb, ctx);
    if (!student) return uniformNotFoundResponse();

    const pdf = buildEnrollmentCertificatePdf(
      {
        student: {
          fullName: student.fullName,
          groupName: student.groupName,
          course: student.course,
          faculty: student.faculty,
          program: student.program,
          studyForm: student.studyForm,
          gradebookNumber: student.gradebookNumber,
        },
        purpose: request.params['purpose'] ?? 'по месту требования',
      },
      { now, code: verification.verificationCode, requestNumber: request.number, verifyUrl },
    );
    return pdfResponse(pdf, certificateFilename(now), inline);
  }

  // GRADES_EXTRACT — выписка из зачётки (тот же документ, что DIG-27).
  const gradebook = await getGradebook(dataDb, ctx);
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
  const pdf = buildTranscriptPdf(data, {
    now,
    code: verification.verificationCode,
    verifyUrl,
  });
  return pdfResponse(pdf, transcriptFilename(now), inline);
}

function pdfResponse(pdf: Uint8Array, filename: string, inline = false): Response {
  return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
