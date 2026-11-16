// DIG-36 — полоса объявлений деканата («Важно: …») над лентой: горизонтальный
// скролл карточек в скоупе текущей вкладки. У непрочитанного — маркер
// «новое» (data-unread + точка), у прочитанного — пометка «Прочитано»
// (read-state owner-scoped в слое данных). Карточка ведёт на /news/<id>.
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { cn } from 'cn';

import { formatNewsDate } from '@/lib/news-catalog';
import type { NewsCardView } from '@/server/data/news';

export function AnnouncementsStrip({
  announcements,
  feedQuery,
}: {
  announcements: NewsCardView[];
  feedQuery: string;
}) {
  if (announcements.length === 0) return null;
  return (
    <section
      aria-label="Объявления деканата"
      data-testid="news-announcements"
      className="rounded-card border border-coral-200 bg-coral-50 p-3"
    >
      <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-extrabold tracking-heading text-coral-600">
        <Megaphone aria-hidden="true" className="size-4" />
        Важно: объявления деканата
      </h2>
      <ul className="flex snap-x gap-3 overflow-x-auto pb-1">
        {announcements.map((item) => (
          <li key={item.id} className="min-w-0 shrink-0 snap-start">
            <Link
              href={`/news/${item.id}${feedQuery ? `?${feedQuery}` : ''}`}
              data-testid={`news-announcement-${item.id}`}
              data-unread={item.isRead ? undefined : 'true'}
              className="lift-hover flex h-full w-72 flex-col gap-1 rounded-button border border-coral-200 bg-white p-3 shadow-soft"
            >
              <span className="flex items-center gap-2">
                <span className="rounded-pill bg-coral-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  Важно
                </span>
                {item.isRead ? (
                  <span
                    data-testid="news-read-badge"
                    className={cn(
                      'rounded-pill border border-neutral-200 bg-neutral-100 px-2 py-0.5',
                      'text-[11px] font-semibold text-neutral-500',
                    )}
                  >
                    Прочитано
                  </span>
                ) : (
                  <span
                    aria-label="Непрочитанное объявление"
                    className="flex items-center gap-1 text-[11px] font-semibold text-coral-600"
                  >
                    <span aria-hidden="true" className="size-2 rounded-pill bg-coral-600" />
                    Новое
                  </span>
                )}
              </span>
              <span className="line-clamp-2 text-sm font-semibold text-neutral-900">
                {item.title}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                {formatNewsDate(item.publishedAt)} · {item.source}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
