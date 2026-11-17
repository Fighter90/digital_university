// DIG-40 — подтверждение отправки по публичному номеру (/feedback/sent/…).
// После отправки студент видит номер и срок ответа (текст задачи).
//
// Представление строится из getFeedbackSentView — минимального публичного
// представления слоя данных: тип, адресат, статус, даты, признак
// анонимности. Текст, вложения и ЛЮБЫЕ пользовательские поля здесь не
// показываются и не покидают слой данных (приёмка DIG-40: анонимное
// обращение не хранит связь с пользователем ни на клиенте, ни в ответах
// API; содержимое по номеру не раскрывается).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

import { requireDataCtx, getFeedbackSentView, normalizeFeedbackNumber } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { FeedbackStatusBadge } from '@/components/feedback/feedback-status-badge';
import {
  ANONYMOUS_SENT_NOTE,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_RESPONSE_PROMISE,
  FEEDBACK_TARGET_LABELS,
  SENT_PRIVACY_NOTE,
  formatFeedbackDueAt,
} from '@/lib/feedback';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function FeedbackSentPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: rawNumber } = await params;
  let number: string;
  try {
    number = normalizeFeedbackNumber(decodeURIComponent(rawNumber));
  } catch {
    // Некорректный percent-encoding — тот же контрактный 404 (см. карточку).
    notFound();
  }
  await requireDataCtx(`/feedback/sent/${rawNumber}`);

  const view = await getFeedbackSentView(dataDb, number);
  if (!view) notFound();

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6 md:py-8">
      <Link
        href="/feedback"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← К обратной связи
      </Link>

      <article
        data-testid="feedback-sent"
        className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-soft"
      >
        <p className="flex items-center gap-2 text-base font-bold tracking-heading text-foreground">
          <CheckCircle2 className="size-5 shrink-0 text-green-600" aria-hidden="true" />
          Обращение отправлено
        </p>

        <p className="text-sm text-foreground">
          {FEEDBACK_KIND_LABELS[view.kind]} · {FEEDBACK_TARGET_LABELS[view.target]}
        </p>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Номер обращения</dt>
            <dd
              className="font-mono font-medium text-foreground"
              data-testid="feedback-sent-number"
            >
              {view.number}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Срок ответа</dt>
            <dd className="font-medium text-foreground" data-testid="feedback-sent-due">
              {formatFeedbackDueAt(view.dueAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Статус</dt>
            <dd className="mt-0.5">
              <FeedbackStatusBadge status={view.status} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Отправлено</dt>
            <dd className="font-medium text-foreground">{dateFormatter.format(view.createdAt)}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">{FEEDBACK_RESPONSE_PROMISE}</p>

        {view.isAnonymous ? (
          <p
            data-testid="feedback-sent-anonymous-note"
            className="flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{ANONYMOUS_SENT_NOTE}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Обращение доступно в списке «Мои обращения» на странице{' '}
            <Link href="/feedback" className="font-medium text-accent-ink hover:underline">
              Обратная связь
            </Link>
            .
          </p>
        )}

        <p className="text-xs text-muted-foreground">{SENT_PRIVACY_NOTE}</p>
      </article>
    </section>
  );
}
