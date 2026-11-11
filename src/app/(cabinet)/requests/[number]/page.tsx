// DIG-12 — request detail by its PUBLIC number (never a sequential id).
// requireDataCtx() → getRequestByNumber() scopes the lookup by the session
// owner: a foreign number and a missing number both land in the same
// app-wide 404 (no existence oracle), and the attempt is audited.
//
// NOTE: do NOT add a loading.tsx above this segment. A Suspense boundary
// makes Next stream the shell and the response leaves with HTTP 200 before
// notFound() can set the status — a foreign page would answer 200 instead of
// the contract-mandated uniform 404 (caught by e2e/data-isolation.spec.ts).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  requireDataCtx,
  getRequestByNumber,
  listRequestEvents,
  normalizeRequestNumber,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { REQUEST_TYPE_LABELS, formatRequestDate } from '@/lib/request-labels';

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: rawNumber } = await params;
  const number = normalizeRequestNumber(decodeURIComponent(rawNumber));
  const ctx = await requireDataCtx(`/requests/${rawNumber}`);

  const request = await getRequestByNumber(dataDb, ctx, number);
  if (!request) notFound();

  const events = await listRequestEvents(dataDb, ctx, request.id);
  if (!events) notFound();

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/requests"
        className="mb-4 inline-block text-sm text-neutral-600 hover:text-neutral-900"
      >
        ← Все заявки
      </Link>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-neutral-500">{request.number}</span>
        <RequestStatusBadge status={request.status} />
      </div>
      <h1 className="mb-1 text-xl font-bold sm:text-2xl">{request.title}</h1>
      <p className="mb-6 text-sm text-neutral-600">
        {REQUEST_TYPE_LABELS[request.type]} · подана {formatRequestDate(request.createdAt)}
      </p>

      {request.resultNote ? (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Результат</p>
          <p className="mt-1 text-sm text-green-900">{request.resultNote}</p>
        </div>
      ) : null}

      <h2 className="mb-3 text-base font-semibold">История заявки</h2>
      <ol className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-2xl border border-neutral-200 p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-900">{event.actorName}</span>
              <span className="text-xs text-neutral-500">{formatRequestDate(event.createdAt)}</span>
            </div>
            <p className="text-sm text-neutral-700">{event.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
