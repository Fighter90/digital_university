// DIG-40 — статус обращения канала «Обратная связь»: ровно три видимых
// значения («На рассмотрении» / «Отвечено» / «Решено»); маппинг внутренних
// статусов слоя данных — в lib/feedback (чистая функция, закреплена тестом).
import type { FeedbackStatus } from '@/server/data/types';
import {
  FEEDBACK_VIEW_STATUS_LABELS,
  FEEDBACK_VIEW_STATUS_TONES,
  feedbackViewStatus,
} from '@/lib/feedback';

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const view = feedbackViewStatus(status);
  return (
    <span
      data-testid="feedback-status"
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${FEEDBACK_VIEW_STATUS_TONES[view]}`}
    >
      {FEEDBACK_VIEW_STATUS_LABELS[view]}
    </span>
  );
}
