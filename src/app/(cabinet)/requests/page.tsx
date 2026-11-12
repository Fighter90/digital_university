// DIG-12 — «Мои заявки». All data comes from the isolated data layer scoped
// by requireDataCtx(): the list contains the session owner's requests only —
// there is physically no way to render someone else's row here.
import Link from 'next/link';
import { FolderOpen } from 'lucide-react';
import { requireDataCtx, listRequests } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { REQUEST_TYPE_LABELS, formatRequestDate } from '@/lib/request-labels';

export default async function RequestsPage() {
  const ctx = await requireDataCtx('/requests');
  const requests = await listRequests(dataDb, ctx);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-xl font-bold sm:text-2xl">Мои заявки</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Заявки и обращения в деканат. Видны только ваши заявки — чужие не открываются даже по
        прямому адресу.
      </p>

      {/* DIG-29 — точка входа в каталог сервисов (Figma «06 · Заявки — каталог»). */}
      <Link
        href="/services"
        data-testid="services-catalog-cta"
        className="mb-6 flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-button bg-accent-soft text-accent-ink"
        >
          <FolderOpen className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-neutral-900">Каталог сервисов</span>
          <span className="mt-0.5 block text-xs text-neutral-600">
            Справки, заявления и услуги деканата — выберите и закажите.
          </span>
        </span>
      </Link>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">Заявок пока нет</p>
          <p className="mt-1 text-sm text-neutral-600">
            {ctx.role === 'STAFF'
              ? 'Раздел показывает заявки студента — для сотрудника он пуст.'
              : 'Подайте первую заявку через деканат — она появится здесь.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/requests/${request.number}`}
                className="block rounded-2xl border border-neutral-200 p-4 transition-colors hover:bg-neutral-50"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-neutral-500">{request.number}</span>
                  <RequestStatusBadge status={request.status} />
                </div>
                <p className="text-sm font-medium text-neutral-900">{request.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {REQUEST_TYPE_LABELS[request.type]} · подана{' '}
                  {formatRequestDate(request.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
