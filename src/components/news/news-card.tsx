// DIG-36 — карточка новости в ленте (Figma «09 · Новости»): обложка-
// иллюстрация (SVG с alt и ленивой загрузкой), дата, источник, заголовок
// и 2 строки текста. Карточка целиком ведёт на /news/<id>; feed query
// переносится, чтобы «Назад» со статьи вернул в тот же скоуп/тему.
// Image unoptimized: статичный SVG (палитра токенов DIG-13), оптимизатор
// Next для SVG не нужен; loading="lazy" и alt — обязательная приёмка задачи.
import Image from 'next/image';
import Link from 'next/link';

import { NEWS_COVERS, formatNewsDate, newsCoverAlt } from '@/lib/news-catalog';
import { enNewsItem, enNewsSource } from '@/lib/en-demo-content';
import type { Locale } from '@/lib/i18n';
import type { NewsCardView } from '@/server/data/news';

export function NewsCard({
  item,
  feedQuery,
  locale = 'ru',
}: {
  item: NewsCardView;
  feedQuery: string;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const cover = NEWS_COVERS[item.topic];
  // DIG-89 — EN-рендер демо-новости: титул/лид из словаря по id.
  const view =
    locale === 'en'
      ? {
          ...item,
          ...(() => {
            const en = enNewsItem(item.id);
            return en ? { title: en.title, excerpt: en.excerpt } : {};
          })(),
        }
      : item;
  const href = `/news/${item.id}${feedQuery ? `?${feedQuery}` : ''}`;
  return (
    <Link
      href={href}
      data-testid={`news-card-${item.id}`}
      className="lift-hover press-scale group flex h-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-soft"
    >
      <Image
        src={cover.src}
        alt={newsCoverAlt(cover, locale)}
        loading="lazy"
        decoding="async"
        unoptimized
        width={640}
        height={360}
        className="aspect-[16/9] w-full bg-muted object-cover"
      />
      <span className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500">
          <span>{formatNewsDate(item.publishedAt, locale)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{locale === 'en' ? enNewsSource(item.source) : item.source}</span>
        </span>
        <span className="line-clamp-2 text-sm font-semibold text-neutral-900">{view.title}</span>
        <span className="line-clamp-2 text-xs text-neutral-600">{view.excerpt}</span>
      </span>
    </Link>
  );
}
