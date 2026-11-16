// DIG-36 — пилюли тем фильтра новостей: Все, Учёба, Мероприятия, Стипендии,
// Общежитие. Ссылки (не кнопки): фильтр живёт в URL (?topic=…), работает
// без JS, переживает перезагрузку и делится ссылкой. Горизонтальный скролл
// на 360 px. Скоуп вкладки сохраняется, если он не дефолтный.
import Link from 'next/link';
import { cn } from 'cn';

import { NEWS_TOPIC_LABELS, type NewsTopicFilter, type NewsScope } from '@/lib/news-catalog';

const ORDER: ReadonlyArray<NewsTopicFilter> = [
  'all',
  'study',
  'events',
  'scholarship',
  'dormitory',
];

const LABELS: Record<NewsTopicFilter, string> = {
  all: 'Все',
  ...NEWS_TOPIC_LABELS,
};

export function buildTopicHref(
  topic: NewsTopicFilter,
  scope: NewsScope,
  scopeIsDefault: boolean,
): string {
  const next = new URLSearchParams();
  if (!scopeIsDefault) next.set('scope', scope);
  if (topic !== 'all') next.set('topic', topic);
  const query = next.toString();
  return query ? `/news?${query}` : '/news';
}

export function NewsTopicPills({
  topic,
  scope,
  scopeIsDefault,
}: {
  topic: NewsTopicFilter;
  scope: NewsScope;
  scopeIsDefault: boolean;
}) {
  return (
    <nav
      aria-label="Темы новостей"
      data-testid="news-topics"
      className="flex w-full gap-2 overflow-x-auto pb-1"
    >
      {ORDER.map((option) => {
        const active = option === topic;
        return (
          <Link
            key={option}
            href={buildTopicHref(option, scope, scopeIsDefault)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'shrink-0 rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-transparent bg-foreground text-background'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {LABELS[option]}
          </Link>
        );
      })}
    </nav>
  );
}
