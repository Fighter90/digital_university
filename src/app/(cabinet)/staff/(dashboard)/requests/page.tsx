// DIG-48 — «Очередь заявок» (/staff/requests): заявки студентов факультета
// по статусам, фильтры по типу и сроку (GET-форма, работает без JS),
// подсветка просроченных по SLA и быстрое «Взять в работу». Скоуп —
// getStaffQueueUnified (staff-workflow), фильтрация — чистая filterUnifiedQueue.
// DIG-126 — очередь ЕДИНАЯ для двух миров: канонические заявки мастера
// (ЗД-…, DIG-30) рядом с легаси (ЗС/SR-…, легаси не ломается); SLA канона —
// etaDays типа РАБОЧИМИ днями; «Взять в работу» канона — легальная цепочка
// SUBMITTED → ACCEPTED → IN_PROGRESS (takeCanonicalInProgressAction).
// DIG-89 — интерфейс по локали (cookie du-locale): RU — байт-в-байт прежний.
import Link from 'next/link';
import { requireDataCtx, getStaffQueueUnified } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { RequestStatusBadge } from '@/components/request-status-badge';
import {
  REQUEST_TYPE_LABELS,
  canonicalTypeLabel,
  formatRequestDate,
  requestTypeLabel,
} from '@/lib/request-labels';
import {
  localizedFaculty,
  localizedGroup,
  localizePersonName,
  localizeRequestCardTitle,
} from '@/lib/en-demo-content';
import {
  REQUEST_SLA_DAYS,
  filterUnifiedQueue,
  isQueueRowOverdue,
  isQueueStatusOpen,
  parseQueueDueFilter,
  parseQueueTypeFilter,
  unifiedSlaHoursLeft,
  type QueueDueFilter,
} from '@/lib/staff-sla';
import { requestNumberLabel } from '@/lib/requests-view';
import type { RequestStatus, RequestType } from '@/server/data/types';
import type { StaffUnifiedQueueItem, StaffUnifiedRequestRow } from '@/server/data/staff-workflow';
import { takeCanonicalInProgressAction, takeInProgressAction } from '@/server/actions/staff';
import { transitionActionLabel } from '@/lib/staff-transitions';
import { t, type Locale, type TranslationKey } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { SectionTitle } from '@/components/shell/section-title';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata() {
  return { title: t(await getLocale(), 'title.staffRequests') };
}

// DIG-89 — подписи фильтров срока — ключи словаря (staff.queue.deadline.*).
const DUE_OPTIONS: Array<{ value: QueueDueFilter; labelKey: TranslationKey }> = [
  { value: 'all', labelKey: 'staff.queue.allDeadlines' },
  { value: 'overdue', labelKey: 'staff.queue.deadline.overdue' },
  { value: 'today', labelKey: 'staff.queue.deadline.today' },
  { value: 'week', labelKey: 'staff.queue.deadline.week' },
];

const STATUS_ORDER: RequestStatus[] = [
  'SUBMITTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'NEEDS_FIX',
  'READY',
  'NEEDS_REVISION',
  'ISSUED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

// DIG-89 — подписи групп статусов — ключи словаря (staff.group.*).
function statusGroupLabel(locale: Locale, status: RequestStatus): string {
  return t(locale, `staff.group.${status}` as TranslationKey);
}

function slaChip(request: StaffUnifiedRequestRow, now: Date, locale: Locale) {
  if (!isQueueStatusOpen(request.status)) return null;
  const hours = unifiedSlaHoursLeft(request, now);
  if (isQueueRowOverdue(request, now)) {
    const days = Math.max(1, Math.ceil(-hours / 24));
    return (
      <span
        data-testid={`sla-overdue-${request.number}`}
        className="inline-flex items-center rounded-pill bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
      >
        {t(locale, 'staff.queue.overdueBy', { days })}
      </span>
    );
  }
  if (hours <= 24) {
    return (
      <span className="inline-flex items-center rounded-pill bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        {t(locale, 'staff.queue.dueIn', { hours: Math.max(1, Math.round(hours)) })}
      </span>
    );
  }
  // «В сроке»: легаси — плановые дни типа, канон — дни до SLA-дедлайна
  // (etaDays в рабочих днях, канон DIG-30).
  const termDays =
    request.kind === 'legacy'
      ? REQUEST_SLA_DAYS[request.type]
      : Math.max(1, Math.ceil(hours / 24));
  return (
    <span className="inline-flex items-center rounded-pill bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
      {t(locale, 'staff.queue.inTerm', { days: termDays })}
    </span>
  );
}

/** Подпись типа строки: канон — словарь типов DIG-30, легаси — класс типа. */
function rowTypeLabel(request: StaffUnifiedRequestRow, locale: Locale): string {
  return request.kind === 'canonical'
    ? canonicalTypeLabel(locale, request.typeCode!, request.typeName!)
    : requestTypeLabel(request.type, locale);
}

/** «Взять в работу» из очереди: легаси — свой action, канон — цепочка машины. */
function takeForm(item: StaffUnifiedQueueItem, locale: Locale) {
  const { request } = item;
  const isLegacySubmitted = request.kind === 'legacy' && request.status === 'SUBMITTED';
  const isCanonicalTake =
    request.kind === 'canonical' && (request.status === 'SUBMITTED' || request.status === 'ACCEPTED');
  if (!isLegacySubmitted && !isCanonicalTake) return null;
  return (
    <form
      action={isLegacySubmitted ? takeInProgressAction : takeCanonicalInProgressAction}
      data-testid={`take-${request.number}`}
    >
      <input type="hidden" name="number" value={request.number} />
      <input type="hidden" name="to" value="IN_PROGRESS" />
      <button
        type="submit"
        className="shrink-0 rounded-button bg-coral-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        {transitionActionLabel(locale, 'IN_PROGRESS')}
      </button>
    </form>
  );
}

export default async function StaffQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; due?: string }>;
}) {
  const [ctx, locale] = await Promise.all([requireDataCtx('/staff/requests'), getLocale()]);
  const params = (await searchParams) ?? {};
  const filters = { type: parseQueueTypeFilter(params.type), due: parseQueueDueFilter(params.due) };
  const now = new Date();

  const queue = await getStaffQueueUnified(dataDb, ctx);
  const visibleIds = new Set(
    filterUnifiedQueue(
      queue.map((item) => item.request),
      filters,
      now,
    ).map((r) => r.id),
  );
  const items = queue.filter((item) => visibleIds.has(item.request.id));

  return (
    <div>
      <SectionTitle
        href="/staff/requests"
        className="text-xl font-bold text-neutral-900 sm:text-2xl"
      />
      <p className="mb-5 mt-1 text-sm text-neutral-600">
        {t(locale, 'staff.queue.subtitle', {
          faculty: localizedFaculty(locale, ctx.faculty),
          count: items.length,
        })}
      </p>

      {/* Фильтры: GET-форма — работает без JavaScript (прогрессивное улучшение). */}
      <form
        method="get"
        action="/staff/requests"
        data-testid="queue-filters"
        className="mb-6 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-card p-4 sm:flex-row sm:items-end"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          {t(locale, 'staff.queue.typeAria')}
          <select
            name="type"
            defaultValue={filters.type === 'all' ? 'all' : filters.type}
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            <option value="all">{t(locale, 'staff.queue.type.all')}</option>
            {(Object.keys(REQUEST_TYPE_LABELS) as RequestType[]).map((value) => (
              <option key={value} value={value} selected={filters.type === value}>
                {requestTypeLabel(value, locale)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          <legend className="sr-only">{t(locale, 'staff.queue.slaLegend')}</legend>
          {DUE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-1.5 py-1">
              <input
                type="radio"
                name="due"
                value={option.value}
                defaultChecked={filters.due === option.value}
                className="accent-coral-600"
              />
              {t(locale, option.labelKey)}
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          className="shrink-0 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
        >
          {t(locale, 'staff.queue.apply')}
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">
            {t(locale, 'staff.queue.empty.title')}
          </p>
          <p className="mt-1 text-sm text-neutral-600">{t(locale, 'staff.queue.empty.desc')}</p>
        </div>
      ) : (
        <div data-testid="staff-queue" className="flex flex-col gap-6">
          {STATUS_ORDER.map((status) => {
            const group = items.filter((item) => item.request.status === status);
            if (group.length === 0) return null;
            const groupLabel = statusGroupLabel(locale, status);
            return (
              <section
                key={status}
                aria-label={t(locale, 'staff.queue.statusAria', { status: groupLabel })}
              >
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-neutral-900">
                  {group.length} · {groupLabel}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.map((item) => {
                    const { request, student } = item;
                    const overdue = isQueueRowOverdue(request, now);
                    return (
                      <li
                        key={request.id}
                        data-kind={request.kind}
                        className={`rounded-2xl border p-4 transition-colors ${
                          overdue
                            ? 'border-red-200 bg-red-50/60'
                            : 'border-neutral-200 bg-card hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-neutral-500">
                                {requestNumberLabel(request.number, locale)}
                              </span>
                              <RequestStatusBadge status={request.status} locale={locale} />
                              {request.kind === 'canonical' && (
                                <span
                                  data-testid="queue-kind-canonical"
                                  className="inline-flex items-center rounded-pill bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
                                >
                                  {t(locale, 'staff.queue.canonicalPill')}
                                </span>
                              )}
                              {slaChip(request, now, locale)}
                            </div>
                            <Link
                              href={`/staff/requests/${request.number}`}
                              className="mt-1 block text-sm font-semibold text-neutral-900 hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-coral-600"
                            >
                              {localizeRequestCardTitle(locale, request.title)}
                            </Link>
                            <p className="mt-0.5 text-xs text-neutral-600">
                              {localizePersonName(locale, student.fullName)} ·{' '}
                              {localizedGroup(locale, student.groupName)} ·{' '}
                              {rowTypeLabel(request, locale)} ·{' '}
                              {t(locale, 'staff.queue.submitted')}{' '}
                              {formatRequestDate(request.createdAt, locale)}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {t(locale, 'staff.queue.slaDeadline', {
                                date: formatRequestDate(request.slaDeadline, locale),
                              })}
                              {request.assignee
                                ? t(locale, 'staff.queue.assignee', {
                                    name: localizePersonName(locale, request.assignee),
                                  })
                                : ''}
                            </p>
                          </div>

                          {takeForm(item, locale)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
