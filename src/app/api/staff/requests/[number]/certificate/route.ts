// DIG-48 — PDF выполненной справки по запросу СОТРУДНИКА факультета.
//
// GET /api/staff/requests/<номер>/certificate — то же, что студенческий
// эндпоинт DIG-47, но скоуп — факультет сотрудника: заявка должна
// принадлежать студенту его факультета, быть CERTIFICATE и COMPLETED.
// Чужой/несуществующий номер и неготовая заявка — единый 404 (попытки
// пишутся в аудит слоем). Повторное формирование отдаёт ТОТ ЖЕ код
// проверки — QR остаётся действительным. CSRF закрыт в middleware.
import {
  getStaffCertificatePdfInput,
  getStaffRequestDetail,
  normalizeRequestNumber,
  requireDataCtx,
  uniformNotFoundResponse,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import { buildCertificatePdf, certificateFilename } from '@/lib/certificate-pdf';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
): Promise<Response> {
  const ctx = await requireDataCtx('/api/staff/requests/certificate');
  const { number: rawNumber } = await params;
  const number = normalizeRequestNumber(decodeURIComponent(rawNumber));

  const detail = await getStaffRequestDetail(dataDb, ctx, number);
  if (!detail) return uniformNotFoundResponse();

  const input = await getStaffCertificatePdfInput(dataDb, ctx, detail.request, new Date());
  if (!input) return uniformNotFoundResponse();

  // URL страницы проверки для QR (origin как у студенческого эндпоинта).
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
