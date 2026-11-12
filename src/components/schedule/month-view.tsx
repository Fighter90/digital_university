import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from 'cn';

// DIG-23: MonthView — вид «Месяц» (Figma «04 · Расписание — месяц»).
// Сетка 7×N с понедельника: в ячейке число, цветные точки пар (до 4 + «+N»),
// «сегодня» выделено; клик по дню открывает вид «День» (?view=day&date=…).
// Серверный компонент: навигация по месяцам — ссылки, работает без JS и
// укладывается в 360 px (сетка сжимается, точки 6 px).
import { LESSON_KIND_META, WEEKDAY_SHORT, type MonthCellView } from '@/lib/schedule-cards';
import { Icon } from '@/components/ui/icon';

export interface MonthViewProps {
  monthLabel: string;
  semesterLabel: string;
  prevHref: string | null;
  nextHref: string | null;
  cells: MonthCellView[];
}

const arrowClasses =
  'inline-flex size-9 items-center justify-center rounded-button border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted';

export function MonthView({
  monthLabel,
  semesterLabel,
  prevHref,
  nextHref,
  cells,
}: MonthViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          {prevHref ? (
            <a href={prevHref} aria-label="Предыдущий месяц" className={arrowClasses}>
              <Icon icon={ChevronLeft} size={18} />
            </a>
          ) : (
            <span
              aria-label="Предыдущий месяц"
              aria-disabled="true"
              className={`${arrowClasses} cursor-not-allowed opacity-50`}
            >
              <Icon icon={ChevronLeft} size={18} />
            </span>
          )}
          {nextHref ? (
            <a href={nextHref} aria-label="Следующий месяц" className={arrowClasses}>
              <Icon icon={ChevronRight} size={18} />
            </a>
          ) : (
            <span
              aria-label="Следующий месяц"
              aria-disabled="true"
              className={`${arrowClasses} cursor-not-allowed opacity-50`}
            >
              <Icon icon={ChevronRight} size={18} />
            </span>
          )}
          <h2
            data-testid="month-title"
            className="ml-1 text-lg font-bold tracking-heading sm:text-xl"
          >
            {monthLabel}
          </h2>
          {semesterLabel ? (
            <span className="text-xs text-muted-foreground">{semesterLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[336px]">
          <div
            data-testid="month-weekdays"
            className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {WEEKDAY_SHORT.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div data-testid="month-grid" className="grid grid-cols-7 gap-1">
            {cells.map((cell) =>
              cell.inMonth ? (
                <a
                  key={cell.dateKey}
                  href={cell.href}
                  data-testid={`month-cell-${cell.dateKey}`}
                  data-today={cell.isToday ? 'true' : undefined}
                  aria-label={`${cell.dayNumber}, пар: ${cell.dots.length + cell.extra}`}
                  className={cn(
                    'flex min-h-14 flex-col items-center gap-1 rounded-card border px-1 py-1.5 text-center transition-colors sm:min-h-16',
                    cell.isToday
                      ? 'border-accent bg-accent-soft text-accent-ink shadow-soft'
                      : 'border-border bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-bold',
                      cell.isToday && 'rounded-pill bg-accent px-1.5 text-white',
                    )}
                  >
                    {cell.dayNumber}
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex min-h-1.5 flex-wrap items-center justify-center gap-0.5"
                  >
                    {cell.dots.map((kind, index) => (
                      <MonthDot key={`${cell.dateKey}-${index}`} kind={kind} />
                    ))}
                    {cell.extra > 0 ? (
                      <span className="text-[10px] font-semibold leading-none text-muted-foreground">
                        +{cell.extra}
                      </span>
                    ) : null}
                  </span>
                </a>
              ) : (
                <span key={cell.dateKey} className="text-sm text-foreground-muted/60">
                  {cell.dayNumber}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthDot({ kind }: { kind: MonthCellView['dots'][number] }) {
  return (
    <span
      data-testid="month-dot"
      aria-hidden="true"
      className={cn('size-1.5 rounded-pill', LESSON_KIND_META[kind].dot)}
    />
  );
}
