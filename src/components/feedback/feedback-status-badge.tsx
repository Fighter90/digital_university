// DIG-40 — статус обращения канала «Обратная связь»: ровно три видимых
// значения («На рассмотрении» / «Отвечено» / «Решено»); маппинг внутренних
// статусов слоя данных — в lib/feedback (чистая функция, закреплена тестом).
import type { FeedbackStatus } from '@/server/data/types';
import {
  FEEDBACK_VIEW_STATUS_TONES,
  feedbackStatusLabel,
  feedbackViewStatus,
} from '@/lib/feedback';
import type { Locale } from '@/lib/i18n';

export function FeedbackStatusBadge({
  status,
  locale = 'ru',
}: {
  status: FeedbackStatus;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const view = feedbackViewStatus(status);
  return (
    <span
      data-testid="feedback-status"
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${FEEDBACK_VIEW_STATUS_TONES[view]}`}
    >
      {feedbackStatusLabel(view, locale)}
    </span>
  );
}
