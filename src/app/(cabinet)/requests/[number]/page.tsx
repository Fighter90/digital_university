// DIG-12 — request detail by its PUBLIC number (never a sequential id).
// requireDataCtx() scopes every lookup by the session owner: a foreign
// number and a missing number both land in the same app-wide 404 (no
// existence oracle), and the attempt is audited.
//
// DIG-32 — «Клик по карточке → экран «Карточка заявки»»: маршрут понимает
// ОБА публичных формата. Канонические заявки «ЗД-ГГГГ-NNNNNN» (DIG-30)
// рендерятся со степпером конвейера и действиями студента по машине
// состояний (PDF готового документа, «Исправить и подать повторно»,
// отмена до IN_PROGRESS); legacy-заявки «SR-…» идут прежним потоком
// (контракт e2e изоляции данных data-isolation.spec.ts).
//
// NOTE: do NOT add a loading.tsx above this segment. A Suspense boundary
// makes Next stream the shell and the response leaves with HTTP 200 before
// notFound() can set the status — a foreign page would answer 200 instead of
// the contract-mandated uniform 404 (caught by e2e/data-isolation.spec.ts).
import Link from 'next/link';
import { Download, TriangleAlert } from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  requireDataCtx,
  getRequestByNumber,
  listRequestEvents,
  normalizeRequestNumber,
  decodeRequestNumberParam,
  getOrCreateCertificateForRequest,
  getCanonicalRequestByNumber,
  listCanonicalRequestEvents,
  isValidCanonicalRequestNumber,
  CANONICAL_REQUEST_STATUS_LABELS,
  isTerminalRequestStatus,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import { cancelRequestAction, resubmitRequestAction } from '@/server/actions/requests';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { REQUEST_TYPE_LABELS, formatRequestDate } from '@/lib/request-labels';
import { RequestStepper } from '@/components/requests/request-stepper';
import { RequestTransitionButton } from '@/components/requests/request-transition-button';
import { formatStatusTransition } from '@/lib/request-machine';

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: rawNumber } = await params;
  const number = normalizeRequestNumber(decodeRequestNumberParam(rawNumber));
  const ctx = await requireDataCtx(`/requests/${rawNumber}`);

  if (isValidCanonicalRequestNumber(number)) {
    return renderCanonical(number, ctx);
  }

  const request = await getRequestByNumber(dataDb, ctx, number);
  if (!request) notFound();

  const events = await listRequestEvents(dataDb, ctx, request.id);
  if (!events) notFound();

  // DIG-47 — справка выполненной заявки: реестр (код + QR) и PDF.
  // getOrCreateCertificateForRequest скоупится владельцем: чужая заявка
  // и сотрудник получают null (блок просто не показывается).
  const certificate =
    ctx.role === 'STUDENT'
      ? await getOrCreateCertificateForRequest(dataDb, ctx, request, new Date())
      : null;

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

      {certificate ? (
        <div
          data-testid="certificate-block"
          className="mb-6 rounded-2xl border border-neutral-200 bg-card p-4"
        >
          <p className="text-sm font-bold text-neutral-900">Справка готова</p>
          <p className="mt-1 text-xs text-neutral-600">
            Скачайте PDF или проверьте подлинность по коду — страница проверки открывается без входа
            (для банка, военкомата, работодателя).
          </p>
          <p
            className="mt-2 font-mono text-xs break-all text-neutral-500"
            data-testid="certificate-code"
          >
            {certificate.verificationCode}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/api/requests/${request.number}/certificate`}
              data-testid="certificate-pdf"
              className="rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              Скачать справку (PDF)
            </a>
            <Link
              href={`/verify/${certificate.verificationCode}`}
              target="_blank"
              rel="noreferrer"
              data-testid="certificate-verify"
              className="rounded-button border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              Проверить подлинность
            </Link>
          </div>
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

// ── DIG-32: карточка канонической заявки «ЗД-…» ──────────────────────────────

async function renderCanonical(number: string, ctx: Awaited<ReturnType<typeof requireDataCtx>>) {
  // Чтение owner-scoped: чужой и несуществующий номер → одинаковый 404,
  // попытка чужой — в аудите (контракт canonical-requests, DIG-30).
  const request = await getCanonicalRequestByNumber(dataDb, ctx, number);
  if (!request) notFound();

  const events = await listCanonicalRequestEvents(dataDb, ctx, request.id);
  if (!events) notFound();

  const isFix = request.status === 'NEEDS_FIX';
  const isReady = request.status === 'READY' || request.status === 'ISSUED';
  // Отмена — только до IN_PROGRESS (машина состояний DIG-30).
  const canCancel =
    ctx.role === 'STUDENT' &&
    (request.status === 'SUBMITTED' || request.status === 'ACCEPTED');

  // Последняя причина доработки/отказа — для алерта.
  let reason: string | null = null;
  if (isFix || request.status === 'REJECTED') {
    for (const event of events) {
      const comment = event.comment?.trim() ?? '';
      if (comment) reason = comment;
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/requests"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Все заявки
      </Link>

      <div
        data-testid="canonical-request-card"
        className={`rounded-card border bg-card p-4 shadow-soft sm:p-6 ${
          isFix ? 'border-warning/60 bg-warning-soft/40' : 'border-border'
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{request.number}</span>
          <span
            data-testid="request-status-pill"
            className="inline-block rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
          >
            {CANONICAL_REQUEST_STATUS_LABELS[request.status]}
          </span>
        </div>
        <h1 className="text-xl font-bold sm:text-2xl">{request.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {request.typeName} · подана {formatRequestDate(request.createdAt)}
        </p>

        <div className="mt-5">
          <RequestStepper status={request.status} />
        </div>

        {isFix && reason ? (
          <div
            data-testid="request-fix-alert"
            className="mt-4 flex items-start gap-2 rounded-button border border-warning/50 bg-warning-soft p-3"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-ink" />
            <p className="text-sm font-medium text-warning-ink">Нужна доработка: {reason}</p>
          </div>
        ) : null}
        {request.status === 'REJECTED' && reason ? (
          <div className="mt-4 rounded-button border border-error/40 bg-error-soft p-3">
            <p className="text-sm font-medium text-error-ink">Отклонено: {reason}</p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isReady && ctx.role === 'STUDENT' ? (
            <a
              href={`/api/requests/${encodeURIComponent(request.number)}/document`}
              data-testid="request-document-pdf"
              className="inline-flex items-center gap-1.5 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <Download aria-hidden="true" className="size-4" />
              Скачать PDF
            </a>
          ) : null}
          {isFix && ctx.role === 'STUDENT' ? (
            <RequestTransitionButton
              action={resubmitRequestAction}
              requestId={request.id}
              label="Исправить и подать повторно"
              pendingLabel="Подаём…"
              testid="request-resubmit"
              variant="primary"
            />
          ) : null}
          {canCancel ? (
            <RequestTransitionButton
              action={cancelRequestAction}
              requestId={request.id}
              label="Отменить заявку"
              pendingLabel="Отменяем…"
              confirmText="Отменить заявку? Действие нельзя отменить."
              testid="request-cancel"
            />
          ) : null}
        </div>
      </div>

      <h2 className="mb-3 mt-6 text-base font-semibold">История заявки</h2>
      <ol className="flex flex-col gap-3">
        {events.map((event) => (
          <li
            key={event.id}
            data-testid="request-history-item"
            className="rounded-card border border-border bg-card p-4"
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{event.actorName}</span>
              <span className="text-xs text-muted-foreground">
                {formatRequestDate(event.createdAt)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {event.fromStatus
                ? formatStatusTransition(event.fromStatus, event.toStatus)
                : CANONICAL_REQUEST_STATUS_LABELS[event.toStatus]}
              {!isTerminalRequestStatus(event.toStatus) && event.comment
                ? ` — ${event.comment}`
                : ''}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
