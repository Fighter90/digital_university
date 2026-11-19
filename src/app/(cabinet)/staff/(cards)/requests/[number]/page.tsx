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
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileDown } from 'lucide-react';
import { getStaffRequestDetail, normalizeRequestNumber, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { formatRequestDate, requestTypeLabel } from '@/lib/request-labels';
import { RequestStatusForm } from '@/components/staff/request-status-form';
import { t } from '@/lib/i18n';
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
