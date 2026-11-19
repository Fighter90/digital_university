// DIG-68 — карточка проекта в ленте «МСП» (по образцу Product Hunt):
// логотип-квадрат слева, заголовок + слоган + теги, кнопка «▲» с числом
// голосов. Клик по заголовку / «Подробнее» → карточка /msp/<slug>.
// Форма кнопки голоса — сосед блока с ссылкой (не вложена в <a>).
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';

import { MspLetterBadge } from '@/components/msp/msp-letter-badge';
import { MspVoteButton } from '@/components/msp/msp-vote-button';
import type { MspProjectView } from '@/server/data';
import { t, type Locale } from '@/lib/i18n';
import { localizedMspProject, localizePersonName } from '@/lib/en-demo-content';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const dateFormatterEn = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' });

export function MspProjectCard({
  view,
  canVote = true,
  locale = 'ru',
}: {
  view: MspProjectView;
  canVote?: boolean;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const { votes, votedByMe, comments } = view;
  // DIG-89/93 — EN-рендер демо-проекта: титул/слоган из словаря по id,
  // автор — транслит. RU — как в сиде, байт-в-байт.
  const { project } =
    locale === 'en'
      ? {
          project: {
            ...view.project,
            ...localizedMspProject('en', view.project),
            authorName: localizePersonName('en', view.project.authorName),
          },
        }
      : view;
  return (
    <article
      data-testid={`msp-card-${project.slug}`}
      className="flex items-start gap-3 rounded-card border border-border bg-card p-4 shadow-soft"
    >
      <MspVoteButton
        projectId={project.id}
        votes={votes}
        votedByMe={votedByMe}
        testId={`msp-vote-${project.slug}`}
        canVote={canVote}
        locale={locale}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <MspLetterBadge project={project} />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">
              <Link
                href={`/msp/${project.slug}`}
                data-testid={`msp-link-${project.slug}`}
                className="hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-coral-600"
              >
                {project.title}
              </Link>
            </h3>
            <p className="text-xs text-muted-foreground">
              {project.authorName} ·{' '}
              {(locale === 'en' ? dateFormatterEn : dateFormatter).format(project.createdAt)}
            </p>
          </div>
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.tagline}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-pill border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              {tag}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="size-3.5" aria-hidden="true" />
            {comments}
          </span>
          <Link
            href={`/msp/${project.slug}`}
            className="text-xs font-medium text-accent-ink hover:underline"
          >
            {t(locale, 'msp.card.more')}
          </Link>
        </div>
      </div>
    </article>
  );
}
