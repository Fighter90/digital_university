// DIG-40 — карточка обращения канала «Обратная связь» по публичному номеру
// (никогда cuid). requireDataCtx() → openFeedbackCard() скоупит поиск
// владельцем сессии: чужой, несуществующий и АНОНИМНЫЙ номер отвечают
// одинаковым 404 (попытка — в аудит); анонимный номер не открывается никому,
// включая автора сессии — связь с пользователем не хранится (приёмка DIG-40).
//
// NOTE: над этим сегментом НЕ должно быть loading.tsx — Suspense-граница
// стримит shell до notFound() и чужой адрес ответил бы 200 вместо
// контрактного 404 (см. requests/[number]/page.tsx). Скелетон списка живёт
// в соседней route-group (list).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Paperclip } from 'lucide-react';

import { requireDataCtx, openFeedbackCard, normalizeFeedbackNumber } from '@/server/data';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { enFeedbackText } from '@/lib/en-demo-content';
import { dataDb } from '@/server/data/db';
import { FeedbackStatusBadge } from '@/components/feedback/feedback-status-badge';
import {
  feedbackResponsePromise,
  feedbackDueLabel,
  feedbackTargetLabel,
  feedbackTypeLabel,
} from '@/lib/feedback';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function FeedbackCardPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: rawNumber } = await params;
  let number: string;
  try {
    number = normalizeFeedbackNumber(decodeURIComponent(rawNumber));
  } catch {
    // Некорректный percent-encoding (URIError) — тот же контрактный 404,
    // что для чужого и несуществующего номера, а не 500.
    notFound();
  }
  const [ctx, locale] = await Promise.all([requireDataCtx(`/feedback/${rawNumber}`), getLocale()]);

  const card = await openFeedbackCard(dataDb, ctx, number);
  if (!card) notFound();
  // DIG-89 — EN-рендер демо-текста обращения по id строки.
  const text = locale === 'en' ? enFeedbackText(card.id) ?? card.text : card.text;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/feedback"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        {t(locale, 'feedback.backAll')}
      </Link>

      <article
        data-testid="feedback-card"
        className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-soft"
      >
        <header className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {feedbackTypeLabel(card.kind, locale)} · {feedbackTargetLabel(card.target, locale)}
          </p>
          <FeedbackStatusBadge status={card.status} locale={locale} />
        </header>

        <p className="font-mono text-xs text-muted-foreground" data-testid="feedback-card-number">
          № {card.number}
        </p>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t(locale, 'feedback.detail.sentAt')}</dt>
            <dd className="font-medium text-foreground">{dateFormatter.format(card.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t(locale, 'feedback.detail.dueAt')}</dt>
            <dd className="font-medium text-foreground" data-testid="feedback-card-due">
              {feedbackDueLabel(card.dueAt, locale)}
            </dd>
          </div>
        </dl>

        <div>
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">{t(locale, 'feedback.detail.textTitle')}</h2>
          <p
            className="whitespace-pre-line text-sm text-foreground"
            data-testid="feedback-card-text"
          >
            {text}
          </p>
        </div>

        {card.attachments.length > 0 ? (
          <div>
            <h2 className="mb-1 text-sm font-medium text-muted-foreground">{t(locale, 'feedback.detail.attachmentsTitle')}</h2>
            <ul className="flex flex-col gap-1">
              {card.attachments.map((name) => (
                <li key={name} className="flex items-center gap-2 text-sm text-foreground">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">{feedbackResponsePromise(locale)}</p>
      </article>
    </section>
  );
}
