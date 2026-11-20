'use client';

// DIG-70 — клиентский поиск-фильтр «Справки» (/guide): поле фильтрует разделы
// гайда по заголовкам и тексту (чистая функция filterHelpSections из lib/help-
// content). Оглавление — якорная навигация: на десктопе всегда видно, на
// мобильном свёрнуто в details/summary. Ноль результатов — не тупик:
// подсказка «Ничего не найдено» предлагает другие слова.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CalendarPlus,
  Contact,
  FileText,
  KeyRound,
  ListChecks,
  MessagesSquare,
  MessageSquareHeart,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { Callout } from '@/components/help/callout';
import {
  emptySearchHint,
  emptySearchMessage,
  filterHelpSections,
  guideStepCountLabel,
  type HelpSection,
} from '@/lib/help-content';
import { t, type Locale } from '@/lib/i18n';

// Иконки разделов гайда по id (lucide напрямую — данные в lib без React).
// Расписание, заявки, деканат и остальные повторяют иконки тех же разделов
// из nav-icons — визуальная согласованность каркаса.
const SECTION_ICONS: Record<string, LucideIcon> = {
  login: KeyRound,
  schedule: CalendarDays,
  requests: FileText,
  deanery: MessagesSquare,
  feedback: MessageSquareHeart,
  tasks: ListChecks,
  people: Contact,
  'ai-assistant': Sparkles,
  settings: Settings,
  calendar: CalendarPlus,
};

function sectionIconFor(id: string): LucideIcon {
  return SECTION_ICONS[id] ?? KeyRound;
}

/** Оглавление (якорная навигация) по отфильтрованным разделам. */
function Toc({ sections }: { sections: HelpSection[] }) {
  return (
    <ul className="grid gap-1">
      {sections.map((section) => {
        const Icon = sectionIconFor(section.id);
        return (
          <li key={section.id} className="min-w-0">
            <a
              href={`#${section.id}`}
              data-testid={`guide-toc-${section.id}`}
              className="flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-muted focus-visible:outline-2"
            >
              <Icon className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{section.title}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function HelpSearch({
  sections,
  locale = 'ru',
}: {
  sections: HelpSection[];
  locale?: Locale;
}) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  // Чистый фильтр живёт в lib/help-content — его покрывают юнит-тесты напрямую.
  const results = useMemo(() => filterHelpSections(trimmed, sections), [trimmed, sections]);
  const searching = trimmed !== '';

  return (
    <div data-testid="guide-browser" className="mt-5">
      {/* Поле поиска: ввод сразу фильтрует разделы по заголовкам и тексту. */}
      <label htmlFor="guide-search" className="block text-base font-extrabold tracking-heading">
        {t(locale, 'guide.search.label')}
      </label>
      <div className="relative mt-2">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="guide-search"
          data-testid="guide-search"
          type="search"
          placeholder={t(locale, 'guide.search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-12 w-full rounded-card border border-input bg-card pl-11 pr-4 text-sm shadow-soft placeholder:text-muted-foreground focus-visible:outline-2"
        />
      </div>
      {searching ? (
        <p data-testid="guide-count" className="mt-2 text-xs text-muted-foreground" role="status">
          {t(locale, 'guide.search.count', {
            count: results.length,
            label: guideStepCountLabel(results.length, locale),
          })}
        </p>
      ) : null}

      {/* Оглавление: десктоп — постоянная колонка, мобильный — details/summary. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-6">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          {/* Мобильный: свёрнутое оглавление. */}
          <details className="rounded-card border border-border bg-card p-3 shadow-soft lg:hidden">
            <summary className="cursor-pointer select-none text-sm font-extrabold tracking-heading">
              {t(locale, 'guide.toc')}
            </summary>
            <div className="mt-1">
              <Toc sections={results} />
            </div>
          </details>
          {/* Десктоп ≥1024: постоянная колонка оглавления. */}
          <nav
            aria-label={t(locale, 'guide.tocAria')}
            className="hidden min-w-0 overflow-hidden rounded-card border border-border bg-card p-3 shadow-soft lg:block"
          >
            <p className="text-sm font-extrabold tracking-heading">{t(locale, 'guide.toc')}</p>
            <div className="mt-2">
              <Toc sections={results} />
            </div>
          </nav>
        </aside>

        <div className="grid gap-4">
          {results.map((section) => {
            const Icon = sectionIconFor(section.id);
            return (
              <section
                key={section.id}
                id={section.id}
                data-testid={`guide-section-${section.id}`}
                className="scroll-mt-24 rounded-card border border-border bg-card p-4 shadow-soft md:p-5"
              >
                <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-heading">
                  <Icon className="size-5 shrink-0 text-coral-600" aria-hidden="true" />
                  {section.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{section.summary}</p>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:font-bold marker:text-coral-600">
                  {section.steps.map((step, index) => (
                    <li key={index}>
                      {step.text}
                      {step.link ? (
                        <Link
                          href={step.link.href}
                          data-testid={`guide-step-link-${section.id}-${index}`}
                          className="mt-0.5 inline-flex items-center gap-1 text-accent-ink underline decoration-accent-soft decoration-2 underline-offset-2 hover:decoration-accent-ink"
                        >
                          {step.link.label}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {section.callouts && section.callouts.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {section.callouts.map((callout) => (
                      <Callout key={callout.kind} callout={callout} locale={locale} />
                    ))}
                  </div>
                ) : null}
                <div className="mt-3">
                  <Link
                    href={section.href}
                    data-testid={`guide-open-${section.id}`}
                    className="inline-flex min-h-9 items-center rounded-pill border border-border px-3.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-soft focus-visible:outline-2"
                  >
                    {t(locale, 'guide.openSection')}
                  </Link>
                </div>
              </section>
            );
          })}

          {/* Ноль результатов — подсказка, а не тупик. */}
          {searching && results.length === 0 ? (
            <div
              data-testid="guide-empty"
              role="status"
              className="rounded-card border border-dashed border-border bg-card p-6 text-center shadow-soft"
            >
              <p className="text-sm font-extrabold tracking-heading">
                {emptySearchMessage(locale)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{emptySearchHint(locale)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
