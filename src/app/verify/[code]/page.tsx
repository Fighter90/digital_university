// DIG-47 — публичная страница проверки подлинности справки /verify/<код>.
//
// Работает БЕЗ входа (префикс /verify/ — публичный в route-guard):
// ключ — код проверки (160 бит base32), перебор ограничен rate limit'ом
// по IP. Данные — только из verifyCertificateByCode(): публичное
// представление без studentId и полного имени. Ответ никогда не кэшируется
// (отзыв сотрудником обязан быть виден сразу).
import { headers } from 'next/headers';

import { VerifyResultView } from '@/components/verify/verify-result';
import { clientIpFromHeaders } from '@/lib/request-ip';
import { ensureAppData, verifyCertificateByCode } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { verifyRateLimiter } from '@/server/verify/rate-limit';

export const dynamic = 'force-dynamic';

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const decoded = (() => {
    try {
      return decodeURIComponent(rawCode);
    } catch {
      return rawCode;
    }
  })();

  const headerList = await headers();
  const ip = clientIpFromHeaders((name) => headerList.get(name));
  const limited = verifyRateLimiter.hit(`verify:${ip ?? 'unknown'}`, new Date());

  if (limited.limited) {
    return <VerifyResultView state="RATE_LIMITED" />;
  }

  // Публичная страница: данные демо-набора должны быть засеяны и для
  // анонима (requireDataCtx тут не вызывается — он делает redirect на /login).
  await ensureAppData();
  const view = await verifyCertificateByCode(dataDb, decoded, new Date());

  return (
    <VerifyResultView
      state={view.status}
      documentType={view.documentType}
      issuedAt={view.issuedAt}
      holderName={view.holderName}
    />
  );
}
