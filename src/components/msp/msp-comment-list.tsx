// DIG-68 — список комментариев проекта на карточке /msp/<slug>, старые
// сверху. Комментарии читают все вошедшие (каталог общий), пишет — только
// студент от лица своей сессии (форма отдельно, owner-scoped action).
import type { MspCommentRow } from '@/server/data/types';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function MspCommentList({ comments }: { comments: MspCommentRow[] }) {
  if (comments.length === 0) {
    return (
      <p data-testid="msp-comments-empty" className="text-sm text-muted-foreground">
        Комментариев пока нет — будьте первым.
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
          <p className="text-sm font-semibold">{comment.authorName}</p>
          <p className="text-xs text-muted-foreground">{dateFormatter.format(comment.createdAt)}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground">{comment.body}</p>
        </li>
      ))}
    </ul>
  );
}
