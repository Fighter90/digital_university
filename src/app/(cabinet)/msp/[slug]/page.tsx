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

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
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
  const ctx = await requireDataCtx(`/msp/${rawSlug}`);

  const detail = await openMspProjectView(dataDb, ctx, slug);
  if (!detail) notFound();

  const { project, votes, votedByMe, comments } = detail;
  const canVote = ctx.role === 'STUDENT';

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <Link
        href="/msp"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← В каталог стартапов
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
          />
          <div className="flex min-w-0 items-start gap-3">
            <MspLetterBadge project={project} size="lg" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-heading">{project.title}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{project.tagline}</p>
              <p className="mt-1 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span data-testid="msp-project-author">Автор: {project.authorName}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {dateFormatter.format(project.createdAt)}
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
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">О проекте</h2>
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
          <span className="font-medium">Команда:</span>{' '}
          <span data-testid="msp-project-team">{project.authorName} — автор проекта</span>
        </p>
      </article>

      <section id="msp-comments" aria-label="Комментарии" className="mt-6">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-4" aria-hidden="true" />
          Комментарии
          <span className="font-normal text-muted-foreground">({comments.length})</span>
        </h2>

        <div className="mt-3">
          <MspCommentList comments={comments} />
        </div>

        {canVote ? (
          <MspCommentForm projectId={project.id} />
        ) : (
          <p data-testid="msp-comments-staff-note" className="mt-3 text-sm text-muted-foreground">
            Комментарии доступны студентам.
          </p>
        )}
      </section>
    </section>
  );
}
