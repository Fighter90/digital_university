// DIG-48 — «Очередь заявок» (/staff/requests): заявки студентов факультета
// по статусам, фильтры по типу и сроку (GET-форма, работает без JS),
// подсветка просроченных по SLA и быстрое «Взять в работу». Скоуп —
// getStaffQueue (staff-workflow), фильтрация — чистая filterQueue.
import Link from 'next/link';
import { requireDataCtx, getStaffQueue } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { REQUEST_TYPE_LABELS, formatRequestDate } from '@/lib/request-labels';
import {
  REQUEST_SLA_DAYS,
  filterQueue,
  isSlaOverdue,
  parseQueueDueFilter,
  parseQueueTypeFilter,
  slaDeadline,
  slaHoursLeft,
  type QueueDueFilter,
} from '@/lib/staff-sla';
import type { RequestStatus, RequestType } from '@/server/data/types';
import { takeInProgressAction } from '@/server/actions/staff';
import { SectionTitle } from '@/components/shell/section-title';

const DUE_OPTIONS: Array<{ value: QueueDueFilter; label: string }> = [
  { value: 'all', label: 'Все сроки' },
  { value: 'overdue', label: 'Просроченные' },
  { value: 'today', label: 'Дедлайн сегодня' },
  { value: 'week', label: 'Дедлайн 7 дней' },
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

const STATUS_GROUP_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: 'Поданные',
  ACCEPTED: 'Принятые',
  IN_PROGRESS: 'В работе',
  NEEDS_FIX: 'Нужна правка данных',
  READY: 'Готовые к выдаче',
  NEEDS_REVISION: 'Нужна доработка',
  ISSUED: 'Выданные',
  COMPLETED: 'Выполненные',
  REJECTED: 'Отклонённые',
  CANCELLED: 'Отменённые',
};

function slaChip(
  request: { number: string; type: RequestType; createdAt: Date; status: RequestStatus },
  now: Date,
) {
  if (!['SUBMITTED', 'IN_PROGRESS', 'NEEDS_REVISION'].includes(request.status)) return null;
  const hours = slaHoursLeft(request, now);
  if (isSlaOverdue(request, now)) {
    const days = Math.max(1, Math.ceil(-hours / 24));
    return (
      <span
        data-testid={`sla-overdue-${request.number}`}
        className="inline-flex items-center rounded-pill bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
      >
        Просрочено на {days} дн.
      </span>
    );
  }
  if (hours <= 24) {
    return (
      <span className="inline-flex items-center rounded-pill bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        Дедлайн через {Math.max(1, Math.round(hours))} ч
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-pill bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
      В сроке · {REQUEST_SLA_DAYS[request.type]} дн.
    </span>
  );
}

export default async function StaffQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; due?: string }>;
}) {
  const ctx = await requireDataCtx('/staff/requests');
  const params = (await searchParams) ?? {};
  const filters = { type: parseQueueTypeFilter(params.type), due: parseQueueDueFilter(params.due) };
  const now = new Date();

  const queue = await getStaffQueue(dataDb, ctx);
  const visibleIds = new Set(
    filterQueue(
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
        Заявки студентов факультета {ctx.faculty ?? '—'} · всего в очереди {items.length}. Чужие
        факультеты и их заявки сюда не попадают.
      </p>

      {/* Фильтры: GET-форма — работает без JavaScript (прогрессивное улучшение). */}
      <form
        method="get"
        action="/staff/requests"
        data-testid="queue-filters"
        className="mb-6 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-card p-4 sm:flex-row sm:items-end"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Тип заявки
          <select
            name="type"
            defaultValue={filters.type === 'all' ? 'all' : filters.type}
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            <option value="all">Все типы</option>
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value} selected={filters.type === value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          <legend className="sr-only">Срок по SLA</legend>
          {DUE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-1.5 py-1">
              <input
                type="radio"
                name="due"
                value={option.value}
                defaultChecked={filters.due === option.value}
                className="accent-coral-600"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          className="shrink-0 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
        >
          Применить
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">Заявок по фильтру нет</p>
          <p className="mt-1 text-sm text-neutral-600">
            Смягчите фильтры или дождитесь новых заявок студентов.
          </p>
        </div>
      ) : (
        <div data-testid="staff-queue" className="flex flex-col gap-6">
          {STATUS_ORDER.map((status) => {
            const group = items.filter((item) => item.request.status === status);
            if (group.length === 0) return null;
            return (
              <section key={status} aria-label={`Статус: ${STATUS_GROUP_LABELS[status]}`}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-neutral-900">
                  {group.length} · {STATUS_GROUP_LABELS[status]}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.map(({ request, student }) => {
                    const overdue = isSlaOverdue(request, now);
                    const deadline = slaDeadline(request);
                    return (
                      <li
                        key={request.id}
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
                                {request.number}
                              </span>
                              <RequestStatusBadge status={request.status} />
                              {slaChip(request, now)}
                            </div>
                            <Link
                              href={`/staff/requests/${request.number}`}
                              className="mt-1 block text-sm font-semibold text-neutral-900 hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-coral-600"
                            >
                              {request.title}
                            </Link>
                            <p className="mt-0.5 text-xs text-neutral-600">
                              {student.fullName} · {student.groupName} ·{' '}
                              {REQUEST_TYPE_LABELS[request.type]} · подана{' '}
                              {formatRequestDate(request.createdAt)}
                            </p>
                            <p className="text-xs text-neutral-500">
                              Срок по SLA: {formatRequestDate(deadline)}
                              {request.assignee ? ` · исполнитель: ${request.assignee}` : ''}
                            </p>
                          </div>

                          {request.status === 'SUBMITTED' && (
                            <form
                              action={takeInProgressAction}
                              data-testid={`take-${request.number}`}
                            >
                              <input type="hidden" name="number" value={request.number} />
                              <input type="hidden" name="to" value="IN_PROGRESS" />
                              <button
                                type="submit"
                                className="shrink-0 rounded-button bg-coral-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
                              >
                                Взять в работу
                              </button>
                            </form>
                          )}
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
