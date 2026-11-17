// DIG-40 — список «Мои обращения» (левая панель экрана /feedback): тип,
// адресат, номер, статус и срок ответа. Данные приходят из getFeedbackPage
// (owner-scoped): в списке физически не может быть чужого обращения;
// анонимных обращений здесь нет — у них нет связи с аккаунтом (приёмка
// DIG-40), поэтому и отслеживать их в кабинете невозможно.
import Link from 'next/link';
import { MailPlus, MessagesSquare } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackStatusBadge } from '@/components/feedback/feedback-status-badge';
import { FEEDBACK_KIND_LABELS, FEEDBACK_TARGET_LABELS, formatFeedbackDueAt } from '@/lib/feedback';
import type { FeedbackRow } from '@/server/data';

export function FeedbackList({ items }: { items: FeedbackRow[] }) {
  if (items.length === 0) {
    return (
      <section data-testid="feedback-list" aria-label="Мои обращения">
        <EmptyState
          icon={MessagesSquare}
          title="Обращений пока нет"
          description="Создайте предложение, жалобу или благодарность — руководство увидит их здесь же."
        />
      </section>
    );
  }

  return (
    <section
      data-testid="feedback-list"
      aria-label="Мои обращения"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 className="text-base font-semibold">Мои обращения</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/feedback/${item.number}`}
              data-testid={`feedback-item-${item.number}`}
              className="block rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{item.number}</span>
                <FeedbackStatusBadge status={item.status} />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {FEEDBACK_KIND_LABELS[item.kind]} · {FEEDBACK_TARGET_LABELS[item.target]}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Срок ответа: {formatFeedbackDueAt(item.dueAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="#new-feedback"
        data-testid="feedback-new-link"
        className="inline-flex items-center gap-2 text-sm font-medium text-accent-ink hover:underline"
      >
        <MailPlus className="size-4" aria-hidden="true" />
        Новое обращение
      </Link>
    </section>
  );
}
