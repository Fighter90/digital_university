'use client';

// DIG-38 — клиентский экран базы знаний: большое поле «Найдите ответ»,
// популярные запросы, категории плитками (фильтр, повторный клик снимает),
// список статей и состояние «Ничего не нашлось» с двумя следующими
// действиями — ноль результатов никогда не тупик (приёмка задачи).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CircleHelp, MessagesSquare, Search, Sparkles } from 'lucide-react';

import {
  FAQ_ARTICLES,
  FAQ_CATEGORY_ORDER,
  faqArticles,
  faqCategoryLabel,
  popularQueries,
  searchFaqArticles,
  type FaqArticle,
  type FaqCategory,
} from '@/lib/faq-kb-catalog';
import { t, type Locale } from '@/lib/i18n';

const linkButtonClasses =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold shadow-soft transition-colors focus-visible:outline-2';

/** Плюрализация статей: RU — 1 статья/2–4 статьи/5–20 статей; EN — article(s). */
function articlesLabel(n: number, locale: Locale): string {
  if (locale === 'en') return n === 1 ? 'article' : 'articles';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'статью';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'статьи';
  return 'статей';
}

function ArticleLink({ article, locale }: { article: FaqArticle; locale: Locale }) {
  return (
    <li>
      <Link
        href={`/help/${article.id}`}
        data-testid={`help-article-link-${article.id}`}
        className="block rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted focus-visible:outline-2"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-coral-600">
          {faqCategoryLabel(locale, article.category)}
        </span>
        <span className="mt-1 block text-sm font-bold leading-snug">{article.question}</span>
        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
          {article.answer.split('\n\n')[0]}
        </span>
      </Link>
    </li>
  );
}

export function HelpBrowser({ locale = 'ru' }: { locale?: Locale }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FaqCategory | null>(null);

  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed ? searchFaqArticles(trimmed, locale) : faqArticles(locale)),
    [trimmed, locale],
  );
  const visible = useMemo(
    () => (category ? results.filter((a) => a.category === category) : results),
    [results, category],
  );

  return (
    <div data-testid="help-browser" className="mt-5">
      {/* Большое поле «Найдите ответ» — ввод сразу фильтрует статьи. */}
      <label htmlFor="help-search" className="block text-base font-extrabold tracking-heading">
        {t(locale, 'help.findAnswer')}
      </label>
      <div className="relative mt-2">
        <Search
          aria-hidden="true"
          className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="help-search"
          data-testid="help-search"
          type="search"
          placeholder={t(locale, 'help.search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-14 w-full rounded-card border border-border bg-card pl-12 pr-4 text-base text-foreground shadow-soft outline-none transition-colors placeholder:text-muted-foreground focus:border-muted-foreground/40"
        />
      </div>

      {/* Популярные запросы — каждая подсказка реально что-то находит. */}
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label={t(locale, 'help.popularAria')}
      >
        {popularQueries(locale).map((popular) => (
          <button
            key={popular}
            type="button"
            data-testid={`help-popular-${popular}`}
            aria-pressed={trimmed === popular}
            onClick={() => setQuery(popular)}
            className="inline-flex h-8 items-center rounded-pill border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {popular}
          </button>
        ))}
      </div>

      {/* Категории плитками: метка + число статей, клик фильтрует. */}
      <div
        data-testid="help-categories"
        role="group"
        aria-label={t(locale, 'help.categoriesAria')}
        className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3"
      >
        {FAQ_CATEGORY_ORDER.map((key) => {
          const count = FAQ_ARTICLES.filter((a) => a.category === key).length;
          const active = category === key;
          return (
            <button
              key={key}
              type="button"
              data-testid={`help-category-${key}`}
              aria-pressed={active}
              onClick={() => setCategory(active ? null : key)}
              className="group flex min-h-20 flex-col items-start justify-between rounded-card border border-border bg-card p-3.5 text-left shadow-soft transition-colors hover:border-muted-foreground/40 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
            >
              <span className="flex items-center gap-1.5 text-xs font-bold leading-snug">
                <CircleHelp
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-coral-600 group-aria-pressed:text-background"
                />
                {faqCategoryLabel(locale, key)}
              </span>
              <span className="text-xs text-muted-foreground group-aria-pressed:text-background/70">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Статьи: поиск + фильтр категории. По умолчанию — весь каталог. */}
      {visible.length === 0 && results.length > 0 ? (
        // Поиск нашёл статьи, но фильтр категории всё скрыл: честная записка
        // со сбросом вместо «Ничего не нашлось» (раунд 4 ревью).
        <div
          data-testid="help-filter-empty"
          className="mt-6 flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card px-6 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            {t(locale, 'help.filterEmpty', {
              category: category ? faqCategoryLabel(locale, category) : '',
              query: trimmed,
              count: results.length,
              label: articlesLabel(results.length, locale),
            })}
          </p>
          <button
            type="button"
            data-testid="help-filter-reset"
            onClick={() => setCategory(null)}
            className="inline-flex min-h-10 items-center justify-center rounded-button border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted"
          >
            {t(locale, 'help.filterReset')}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div data-testid="help-empty" className="mt-6">
          <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-card px-6 py-10 text-center">
            <span
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
            >
              <Search aria-hidden="true" className="size-6" />
            </span>
            <h2 className="text-base font-extrabold tracking-heading">{t(locale, 'help.empty.title')}</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t(locale, 'help.empty.hint', { query: trimmed })}
            </p>
            <div className="mt-1 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Link
                data-testid="help-empty-ai"
                href={`/ai-assistant?q=${encodeURIComponent(trimmed)}`}
                className={`${linkButtonClasses} bg-foreground text-background hover:bg-muted-foreground/90`}
              >
                <Sparkles aria-hidden="true" className="size-4" />
                {t(locale, 'help.empty.askAi')}
              </Link>
              <Link
                data-testid="help-empty-deanery"
                href={`/deanery?q=${encodeURIComponent(trimmed)}`}
                className={`${linkButtonClasses} border border-border bg-card text-foreground hover:bg-muted`}
              >
                <MessagesSquare aria-hidden="true" className="size-4" />
                {t(locale, 'help.empty.writeDeanery')}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <ul
          data-testid="help-articles"
          aria-label={t(locale, 'help.articlesAria')}
          className="mt-6 grid grid-cols-1 gap-2.5"
        >
          {visible.map((article) => (
            <ArticleLink key={article.id} article={article} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}
