// DIG-68 — карточка проекта каталога «МСП» по публичному slug (никогда
// cuid). requireDataCtx() → openMspProjectView(): чтение — любой вошедший
// (каталог общий), несуществующий slug — единый контрактный 404 (как в
// /deanery/[number]; попытка пишется в аудит NOT_FOUND). Комментарий и
// голос — только студент (owner-scoped action, сессия = автор).
//
// NOTE: над этим сегментом НЕ должно быть loading.tsx — Suspense-граница
// стримит shell до notFound() и несуществующий slug ответил бы 200 вместо
// контрактного 404. Скелетон ленты живёт в соседнем route-group (feed).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, MessageSquare } from 'lucide-react';

import { normalizeMspSlug, requireDataCtx } from '@/server/data';
import { openMspProjectView } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { MspCommentForm } from '@/components/msp/msp-comment-form';
import { MspCommentList } from '@/components/msp/msp-comment-list';
import { MspLetterBadge } from '@/components/msp/msp-letter-badge';
import { MspVoteButton } from '@/components/msp/msp-vote-button';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { localizedMspProject } from '@/lib/en-demo-content';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dateFormatterEn = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default async function MspProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  let slug: string;
  try {
    slug = normalizeMspSlug(decodeURIComponent(rawSlug));
  } catch {
    // Некорректный percent-encoding (URIError) или пустой slug — тот же
    // контрактный 404, что для несуществующего проекта, а не 500.
    notFound();
  }
  const [ctx, locale] = await Promise.all([requireDataCtx(`/msp/${rawSlug}`), getLocale()]);

  const detail = await openMspProjectView(dataDb, ctx, slug);
  if (!detail) notFound();

  const { votes, votedByMe, comments } = detail;
  // DIG-89 — EN-рендер демо-проекта: титул/слоган/описание/теги по id.
  const project = { ...detail.project, ...localizedMspProject(locale, detail.project) };
  const canVote = ctx.role === 'STUDENT';

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/msp"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        {t(locale, 'msp.backToCatalog')}
      </Link>

      <article
        data-testid="msp-project"
        className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-soft"
      >
        <header className="flex items-start gap-4">
          <MspVoteButton
            projectId={project.id}
            votes={votes}
            votedByMe={votedByMe}
            testId="msp-project-vote"
            canVote={canVote}
            locale={locale}
          />
          <div className="flex min-w-0 items-start gap-3">
            <MspLetterBadge project={project} size="lg" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-heading">{project.title}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{project.tagline}</p>
              <p className="mt-1 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span data-testid="msp-project-author">{t(locale, 'msp.detail.author', { name: project.authorName })}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {(locale === 'en' ? dateFormatterEn : dateFormatter).format(project.createdAt)}
                </span>
              </p>
            </div>
          </div>
        </header>

        {project.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="msp-project-tags">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div>
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">{t(locale, 'msp.detail.about')}</h2>
          <p
            className="whitespace-pre-line text-sm text-foreground"
            data-testid="msp-project-description"
          >
            {project.description}
          </p>
        </div>

        {/* Команда-строка: автор проекта (в концепте каждый запуск —
            студенческий проект с автором из вымышленного каталога). */}
        <p className="rounded-button bg-muted px-3 py-2 text-sm text-foreground">
          <span className="font-medium">{t(locale, 'msp.detail.teamLabel')}</span>{' '}
          <span data-testid="msp-project-team">{t(locale, 'msp.detail.team', { name: project.authorName })}</span>
        </p>
      </article>

      <section id="msp-comments" aria-label={t(locale, 'msp.comments.aria')} className="mt-6">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-4" aria-hidden="true" />
          {t(locale, 'msp.comments.title')}
          <span className="font-normal text-muted-foreground">({comments.length})</span>
        </h2>

        <div className="mt-3">
          <MspCommentList comments={comments} locale={locale} />
        </div>

        {canVote ? (
          <MspCommentForm projectId={project.id} locale={locale} />
        ) : (
          <p data-testid="msp-comments-staff-note" className="mt-3 text-sm text-muted-foreground">
            {t(locale, 'msp.comments.studentsOnly')}
          </p>
        )}
      </section>
    </section>
  );
}
