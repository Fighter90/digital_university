// DIG-48 — карточка заявки СОТРУДНИКА (/staff/requests/[номер]).
// Данные студента факультета (контакты — с учётом разрешений студента),
// параметры и история, смена статуса только разрешёнными переходами,
// «Нужна доработка» с обязательной причиной, «Сформировать PDF» (DIG-47)
// для выполненной заявки-справки. Чужой/несуществующий номер — единый 404.
//
// NOTE: карточка живёт в route group (cards) — на пути от корня нет ни
// одного loading.tsx, поэтому notFound() успевает выставить статус 404
// (контракт e2e staff-cabinet и data-isolation; см. (dashboard)/loading.tsx).
// DIG-89 — интерфейс по локали (cookie du-locale): RU — байт-в-байт прежний.
// DIG-126 — канонические заявки мастера (ЗД-…, DIG-30) в том же маршруте:
// ветка isValidCanonicalRequestNumber рендерит карточку канона (данные
// студента, параметры формы + мета мастера, история канона, легальные
// переходы машины DIG-30 с проверкой факультета); легаси (SR-…) — прежний
// поток без изменений (сосуществование миров).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileDown } from 'lucide-react';
import {
  getStaffCanonicalRequestDetail,
  getStaffRequestDetail,
  isValidCanonicalRequestNumber,
  normalizeRequestNumber,
  requireDataCtx,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import { RequestStatusBadge } from '@/components/request-status-badge';
import {
  canonicalTypeLabel,
  formatRequestDate,
  requestTypeLabel,
} from '@/lib/request-labels';
import { localizeRequestCardTitle } from '@/lib/en-demo-content';
import {
  expectedReadyLabelFromEvents,
  requestParamsRows,
  requestWizardView,
} from '@/lib/request-card-view';
import { requestNumberLabel } from '@/lib/requests-view';
import { RequestStatusForm } from '@/components/staff/request-status-form';
import { CanonicalRequestStatusForm } from '@/components/staff/canonical-request-status-form';
import { RequestHistoryTimeline } from '@/components/requests/request-history-timeline';
import { t, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export default async function StaffRequestCardPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: rawNumber } = await params;
  const number = normalizeRequestNumber(decodeURIComponent(rawNumber));
  const [ctx, locale] = await Promise.all([
    requireDataCtx(`/staff/requests/${rawNumber}`),
    getLocale(),
  ]);

  // DIG-126 — канон «ЗД-…»: отдельный мир данных DIG-30, свой рендер
  // (параметры из JSON-схемы типа, мета мастера, машина переходов канона).
  if (isValidCanonicalRequestNumber(number)) {
    return renderCanonicalStaffCard(number, ctx, locale);
  }

  const detail = await getStaffRequestDetail(dataDb, ctx, number);
  if (!detail) notFound();
  const { request, student, events, contacts } = detail;

  // Канон DIG-30: справка считается готовой к PDF в статусаx ISSUED (выдана)
  // и COMPLETED (legacy-словарь); SUBMITTED/IN_PROGRESS — рано.
  const canPdf =
    request.type === 'CERTIFICATE' &&
    (request.status === 'ISSUED' || request.status === 'COMPLETED');

  return (
    <div>
      <Link
        href="/staff/requests"
        className="mb-4 inline-block text-sm text-neutral-600 hover:text-neutral-900"
      >
        {t(locale, 'staff.backToQueue')}
      </Link>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-neutral-500">{request.number}</span>
        <RequestStatusBadge status={request.status} locale={locale} />
      </div>
      <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{request.title}</h1>
      <p className="mb-6 text-sm text-neutral-600">
        {requestTypeLabel(request.type, locale)} ·{' '}
        {t(locale, 'staff.card.submitted', { date: formatRequestDate(request.createdAt, locale) })}
        {request.assignee ? t(locale, 'staff.card.assignee', { name: request.assignee }) : ''}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Студент — владелец заявки (данные деканат видит по своему факультету). */}
        <section
          className="rounded-2xl border border-neutral-200 bg-card p-4"
          aria-label={t(locale, 'staff.card.studentAria')}
        >
          <h2 className="text-sm font-bold text-neutral-900">{t(locale, 'staff.card.student')}</h2>
          <p className="mt-2 text-sm font-semibold text-neutral-900">{student.fullName}</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-neutral-600">
            <li>
              {t(locale, 'staff.card.groupCourse', {
                group: student.groupName,
                course: student.course,
              })}
            </li>
            <li>{t(locale, 'staff.card.program', { program: student.program })}</li>
            <li>{t(locale, 'staff.card.studyForm', { form: student.studyForm })}</li>
            <li>{t(locale, 'staff.card.gradebook', { number: student.gradebookNumber })}</li>
            {contacts.email ? <li>Email: {contacts.email}</li> : null}
            {contacts.phone ? <li>{t(locale, 'staff.card.phone', { phone: contacts.phone })}</li> : null}
          </ul>
        </section>

        {/* Параметры заявки. */}
        <section
          className="rounded-2xl border border-neutral-200 bg-card p-4"
          aria-label={t(locale, 'staff.card.paramsAria')}
        >
          <h2 className="text-sm font-bold text-neutral-900">{t(locale, 'staff.card.params')}</h2>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-neutral-600">
            <li>{t(locale, 'staff.card.type', { type: requestTypeLabel(request.type, locale) })}</li>
            <li>
              {t(locale, 'staff.card.number')} <span className="font-mono">{request.number}</span>
            </li>
            <li>
              {t(locale, 'staff.card.lastUpdate', {
                date: formatRequestDate(request.updatedAt, locale),
              })}
            </li>
          </ul>
          {request.resultNote ? (
            <p className="mt-2 rounded-xl bg-neutral-50 p-2 text-sm text-neutral-800">
              {t(locale, 'staff.card.comment', { comment: request.resultNote })}
            </p>
          ) : null}

          {canPdf && (
            <a
              href={`/api/staff/requests/${request.number}/certificate`}
              data-testid="staff-certificate-pdf"
              className="mt-3 inline-flex items-center gap-2 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <FileDown className="size-4" aria-hidden="true" />
              {t(locale, 'staff.card.generatePdf')}
            </a>
          )}
        </section>
      </div>

      <div className="mt-4">
        <RequestStatusForm number={request.number} status={request.status} locale={locale} />
      </div>

      <h2 className="mb-3 mt-6 text-base font-semibold text-neutral-900">
        {t(locale, 'staff.card.history')}
      </h2>
      <ol className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-2xl border border-neutral-200 bg-card p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-900">
                {event.actorName}
                <span className="ml-1 text-xs font-normal text-neutral-500">
                  {event.actorRole === 'STAFF'
                    ? t(locale, 'staff.card.actorStaff')
                    : t(locale, 'staff.card.actorStudent')}
                </span>
              </span>
              <span className="text-xs text-neutral-500">
                {formatRequestDate(event.createdAt, locale)}
              </span>
            </div>
            <p className="text-sm text-neutral-700">{event.message}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── DIG-126 — карточка канонической заявки «ЗД-…» ────────────────────────────
// Скоуп факультета и аудит отказа — в getStaffCanonicalRequestDetail
// (чужой/несуществующий номер — единый notFound() → 404 без оракула).

async function renderCanonicalStaffCard(
  number: string,
  ctx: Awaited<ReturnType<typeof requireDataCtx>>,
  locale: Locale,
) {
  const detail = await getStaffCanonicalRequestDetail(dataDb, ctx, number);
  if (!detail) notFound();
  const { request, student, events, type, contacts } = detail;

  const typeLabel = canonicalTypeLabel(locale, request.typeCode, type?.name ?? request.typeName);
  const paramRows = requestParamsRows(request.params, type?.formSchema ?? null);
  const wizard = requestWizardView(request.params, locale);
  const readyBy = expectedReadyLabelFromEvents(events, type?.etaDays ?? null, locale);

  return (
    <div>
      <Link
        href="/staff/requests"
        className="mb-4 inline-block text-sm text-neutral-600 hover:text-neutral-900"
      >
        {t(locale, 'staff.backToQueue')}
      </Link>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-neutral-500">
          {requestNumberLabel(request.number, locale)}
        </span>
        <RequestStatusBadge status={request.status} locale={locale} />
      </div>
      <h1
        data-testid="staff-canonical-card-title"
        className="text-xl font-bold text-neutral-900 sm:text-2xl"
      >
        {localizeRequestCardTitle(locale, request.title)}
      </h1>
      <p className="mb-6 text-sm text-neutral-600">
        {typeLabel} ·{' '}
        {t(locale, 'staff.card.submitted', { date: formatRequestDate(request.createdAt, locale) })}
        {readyBy ? ` · ${readyBy}` : ''}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Студент — владелец заявки (факультет проверен слоем данных). */}
        <section
          className="rounded-2xl border border-neutral-200 bg-card p-4"
          aria-label={t(locale, 'staff.card.studentAria')}
        >
          <h2 className="text-sm font-bold text-neutral-900">{t(locale, 'staff.card.student')}</h2>
          <p className="mt-2 text-sm font-semibold text-neutral-900">{student.fullName}</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-neutral-600">
            <li>
              {t(locale, 'staff.card.groupCourse', {
                group: student.groupName,
                course: student.course,
              })}
            </li>
            <li>{t(locale, 'staff.card.program', { program: student.program })}</li>
            <li>{t(locale, 'staff.card.studyForm', { form: student.studyForm })}</li>
            <li>{t(locale, 'staff.card.gradebook', { number: student.gradebookNumber })}</li>
            {contacts.email ? <li>Email: {contacts.email}</li> : null}
            {contacts.phone ? (
              <li>{t(locale, 'staff.card.phone', { phone: contacts.phone })}</li>
            ) : null}
          </ul>
        </section>

        {/* Параметры канона: поля JSON-схемы типа + мета мастера заказа. */}
        <section
          className="rounded-2xl border border-neutral-200 bg-card p-4"
          aria-label={t(locale, 'staff.card.paramsAria')}
        >
          <h2 className="text-sm font-bold text-neutral-900">{t(locale, 'staff.card.params')}</h2>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-neutral-600">
            <li>{t(locale, 'staff.card.type', { type: typeLabel })}</li>
            <li>
              {t(locale, 'staff.card.number')}{' '}
              <span className="font-mono">{requestNumberLabel(request.number, locale)}</span>
            </li>
            <li>
              {t(locale, 'staff.card.lastUpdate', {
                date: formatRequestDate(request.updatedAt, locale),
              })}
            </li>
          </ul>
          {paramRows.length > 0 || wizard ? (
            <dl className="mt-2 flex flex-col divide-y divide-neutral-100" data-testid="staff-canonical-params">
              {paramRows.map((row) => (
                <div key={row.label} className="flex flex-wrap justify-between gap-x-4 py-1.5">
                  <dt className="text-xs text-neutral-500">{row.label}</dt>
                  <dd className="text-sm font-medium text-neutral-800">{row.value}</dd>
                </div>
              ))}
              {wizard?.rows.map((row) => (
                <div key={`wizard-${row.label}`} className="flex flex-wrap justify-between gap-x-4 py-1.5">
                  <dt className="text-xs text-neutral-500">{row.label}</dt>
                  <dd className="text-sm font-medium text-neutral-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {wizard && wizard.attachments.length > 0 ? (
            <div className="mt-2" data-testid="staff-canonical-attachments">
              <p className="text-xs font-semibold text-neutral-500">
                {t(locale, 'requests.attachments')}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {wizard.attachments.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-1.5 text-sm"
                  >
                    <span className="truncate text-neutral-800">{file.name}</span>
                    <span className="shrink-0 text-xs text-neutral-500">{file.sizeLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      {/* Переходы канона: машина DIG-30 для роли STAFF (валидация и в слое данных). */}
      <div className="mt-4">
        <CanonicalRequestStatusForm number={request.number} status={request.status} locale={locale} />
      </div>

      {/* Причина доработки/отказа видна в событиях таймлайна (как у студента). */}
      <h2 className="mb-3 mt-6 text-base font-semibold text-neutral-900">
        {t(locale, 'staff.card.history')}
      </h2>
      <RequestHistoryTimeline events={events} locale={locale} />
    </div>
  );
}
