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
import { dataDb } from '@/server/data/db';
import { FeedbackStatusBadge } from '@/components/feedback/feedback-status-badge';
import {
  FEEDBACK_KIND_LABELS,
  FEEDBACK_TARGET_LABELS,
  FEEDBACK_RESPONSE_PROMISE,
  formatFeedbackDueAt,
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
  const ctx = await requireDataCtx(`/feedback/${rawNumber}`);

  const card = await openFeedbackCard(dataDb, ctx, number);
  if (!card) notFound();

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/feedback"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Все обращения
      </Link>

      <article
        data-testid="feedback-card"
        className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-soft"
      >
        <header className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {FEEDBACK_KIND_LABELS[card.kind]} · {FEEDBACK_TARGET_LABELS[card.target]}
          </p>
          <FeedbackStatusBadge status={card.status} />
        </header>

        <p className="font-mono text-xs text-muted-foreground" data-testid="feedback-card-number">
          № {card.number}
        </p>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Отправлено</dt>
            <dd className="font-medium text-foreground">{dateFormatter.format(card.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Срок ответа</dt>
            <dd className="font-medium text-foreground" data-testid="feedback-card-due">
              {formatFeedbackDueAt(card.dueAt)}
            </dd>
          </div>
        </dl>

        <div>
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Текст обращения</h2>
          <p
            className="whitespace-pre-line text-sm text-foreground"
            data-testid="feedback-card-text"
          >
            {card.text}
          </p>
        </div>

        {card.attachments.length > 0 ? (
          <div>
            <h2 className="mb-1 text-sm font-medium text-muted-foreground">Вложения</h2>
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

        <p className="text-xs text-muted-foreground">{FEEDBACK_RESPONSE_PROMISE}</p>
      </article>
    </section>
  );
}
