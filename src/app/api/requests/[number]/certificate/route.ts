// DIG-47 — PDF справки по заявке владельца.
//
// GET /api/requests/<номер>/certificate — скачивание справки (PDF) по
// СВОЕЙ выполненной заявке типа CERTIFICATE. Скоуп — requireDataCtx →
// getRequestByNumber: чужой и несуществующий номер дают одинаковый 404
// (попытка пишется в аудит слоем). При первом скачивании создаётся
// запись реестра справок (код проверки, QR на /verify/<код>); повторные
// скачивания возвращают ТОТ ЖЕ код — QR остаётся действительным.
// PDF детерминирован и не кэшируется (отзыв меняет страницу проверки).
import {
  getCertificatePdfInput,
  getRequestByNumber,
  normalizeRequestNumber,
  requireDataCtx,
  uniformNotFoundResponse,
  type CertificatePdfInput,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import { buildCertificatePdf, certificateFilename } from '@/lib/certificate-pdf';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
): Promise<Response> {
  const ctx = await requireDataCtx('/api/requests/certificate');
  const { number: rawNumber } = await params;
  const number = normalizeRequestNumber(decodeURIComponent(rawNumber));

  const certificateRequest = await getRequestByNumber(dataDb, ctx, number);
  if (!certificateRequest) return uniformNotFoundResponse();

  const input: CertificatePdfInput | null = await getCertificatePdfInput(
    dataDb,
    ctx,
    certificateRequest,
    new Date(),
  );
  if (!input) return uniformNotFoundResponse();

  // URL страницы проверки для QR. На проде за Caddy origin соответствует
  // публичному хосту (Host header), в dev — localhost:3000.
  const origin = new URL(request.url).origin;
  const verifyUrl = `${origin}/verify/${input.verificationCode}`;
  const pdf = buildCertificatePdf({ ...input, verifyUrl });

  return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${certificateFilename(input.issuedAt)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
