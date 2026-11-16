// DIG-47 — отзыв справки сотрудником деканата.
//
// POST /api/staff/certificates/revoke  { code: string, reason?: string }
//
// Только STAFF и только в пределах своего факультета (revokeCertificateByCode
// проверяет роль и факультет, нарушения пишутся в аудит и отвечают
// единым 404). CSRF закрыт в middleware: POST обязан быть same-origin.
// Повторный отзыв идемпотентен. Отзыв сразу виден на /verify/<код> —
// страница отвечает с no-store.
import { NextResponse } from 'next/server';

import { requireDataCtx, revokeCertificateByCode, uniformNotFoundResponse } from '@/server/data';
import { dataDb } from '@/server/data/db';

export const dynamic = 'force-dynamic';

interface RevokeBody {
  code?: unknown;
  reason?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireDataCtx('/api/staff/certificates/revoke');

  let body: RevokeBody | null = null;
  try {
    body = (await request.json()) as RevokeBody;
  } catch {
    body = null;
  }
  const code = typeof body?.code === 'string' ? body.code : '';
  const reason =
    typeof body?.reason === 'string' && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 200)
      : null;

  const revoked = await revokeCertificateByCode(dataDb, ctx, code, {
    revokedAt: new Date(),
    reason,
  });
  if (!revoked) return uniformNotFoundResponse();

  return NextResponse.json({ status: 'REVOKED' }, { headers: { 'Cache-Control': 'no-store' } });
}
