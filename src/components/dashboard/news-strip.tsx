import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { formatDateBadge } from '@/lib/dashboard-format';
import type { DeaneryNewsItem } from '@/server/data/news';

// DIG-20: «Новости деканата» — горизонтальная лента карточек (snap-scroll).
// Лента вымышленная (конкурсный прототип); пока у новостей нет своего
// маршрута (DIG-36), карточки ведут в фид уведомлений, где живут события NEWS.

export interface NewsStripProps {
  news: DeaneryNewsItem[];
}

export function NewsStrip({ news }: NewsStripProps) {
  if (news.length === 0) return null;

  return (
    <section aria-labelledby="dashboard-news-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dashboard-news-heading" className="text-lg font-extrabold tracking-heading sm:text-xl">
          Новости деканата
        </h2>
        <Link
          href="/notifications"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
        >
          Все новости
          <Icon icon={ArrowRight} size={14} />
        </Link>
      </div>

      <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {news.map((item) => {
          const badge = formatDateBadge(item.publishedAt);
          return (
            <Link
              key={item.id}
              href="/notifications"
              className="w-[260px] shrink-0 snap-start sm:w-[300px]"
            >
              <Card className="lift-hover flex h-full flex-col gap-1.5 p-4">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Icon icon={Newspaper} size={12} />
                  {badge.day} {badge.month}
                </span>
                <p className="text-sm font-bold leading-snug tracking-heading">{item.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{item.excerpt}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
