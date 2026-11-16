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
// DIG-33 — карточка по Figma «06 · Заявки — карточка»: шапка с номером
// (копируется), ожидаемой датой и «Ведёт», форма исправления доработки,
// блок готового документа (превью / скачать / проверить / email),
// параметры и вложения, вертикальный таймлайн истории с временем в
// единой зоне «МСК», «Задать вопрос по заявке».
//
// NOTE: do NOT add a loading.tsx above this segment. A Suspense boundary
// makes Next stream the shell and the response leaves with HTTP 200 before
// notFound() can set the status — a foreign page would answer 200 instead of
// the contract-mandated uniform 404 (caught by e2e/data-isolation.spec.ts).
import Link from 'next/link';
import { Download, ShieldCheck, TriangleAlert } from 'lucide-react';
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
  listCanonicalRequestTypes,
  isValidCanonicalRequestNumber,
  CANONICAL_REQUEST_STATUS_LABELS,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  cancelRequestAction,
  createRequestQuestionAction,
  resubmitRequestAction,
  sendRequestDocumentByEmailAction,
} from '@/server/actions/requests';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { REQUEST_TYPE_LABELS, formatRequestDate } from '@/lib/request-labels';
import { RequestStepper } from '@/components/requests/request-stepper';
import { RequestTransitionButton } from '@/components/requests/request-transition-button';
import { CopyRequestNumber } from '@/components/requests/copy-request-number';
import { RequestFixForm } from '@/components/requests/request-fix-form';
import { RequestQuestionForm } from '@/components/requests/request-question-form';
import { RequestEmailButton } from '@/components/requests/request-email-button';
import { RequestHistoryTimeline } from '@/components/requests/request-history-timeline';
import {
  expectedReadyLabelFromEvents,
  lastStaffActorName,
  requestParamsRows,
  requestWizardView,
} from '@/lib/request-card-view';import { personHrefByFullName } from '@/lib/people-catalog';
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
        {events.map((event) => {
          // DIG-37 — имя сотрудника деканата ведёт на карточку человека в
          // справочнике; имена студентов в справочнике сотрудников нет,
          // поэтому остаются обычным текстом.
          const peopleHref =
            event.actorRole === 'STAFF' ? personHrefByFullName(event.actorName) : null;
          return (
            <li key={event.id} className="rounded-2xl border border-neutral-200 p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                {peopleHref ? (
                  <Link
                    href={peopleHref}
                    className="text-sm font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:text-coral-600 hover:decoration-coral-400"
                  >
                    {event.actorName}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-neutral-900">{event.actorName}</span>
                )}
                <span className="text-xs text-neutral-500">
                  {formatRequestDate(event.createdAt)}
                </span>
              </div>
              <p className="text-sm text-neutral-700">{event.message}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── DIG-32/33: карточка канонической заявки «ЗД-…» ───────────────────────────

async function renderCanonical(number: string, ctx: Awaited<ReturnType<typeof requireDataCtx>>) {
  // Чтение owner-scoped: чужой и несуществующий номер → одинаковый 404,
  // попытка чужой — в аудите (контракт canonical-requests, DIG-30).
  const request = await getCanonicalRequestByNumber(dataDb, ctx, number);
  if (!request) notFound();

  const events = await listCanonicalRequestEvents(dataDb, ctx, request.id);
  if (!events) notFound();

  const types = await listCanonicalRequestTypes(dataDb);
  const type = types.find((t) => t.code === request.typeCode) ?? null;

  const isStudent = ctx.role === 'STUDENT';
  const isFix = request.status === 'NEEDS_FIX';
  const isReady = request.status === 'READY' || request.status === 'ISSUED';
  // Блок документа — только мгновенные типы с цифровым PDF (роут /document).
  const hasDocument = isReady && (type?.isInstant ?? false);
  // Отмена — только до IN_PROGRESS (машина состояний DIG-30, ветка NEEDS_FIX разрешена).
  const canCancel =
    isStudent &&
    (request.status === 'SUBMITTED' ||
      request.status === 'ACCEPTED' ||
      request.status === 'NEEDS_FIX');

  // Последняя причина доработки/отказа — для алерта.
  let reason: string | null = null;
  if (isFix || request.status === 'REJECTED') {
    for (const event of events) {
      const comment = event.comment?.trim() ?? '';
      if (comment) reason = comment;
    }
  }

  const manager = lastStaffActorName(events);
  const expectedReady = expectedReadyLabelFromEvents(events, type?.etaDays ?? null);
  const paramRows = requestParamsRows(request.params, type?.formSchema ?? null);
  const wizard = requestWizardView(request.params);
  const documentHref = `/api/requests/${encodeURIComponent(request.number)}/document`;

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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-xs text-muted-foreground">{request.number}</span>
            {isStudent ? <CopyRequestNumber number={request.number} /> : null}
          </span>
          <span
            data-testid="request-status-pill"
            className="inline-block rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
          >
            {CANONICAL_REQUEST_STATUS_LABELS[request.status]}
          </span>
        </div>
        <h1 className="text-xl font-bold sm:text-2xl">{request.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {request.typeName} · подана{' '}
          <span data-testid="request-timestamp">{formatRequestDate(request.createdAt)}</span>
        </p>

        <div className="mt-5">
          <RequestStepper status={request.status} />
        </div>

        {/* Ожидаемая дата и менеджер заявки (DIG-33). */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {isFix ? (
            <span data-testid="request-expected-ready">Срок — после исправления</span>
          ) : expectedReady ? (
            <span data-testid="request-expected-ready">{expectedReady}</span>
          ) : null}
          <span data-testid="request-manager">Ведёт: {manager ?? 'сотрудник деканата'}</span>
        </div>

        {isFix && reason ? (
          <div
            data-testid="request-fix-alert"
            className="mt-4 flex items-start gap-2 rounded-button border border-warning/50 bg-warning-soft p-3"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-ink" />
            <p className="text-sm font-medium text-warning-ink">
              Нужна доработка. Что исправить: {reason}
            </p>
          </div>
        ) : null}
        {request.status === 'REJECTED' && reason ? (
          <div className="mt-4 rounded-button border border-error/40 bg-error-soft p-3">
            <p className="text-sm font-medium text-error-ink">Отклонено: {reason}</p>
          </div>
        ) : null}

        {/* Форма исправления прямо в карточке (DIG-33). */}
        {isFix && isStudent ? (
          <RequestFixForm requestId={request.id} action={resubmitRequestAction} />
        ) : null}

        {/* Блок готового документа: превью, скачать, проверить, email (DIG-33). */}
        {hasDocument && isStudent ? (
          <div
            data-testid="request-document-block"
            className="mt-4 rounded-button border border-border bg-background p-3"
          >
            <p className="text-sm font-bold text-foreground">Документ готов</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PDF с QR-кодом проверки. Скачать можно сколько угодно раз — документ формируется при
              скачивании.
            </p>
            {/* Превью PDF: inline-отдача того же документа; на 360 px скрыто. */}
            <object
              data={`${documentHref}?inline=1`}
              type="application/pdf"
              data-testid="request-document-preview"
              className="mt-3 hidden h-80 w-full rounded-button border border-border sm:block"
              aria-label={`Превью документа ${request.number}`}
            >
              <p className="p-3 text-xs text-muted-foreground">
                Превью не поддерживается браузером — скачайте PDF ниже.
              </p>
            </object>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={documentHref}
                data-testid="request-document-pdf"
                className="inline-flex items-center gap-1.5 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
              >
                <Download aria-hidden="true" className="size-4" />
                Скачать PDF
              </a>
              <Link
                href="/verify"
                data-testid="request-document-verify"
                className="inline-flex items-center gap-1.5 rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
              >
                <ShieldCheck aria-hidden="true" className="size-4" />
                Проверить подлинность
              </Link>
              <RequestEmailButton
                number={request.number}
                action={sendRequestDocumentByEmailAction}
              />
            </div>
          </div>
        ) : null}

        {/* Действия студента по машине состояний DIG-30. */}
        {canCancel ? (
          <div className="mt-4">
            <RequestTransitionButton
              action={cancelRequestAction}
              requestId={request.id}
              label="Отменить заявку"
              pendingLabel="Отменяем…"
              confirmText="Отменить заявку? Действие нельзя отменить."
              testid="request-cancel"
            />
          </div>
        ) : null}

        {/* Вопрос по заявке — обращение с привязкой к номеру (DIG-33). */}
        {isStudent ? (
          <RequestQuestionForm requestId={request.id} action={createRequestQuestionAction} />
        ) : null}
      </div>

      {/* Параметры заявки и вложения (DIG-33). */}
      {paramRows.length > 0 || wizard ? (
        <div
          data-testid="request-params"
          className="mt-6 rounded-card border border-border bg-card p-4 shadow-soft"
        >
          <h2 className="text-base font-semibold">Параметры заявки</h2>
          <dl className="mt-2 flex flex-col divide-y divide-border">
            {paramRows.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-x-4 py-2">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
            {wizard?.rows.map((row) => (
              <div
                key={`wizard-${row.label}`}
                className="flex flex-wrap justify-between gap-x-4 py-2"
              >
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          {wizard && wizard.attachments.length > 0 ? (
            <div data-testid="request-attachments" className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground">Вложения</p>
              <ul className="mt-1 flex flex-col gap-1">
                {wizard.attachments.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between gap-3 rounded-button bg-muted px-3 py-1.5 text-sm"
                  >
                    <span className="truncate text-foreground">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{file.sizeLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <h2 className="mb-3 mt-6 text-base font-semibold">История заявки</h2>
      <RequestHistoryTimeline events={events} />
    </section>
  );
}
