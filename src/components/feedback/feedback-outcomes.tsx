// DIG-40 — публичная лента «Что мы изменили по вашим предложениям»:
// решённые предложения с результатом. Общая для всех студентов, без авторов
// и пользовательских данных (представление FeedbackOutcomeView слоя данных
// не содержит studentId — приёмка DIG-40). Источники — сиды (3 примера);
// новые записи может добавлять только слой данных.
import { CheckCircle2 } from 'lucide-react';

import {
  feedbackOutcome,
  feedbackTargetLabel,
  feedbackTypeLabel,
  formatOutcomeMonth,
} from '@/lib/feedback';
import { enFeedbackOutcome } from '@/lib/en-demo-content';
import type { Locale } from '@/lib/i18n';
import type { FeedbackOutcomeView } from '@/server/data';

export function FeedbackOutcomes({
  title,
  items,
  locale = 'ru',
}: {
  title: string;
  items: FeedbackOutcomeView[];
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (items.length === 0) return null;

  return (
    <section
      data-testid="feedback-outcomes"
      aria-label={feedbackOutcome(locale)}
      className="mt-8 flex min-w-0 flex-col gap-3"
    >
      <h2 className="text-base font-semibold">{feedbackOutcome(locale)}</h2>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.number}
            data-testid={`feedback-outcome-${item.number}`}
            className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-soft"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {feedbackTypeLabel(item.kind, locale)} · {feedbackTargetLabel(item.target, locale)}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {locale === 'en'
                ? enFeedbackOutcome(item.number)?.suggestion ?? item.suggestion
                : item.suggestion}
            </p>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
              <span>
                {locale === 'en'
                  ? enFeedbackOutcome(item.number)?.outcome ?? item.outcome
                  : item.outcome}
              </span>
            </p>
            <p className="mt-auto text-xs text-muted-foreground">
              {locale === 'en'
                ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
                    item.resolvedAt,
                  )
                : formatOutcomeMonth(item.resolvedAt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
