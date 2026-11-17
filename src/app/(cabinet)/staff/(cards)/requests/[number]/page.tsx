// DIG-48 — карточка заявки СОТРУДНИКА (/staff/requests/[номер]).
// Данные студента факультета (контакты — с учётом разрешений студента),
// параметры и история, смена статуса только разрешёнными переходами,
// «Нужна доработка» с обязательной причиной, «Сформировать PDF» (DIG-47)
// для выполненной заявки-справки. Чужой/несуществующий номер — единый 404.
//
// NOTE: карточка живёт в route group (cards) — на пути от корня нет ни
// одного loading.tsx, поэтому notFound() успевает выставить статус 404
// (контракт e2e staff-cabinet и data-isolation; см. (dashboard)/loading.tsx).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileDown } from 'lucide-react';
import { getStaffRequestDetail, normalizeRequestNumber, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { REQUEST_TYPE_LABELS, formatRequestDate } from '@/lib/request-labels';
import { RequestStatusForm } from '@/components/staff/request-status-form';
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
        ← К очереди заявок
      </Link>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-neutral-500">{request.number}</span>
        <RequestStatusBadge status={request.status} locale={locale} />
      </div>
      <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{request.title}</h1>
      <p className="mb-6 text-sm text-neutral-600">
        {REQUEST_TYPE_LABELS[request.type]} · подана {formatRequestDate(request.createdAt)}
        {request.assignee ? ` · исполнитель: ${request.assignee}` : ''}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Студент — владелец заявки (данные деканат видит по своему факультету). */}
        <section
          className="rounded-2xl border border-neutral-200 bg-card p-4"
          aria-label="Данные студента"
        >
          <h2 className="text-sm font-bold text-neutral-900">Студент</h2>
          <p className="mt-2 text-sm font-semibold text-neutral-900">{student.fullName}</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-neutral-600">
            <li>
              Группа: {student.groupName}, {student.course} курс
            </li>
            <li>Программа: {student.program}</li>
            <li>Форма обучения: {student.studyForm}</li>
            <li>Зачётная книжка: {student.gradebookNumber}</li>
            {contacts.email ? <li>Email: {contacts.email}</li> : null}
            {contacts.phone ? <li>Телефон: {contacts.phone}</li> : null}
          </ul>
        </section>

        {/* Параметры заявки. */}
        <section
          className="rounded-2xl border border-neutral-200 bg-card p-4"
          aria-label="Параметры заявки"
        >
          <h2 className="text-sm font-bold text-neutral-900">Параметры</h2>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-neutral-600">
            <li>Тип: {REQUEST_TYPE_LABELS[request.type]}</li>
            <li>
              Номер: <span className="font-mono">{request.number}</span>
            </li>
            <li>Последнее обновление: {formatRequestDate(request.updatedAt)}</li>
          </ul>
          {request.resultNote ? (
            <p className="mt-2 rounded-xl bg-neutral-50 p-2 text-sm text-neutral-800">
              Комментарий: {request.resultNote}
            </p>
          ) : null}

          {canPdf && (
            <a
              href={`/api/staff/requests/${request.number}/certificate`}
              data-testid="staff-certificate-pdf"
              className="mt-3 inline-flex items-center gap-2 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <FileDown className="size-4" aria-hidden="true" />
              Сформировать PDF
            </a>
          )}
        </section>
      </div>

      <div className="mt-4">
        <RequestStatusForm number={request.number} status={request.status} locale={locale} />
      </div>

      <h2 className="mb-3 mt-6 text-base font-semibold text-neutral-900">История заявки</h2>
      <ol className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-2xl border border-neutral-200 bg-card p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-900">
                {event.actorName}
                <span className="ml-1 text-xs font-normal text-neutral-500">
                  {event.actorRole === 'STAFF' ? '· деканат' : '· студент'}
                </span>
              </span>
              <span className="text-xs text-neutral-500">{formatRequestDate(event.createdAt)}</span>
            </div>
            <p className="text-sm text-neutral-700">{event.message}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
