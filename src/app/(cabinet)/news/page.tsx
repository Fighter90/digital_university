// DIG-36 — «Новости и объявления» (/news, Figma «09 · Новости»).
//
// Данные — одним серверным агрегатом getNewsPage(dataDb, ctx): скоуп ленты
// строится из живой сессии (requireDataCtx) — группа/факультет студента
// берутся из контекста, не из URL; URL несёт только выбор пользователя
// (?scope=… / ?topic=…). По умолчанию — личный скоуп («Моя группа»);
// «Весь вуз» — только по явному выбору. Отметки «Прочитано» — owner-scoped
// в слое данных. Пока агрегат грузится, Suspense показывает скелетон.
import { Suspense } from 'react';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';

import { AnnouncementsStrip } from '@/components/news/announcements-strip';
import { NewsCard } from '@/components/news/news-card';
import { NewsSkeleton } from '@/components/news/news-skeleton';
import { NewsScopeTabs } from '@/components/news/news-scope-tabs';
import { NewsTopicPills } from '@/components/news/news-topic-pills';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionTitle } from '@/components/shell/section-title';
import { riseDelayStyle } from '@/lib/motion';
import { dataDb } from '@/server/data/db';
import { getNewsPage, requireDataCtx } from '@/server/data';

export const metadata = { title: 'Новости и объявления — Цифровой деканат' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** Канонический query ленты (scope/topic без дефолтов) — для ссылок карточек. */
function feedQueryString(scope: string, topic: string, scopeIsDefault: boolean): string {
  const next = new URLSearchParams();
  if (!scopeIsDefault) next.set('scope', scope);
  if (topic !== 'all') next.set('topic', topic);
  return next.toString();
}

async function NewsContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ctx = await requireDataCtx('/news');
  const scopeParam = single(params.scope);
  const topicParam = single(params.topic);
  const data = await getNewsPage(dataDb, ctx, { scope: scopeParam, topic: topicParam });
  // Дефолт скоупа: студент — «Моя группа»; сотрудник без группы — факультет.
  const scopeIsDefault = data.scope === (ctx.groupName === null ? 'faculty' : 'group');
  const feedQuery = feedQueryString(data.scope, data.topic, scopeIsDefault);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <SectionTitle href="/news" className="text-xl font-bold sm:text-2xl" />
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        По умолчанию — новости вашей группы и факультета; объявления деканата — в полосе «Важно»
        сверху.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <AnnouncementsStrip announcements={data.announcements} feedQuery={feedQuery} />
        <NewsScopeTabs
          scope={data.scope}
          groupDisabled={ctx.groupName === null}
          currentQuery={[
            data.topic !== 'all' ? `topic=${data.topic}` : '',
            scopeParam ? `scope=${scopeParam}` : '',
          ]
            .filter(Boolean)
            .join('&')}
        />
        <NewsTopicPills topic={data.topic} scope={data.scope} scopeIsDefault={scopeIsDefault} />
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Newspaper}
          title="Новостей пока нет"
          description="Для этой вкладки и темы новостей нет. Попробуйте другую тему или вкладку «Весь вуз»."
        />
      ) : (
        <ul
          data-testid="news-grid"
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {data.items.map((item, index) => (
            <li key={item.id} className="animate-rise min-w-0" style={riseDelayStyle(index)}>
              <NewsCard item={item} feedQuery={feedQuery} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Ищете уведомления о своих заявках и оценках? Загляните в{' '}
        <Link href="/notifications" className="font-semibold text-coral-600 hover:underline">
          «Уведомления»
        </Link>
        .
      </p>
    </section>
  );
}

export default function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<NewsSkeleton />}>
      <NewsContent searchParams={searchParams} />
    </Suspense>
  );
}
