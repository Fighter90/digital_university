import { cn } from '@/lib/utils';
import { formatScoreDate } from '@/lib/gradebook';
import type { DisciplineCardPart, DisciplineGradeRowView } from '@/server/data';

// DIG-27 — части карточки дисциплины: формула оценки полосами («Контрольные
// 30% · ДЗ 20% · Экзамен 50%» с текущими баллами частей) и список отдельных
// оценок (элемент, дата, балл; пересдачи помечены).

const fillTone = (earned: number): string => {
  if (earned >= 85) return 'bg-success';
  if (earned >= 60) return 'bg-warning';
  return 'bg-error';
};

export function GradeFormula({ parts }: { parts: DisciplineCardPart[] }) {
  if (parts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        План контроля ещё не задан — формула оценки появится, когда деканат опубликует состав
        дисциплины.
      </p>
    );
  }

  return (
    <div data-testid="grade-formula" className="flex flex-col gap-3.5">
      {parts.map((part) => (
        <div key={part.kind} data-testid={`part-${part.kind}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-sm font-semibold text-foreground">
              {part.label}{' '}
              <span className="font-normal text-muted-foreground">{part.weightPercent}%</span>
            </span>
            {part.earnedPercent === null ? (
              <span className="text-xs font-medium text-muted-foreground">не оценено</span>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">
                {part.earnedPercent} из 100
              </span>
            )}
          </div>
          <div className="mt-1.5 h-2.5 rounded-pill bg-muted">
            <div
              className={cn(
                'h-full rounded-pill transition-[width]',
                part.earnedPercent === null ? '' : fillTone(part.earnedPercent),
              )}
              style={{ width: `${Math.min(100, Math.max(0, part.earnedPercent ?? 0))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GradeRows({ grades }: { grades: DisciplineGradeRowView[] }) {
  if (grades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Оценок пока нет — здесь появятся отдельные работы, тесты и экзамен.
      </p>
    );
  }

  return (
    <ul data-testid="grade-rows" className="flex flex-col gap-2">
      {grades.map((row) => (
        <li
          key={row.id}
          data-testid={`grade-row-${row.id}`}
          data-superseded={row.isLatest ? undefined : 'true'}
          className={cn(
            'rounded-card border border-border bg-card p-3.5 shadow-soft',
            !row.isLatest && 'opacity-70',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="min-w-0">
              <span className="text-sm font-semibold text-foreground">{row.elementName}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {row.kindLabel} ·{' '}
                <time dateTime={row.gradedAt.toISOString()} className="font-mono text-[11px]">
                  {formatScoreDate(row.gradedAt)}
                </time>
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-sm font-bold text-foreground">
                {row.score} из {row.maxScore}
              </span>
              {!row.isLatest ? (
                <span className="rounded-pill bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-ink">
                  пересдача, не учитывается
                </span>
              ) : null}
            </span>
          </div>
          {row.comment ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{row.comment}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
