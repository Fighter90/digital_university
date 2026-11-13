// DIG-36 — страница новости (/news/<id>, Figma «09 · Новости»).
//
// Контент новостей — публичный вымышленный каталог: статья доступна любому
// авторизованному пользователю кабинета (персональных данных в новостях
// нет, IDOR-скоупинг не требуется). Персональная часть — отметка
// «Прочитано»: пишется ТОЛЬКО владельцу (ctx.studentId из живой сессии),
// id валидируется белым списком каталога, запись идемпотентна. Неизвестный
// id — униформный 404 (notFound), без различения «чужое/несуществующее».
// query статьи переносит скоуп/тему ленты — «Назад» возвращает на ту же
// вкладку, с которой перешли.
// query статьи переносит скоуп/тему ленты — «Назад» возвращает на ту же
// вкладку, с которой перешли. «Назад» — НАТИВНАЯ ссылка (не next/link):
// отметка «Прочитано» меняет состояние ленты, а soft-навигация может
// отдать устаревший RSC-кэш клиента (урок DIG-23: полная загрузка работает
// всегда) — полный заход гарантирует свежую полосу «Важно».
import { ArrowLeft, Download, Paperclip } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { ShareButton } from '@/components/news/share-button';
import { NEWS_COVERS, formatNewsDate } from '@/lib/news-catalog';
import { dataDb } from '@/server/data/db';
import { getNewsArticle, markNewsRead, requireDataCtx } from '@/server/data';

export const metadata = { title: 'Новость — Цифровой деканат' };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function backHrefFrom(searchParams: SearchParams): Promise<string> {
  const params = await searchParams;
  const next = new URLSearchParams();
  const scope = typeof params.scope === 'string' ? params.scope : undefined;
  const topic = typeof params.topic === 'string' ? params.topic : undefined;
  if (scope) next.set('scope', scope);
  if (topic) next.set('topic', topic);
  const query = next.toString();
  return query ? `/news?${query}` : '/news';
}

async function ArticleContent({ id, backHref }: { id: string; backHref: string }) {
  const ctx = await requireDataCtx(`/news/${id}`);
  const data = await getNewsArticle(dataDb, ctx, id);
  if (!data) notFound();
  // Открытие = «прочитано»: только владелец, whitelist каталога,
  // идемпотентно (сотруднику отметки не пишутся — нет студенческого скоупа).
  if (ctx.studentId !== null) {
    await markNewsRead(dataDb, ctx, id);
  }
  const { article } = data;
  const cover = NEWS_COVERS[article.topic];

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6 md:py-8">
      <a
        href={backHref}
        data-testid="news-back"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral-600 transition-colors hover:text-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Все новости
      </a>

      <article className="mt-4 overflow-hidden rounded-card border border-border bg-card shadow-soft">
        <Image
          src={cover.src}
          alt={cover.alt}
          loading="lazy"
          unoptimized
          width={640}
          height={360}
          className="aspect-[16/9] w-full bg-muted object-cover"
        />
        <div className="flex flex-col gap-3 p-5 md:p-6">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {formatNewsDate(article.publishedAt)} · {article.source}
          </p>
          <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{article.title}</h1>
          <p className="text-sm text-muted-foreground">Автор: {article.authorName}</p>

          <div className="flex flex-col gap-3 text-sm leading-relaxed text-neutral-700">
            {article.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {article.attachments && article.attachments.length > 0 ? (
            <section
              aria-label="Вложения"
              data-testid="news-attachments"
              className="mt-2 rounded-card border border-border bg-neutral-50 p-4"
            >
              <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-heading">
                <Paperclip aria-hidden="true" className="size-4 text-coral-600" />
                Вложения
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {article.attachments.map((file) => (
                  <li key={file.href}>
                    <a
                      href={file.href}
                      download
                      className="flex items-center gap-3 rounded-button border border-border bg-card px-3 py-2 text-sm shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
                    >
                      <Download aria-hidden="true" className="size-4 shrink-0 text-coral-600" />
                      <span className="min-w-0 flex-1 truncate font-semibold text-neutral-900">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500">{file.sizeLabel}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-2 border-t border-border pt-4">
            <ShareButton />
          </div>
        </div>
      </article>
    </section>
  );
}

export default async function NewsArticlePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, backHref] = await Promise.all([params, backHrefFrom(searchParams)]);
  return <ArticleContent id={id} backHref={backHref} />;
}
