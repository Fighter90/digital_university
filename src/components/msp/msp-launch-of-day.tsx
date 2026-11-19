// DIG-68 — блок «Запуск дня» на /msp: проект с максимумом голосов, при
// равенстве — самый свежий (детерминировано в слое данных, НЕ random).
// Выделенная карточка с бренд-градиентом рамки и бейджем дня запуска.
import Link from 'next/link';
import { Rocket } from 'lucide-react';

import { MspLetterBadge } from '@/components/msp/msp-letter-badge';
import { MspVoteButton } from '@/components/msp/msp-vote-button';
import { t, type Locale } from '@/lib/i18n';
import type { MspProjectView } from '@/server/data';
import { localizedMspProject, localizePersonName } from '@/lib/en-demo-content';

export function MspLaunchOfDay({
  view,
  canVote = true,
  locale = 'ru',
}: {
  view: MspProjectView | null;
  canVote?: boolean;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (!view) return null;
  const { votes, votedByMe } = view;
  // DIG-89/93 — EN-рендер демо-проекта: титул/слоган из словаря по id,
  // автор — транслит. RU — как в сиде, байт-в-байт.
  const project =
    locale === 'en'
      ? {
          ...view.project,
          ...localizedMspProject('en', view.project),
          authorName: localizePersonName('en', view.project.authorName),
        }
      : view.project;
  return (
    <section
      data-testid="msp-launch-of-day"
      aria-label={t(locale, 'msp.day.title')}
      className="rounded-card border border-coral-200 bg-gradient-to-br from-coral-50/60 to-accent-soft/40 p-4 shadow-soft"
    >
      <p className="mb-2 inline-flex items-center gap-1.5 rounded-pill bg-coral-500 px-3 py-1 text-xs font-semibold text-white">
        <Rocket className="size-3.5" aria-hidden="true" />
        {t(locale, 'msp.day.title')}
      </p>
      <div className="flex items-start gap-3">
        <MspVoteButton
          projectId={project.id}
          votes={votes}
          votedByMe={votedByMe}
          testId="msp-vote-launch"
          compact
          canVote={canVote}
          locale={locale}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <MspLetterBadge project={project} />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">
                <Link
                  href={`/msp/${project.slug}`}
                  className="hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-coral-600"
                >
                  {project.title}
                </Link>
              </h2>
              <p className="text-xs text-muted-foreground">
                {t(locale, 'msp.day.author', { name: project.authorName })}
              </p>
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.tagline}</p>
        </div>
      </div>
    </section>
  );
}
