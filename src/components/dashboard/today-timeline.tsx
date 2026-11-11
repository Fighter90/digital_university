import Link from 'next/link';
import { CalendarX2, Clock, MapPin, ArrowRight } from 'lucide-react';
import { cn } from 'cn';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Icon } from '@/components/ui/icon';
import type { DashboardSection, TodayView } from '@/server/data/dashboard';
import type { ScheduleKind } from '@/server/data/types';

// DIG-20: «Сегодня» — таймлайн пар: время, тип-пилюля, дисциплина,
// аудитория, преподаватель. Перенесённая пара — пунктир + жёлтый фон с
// подписью «Перенос: ауд. 214 → 305»; отменённая — зачёркнута; пара в
// онлайн-формате даёт ссылку «Онлайн». Пустой день — иллюстрация и
// ближайший учебный день.

const KIND_PILL: Record<ScheduleKind, string> = {
  LECTURE: 'bg-lesson-lecture-soft text-lesson-lecture-ink',
  PRACTICE: 'bg-lesson-seminar-soft text-lesson-seminar-ink',
  LAB: 'bg-lesson-lab-soft text-lesson-lab-ink',
  SEMINAR: 'bg-lesson-seminar-soft text-lesson-seminar-ink',
  CONSULTATION: 'bg-muted text-muted-foreground',
};

export interface TodayTimelineProps {
  section: DashboardSection<TodayView>;
}

export function TodayTimeline({ section }: TodayTimelineProps) {
  if (!section.ok) {
    return <ErrorState title="Блок «Сегодня» не загрузился" description="Обновите страницу — остальные блоки на месте." />;
  }
  const { lessons, nearestStudyDay } = section.value;

  return (
    <section aria-labelledby="dashboard-today-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dashboard-today-heading" className="text-lg font-extrabold tracking-heading sm:text-xl">
          Сегодня
        </h2>
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
        >
          Всё расписание
          <Icon icon={ArrowRight} size={14} />
        </Link>
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Нет пар сегодня"
          description={
            nearestStudyDay
              ? `Ближайший учебный день — ${nearestStudyDay.label} (${nearestStudyDay.count} пар).`
              : 'Расписание ближайших дней появится здесь.'
          }
          action={
            <Link href="/schedule" className="text-sm font-medium text-accent-ink hover:underline">
              Открыть расписание
            </Link>
          }
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {lessons.map((lesson) => (
            <li
              key={lesson.id}
              className={cn(
                'flex items-start gap-3 rounded-card border border-border bg-card p-4 shadow-soft',
                lesson.isRescheduled && 'hatch-rescheduled bg-warning-soft',
                lesson.isCancelled && 'opacity-60',
              )}
            >
              <span className="flex w-16 shrink-0 flex-col items-start pt-0.5 text-sm font-bold tracking-heading sm:w-20">
                {lesson.timeLabel.split('–')[0]}
                <span className="text-xs font-medium text-muted-foreground">
                  {lesson.timeLabel.split('–')[1]}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex w-fit items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold',
                      KIND_PILL[lesson.kind],
                    )}
                  >
                    {lesson.kindLabel}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold sm:text-base',
                      lesson.isCancelled && 'line-through',
                    )}
                  >
                    {lesson.disciplineName}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
                  {lesson.teacherName}
                </p>
                {lesson.isRescheduled && lesson.transferNote ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-warning-ink">
                    <Icon icon={Clock} size={13} />
                    {lesson.transferNote}
                  </p>
                ) : null}
                {lesson.isCancelled && lesson.note ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{lesson.note}</p>
                ) : null}
              </div>

              {lesson.isOnline ? (
                <Link
                  href="/schedule"
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-pill border border-info-soft bg-info-soft px-2.5 py-1 text-xs font-semibold text-info-ink hover:underline"
                >
                  Онлайн
                </Link>
              ) : (
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-pill border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <Icon icon={MapPin} size={13} />
                  {lesson.isCancelled ? `была ауд. ${lesson.room}` : `ауд. ${lesson.room}`}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
