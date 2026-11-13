// DIG-36 — карточка новости в ленте (Figma «09 · Новости»): обложка-
// иллюстрация (SVG с alt и ленивой загрузкой), дата, источник, заголовок
// и 2 строки текста. Карточка целиком ведёт на /news/<id>; feed query
// переносится, чтобы «Назад» со статьи вернул в тот же скоуп/тему.
// Image unoptimized: статичный SVG (палитра токенов DIG-13), оптимизатор
// Next для SVG не нужен; loading="lazy" и alt — обязательная приёмка задачи.
import Image from 'next/image';
import Link from 'next/link';

import { NEWS_COVERS, formatNewsDate } from '@/lib/news-catalog';
import type { NewsCardView } from '@/server/data/news';

export function NewsCard({ item, feedQuery }: { item: NewsCardView; feedQuery: string }) {
  const cover = NEWS_COVERS[item.topic];
  const href = `/news/${item.id}${feedQuery ? `?${feedQuery}` : ''}`;
  return (
    <Link
      href={href}
      data-testid={`news-card-${item.id}`}
      className="lift-hover group flex h-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-soft"
    >
      <Image
        src={cover.src}
        alt={cover.alt}
        loading="lazy"
        unoptimized
        width={640}
        height={360}
        className="aspect-[16/9] w-full bg-muted object-cover"
      />
      <span className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500">
          <span>{formatNewsDate(item.publishedAt)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{item.source}</span>
        </span>
        <span className="line-clamp-2 text-sm font-semibold text-neutral-900">{item.title}</span>
        <span className="line-clamp-2 text-xs text-neutral-600">{item.excerpt}</span>
      </span>
    </Link>
  );
}
