// DIG-32 — карточка заявки в списке «Мои заявки» (фрейм Figma
// «06 · Заявки — мои заявки»).
//
// Состав карточки: иконка типа, название с ключевым параметром, номер,
// дата подачи, статус-пилюля ЕДИНОГО словаря (вид приходит из слоя данных
// уже унифицированным — unifyRequestStatus), горизонтальный степпер
// «Подана → Принята → В работе → Готова → Выдана» (полный на ≥sm,
// компактный «точки + текущий шаг» на 360 px), строка следующего действия
// и кнопка действия по машине состояний DIG-30.
//
// Кликом по карточке открывается «Карточка заявки» (/requests/[номер]):
// ссылка-подложка на всю карточку (stretched link), кнопки действий лежат
// выше неё по z. «Нужна доработка» выделена рамкой и строкой причины.
import Link from 'next/link';
import {
  Briefcase,
  Building2,
  Download,
  FileText,
  GraduationCap,
  ListChecks,
  MessageSquareText,
  PenLine,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cancelRequestAction } from '@/server/actions/requests';
import {
  type RequestCardView,
  type RequestIconKind,
  unifyRequestStatus,
} from '@/lib/requests-view';
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_TONES } from '@/lib/request-labels';
import { Icon } from '@/components/ui/icon';
import { RequestStepper } from './request-stepper';
import { RequestTransitionButton } from './request-transition-button';

const ICONS: Record<RequestIconKind, LucideIcon> = {
  certificate: FileText,
  statement: PenLine,
  grades: ListChecks,
  diploma: GraduationCap,
  practice: Briefcase,
  dormitory: Building2,
  other: MessageSquareText,
};

export function RequestCard({ request }: { request: RequestCardView }) {
  const IconCmp = ICONS[request.iconKind];
  const isFix = request.isFix;
  // Единый словарь на входе в экран: даже если вид приехал с легаси-
  // значением (нарушение контракта агрегатора), пилюля и степпер
  // покажут только канонические метки — «Выполнена/Требует правок»
  // на экране «Мои заявки» невозможны.
  const status = unifyRequestStatus(request.status);

  return (
    <article
      data-testid="request-card"
      data-request-status={status}
      className={`relative rounded-card border bg-card p-4 shadow-soft sm:p-5 ${
        isFix ? 'border-warning/60 bg-warning-soft/40' : 'border-border'
      }`}
    >
      {/* Ссылка-подложка: вся карточка ведёт в «Карточку заявки».
          z-10 поднимает её над контентом карточки (степпер — positioned
          li, иначе он перехватывает клики), кнопки действий выше — z-20. */}
      <Link
        href={`/requests/${encodeURIComponent(request.number)}`}
        className="absolute inset-0 z-10 rounded-card focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        <span className="sr-only">
          Открыть заявку {request.number} — {request.title}
        </span>
      </Link>

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-button ${
            isFix ? 'bg-warning-soft text-warning-ink' : 'bg-accent-soft text-accent-ink'
          }`}
        >
          <Icon icon={IconCmp} size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-bold text-foreground sm:text-base">{request.title}</h3>
            <span
              data-testid="request-status-pill"
              className={`inline-block shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                REQUEST_STATUS_TONES[status]
              }`}
            >
              {REQUEST_STATUS_LABELS[status]}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{request.number}</span>
            <span aria-hidden="true">·</span>
            <span>подана {request.createdAtLabel}</span>
          </p>
        </div>
      </div>

      <div className="mt-3">
        <RequestStepper status={status} />
      </div>

      <p
        className={`mt-3 flex items-start gap-1.5 text-sm ${
          isFix ? 'font-medium text-warning-ink' : 'text-muted-foreground'
        }`}
        data-testid="request-next-action"
      >
        {isFix ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
        <span>{request.nextAction}</span>
      </p>

      {request.action ? (
        <div className="relative z-20 mt-3 flex flex-wrap items-center gap-2">
          {request.action === 'DOWNLOAD' ? (
            <a
              href={`/api/requests/${encodeURIComponent(request.number)}/document`}
              data-testid="request-action-download"
              className="inline-flex items-center gap-1.5 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <Download aria-hidden="true" className="size-4" />
              Скачать PDF
            </a>
          ) : null}
          {request.action === 'FIX' ? (
            <Link
              href={`/requests/${encodeURIComponent(request.number)}`}
              data-testid="request-action-fix"
              className="inline-flex items-center gap-1.5 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              Исправить
            </Link>
          ) : null}
          {request.action === 'CANCEL' ? (
            <RequestTransitionButton
              action={cancelRequestAction}
              requestId={request.id}
              label="Отменить"
              pendingLabel="Отменяем…"
              confirmText="Отменить заявку? Действие нельзя отменить."
              testid="request-action-cancel"
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
