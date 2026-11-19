// DIG-38 — статья базы знаний /help/[slug]: вопрос, ответ, «Полезно? Да /
// Нет», связанные статьи и кнопка сервиса, если ответ ведёт к заявке.
// Неизвестный slug — notFound(). Статья публична (нет owner-scoped данных),
// доступ гарантирует requireUser каркаса кабинета.
// DIG-88 — тексты статьи и подписи страницы по локали cookie du-locale;
// RU — байт-в-байт прежние строки.
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import {
  faqCategoryLabel,
  getFaqArticleLocalized,
  getRelatedFaqArticlesLocalized,
} from '@/lib/faq-kb-catalog';
import { HelpFeedback } from '@/components/help/help-feedback';
import { ShareButtons } from '@/components/share/share-buttons';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

type ArticlePageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()] as const);
  const article = getFaqArticleLocalized(slug, locale);
  return {
    title: article
      ? t(locale, 'meta.helpArticle', { question: article.question })
      : t(locale, 'meta.helpNotFound'),
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const [{ slug }, locale] = await Promise.all([params, getLocale()] as const);
  const article = getFaqArticleLocalized(slug, locale);
  if (!article) notFound();
  const related = getRelatedFaqArticlesLocalized(article, locale);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 rounded-button px-1 text-sm font-semibold text-coral-600 transition-colors hover:text-coral-500 focus-visible:outline-2"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t(locale, 'help.back')}
      </Link>

      <article
        data-testid="help-article"
        className="mt-3 rounded-card border border-border bg-card p-5 shadow-soft sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-coral-600">
          {faqCategoryLabel(locale, article.category)}
        </p>
        <h1 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">{article.question}</h1>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/90">
          {article.answer.split('\n\n').map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>

        {article.cta ? (
          <div className="mt-6">
            <Link
              href={article.cta.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-button bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-soft transition-colors hover:bg-muted-foreground/90 focus-visible:outline-2"
            >
              {article.cta.label}
            </Link>
          </div>
        ) : null}

        {/* DIG-101 — «Поделиться»: статья справки публична (нет личных данных). */}
        <div className="mt-6 border-t border-border pt-4">
          <ShareButtons url={`/help/${slug}`} title={article.question} locale={locale} />
        </div>

        <HelpFeedback locale={locale} />
      </article>

      <section data-testid="help-related" aria-labelledby="help-related-heading" className="mt-6">
        <h2 id="help-related-heading" className="text-base font-extrabold tracking-heading">
          {t(locale, 'help.related')}
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-2.5">
          {related.map((item) => (
            <li key={item.id}>
              <Link
                href={`/help/${item.id}`}
                className="block rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted focus-visible:outline-2"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-coral-600">
                  {faqCategoryLabel(locale, item.category)}
                </span>
                <span className="mt-1 block text-sm font-bold leading-snug">{item.question}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
