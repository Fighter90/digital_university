// DIG-68 — список комментариев проекта на карточке /msp/<slug>, старые
// сверху. Комментарии читают все вошедшие (каталог общий), пишет — только
// студент от лица своей сессии (форма отдельно, owner-scoped action).
import type { MspCommentRow } from '@/server/data/types';
import { localizedMspComment, localizePersonName } from '@/lib/en-demo-content';
import { t, type Locale } from '@/lib/i18n';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormatterEn = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function MspCommentList({
  comments,
  locale = 'ru',
}: {
  comments: MspCommentRow[];
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (comments.length === 0) {
    return (
      <p data-testid="msp-comments-empty" className="text-sm text-muted-foreground">
        {t(locale, 'msp.comments.empty')}
      </p>
    );
  }
  return (
    <ul data-testid="msp-comment-list" className="flex flex-col gap-3">
      {comments.map((comment) => (
        <li
          key={comment.id}
          data-testid={`msp-comment-${comment.id}`}
          className="rounded-card border border-border bg-card p-4 shadow-soft"
        >
          <p className="text-sm font-semibold">{localizePersonName(locale, comment.authorName)}</p>
          <p className="text-xs text-muted-foreground">{(locale === 'en' ? dateFormatterEn : dateFormatter).format(comment.createdAt)}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground">{localizedMspComment(locale, comment)}</p>
        </li>
      ))}
    </ul>
  );
}
