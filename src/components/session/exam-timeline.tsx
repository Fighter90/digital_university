// DIG-28 — таймлайн экзаменов и зачётов экрана «Сессия» (Figma «05 ·
// Успеваемость — сессия»). Презентационный серверный компонент: дата,
// время, аудитория, преподаватель, тип и статус-пилюля (Допущен — зелёный,
// Не допущен — красный с причиной и действием, Сдано · N — зелёный,
// Пересдача — янтарный). Цвет — не единственный носитель смысла.
import Link from 'next/link';
import { ArrowRight, DoorOpen, User } from 'lucide-react';

import { formatSessionDate, formatSessionTime } from '@/lib/session-format';
import type { SessionExamItem } from '@/server/data/session';
import { Badge } from '@/components/ui/badge';

export function ExamTimeline({ exams }: { exams: SessionExamItem[] }) {
  return (
    <ul
      data-testid="session-timeline"
      className="flex flex-col gap-3"
      aria-label="Экзамены и зачёты сессии"
    >
      {exams.map((exam, index) => (
        <li
          key={exam.examId}
          data-testid={`exam-item-${exam.examId}`}
          style={{ '--du-rise-delay': `${index * 60}ms` } as React.CSSProperties}
          className="animate-rise flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-start sm:gap-4"
        >
          {/* Дата: крупный день + месяц (на мобильном — в строку с контентом). */}
          <div className="flex shrink-0 items-center gap-2 sm:w-16 sm:flex-col sm:items-center sm:gap-0 sm:pt-0.5">
            <span className="text-xl font-extrabold leading-none tracking-heading">
              {exam.date.getDate()}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatSessionDate(exam.date).split(' ')[1]}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="font-semibold">{exam.disciplineName}</p>
              <span className="text-xs text-muted-foreground">{exam.kindLabel}</span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {formatSessionTime(exam.startsAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <DoorOpen aria-hidden="true" className="size-3.5" />
                каб. {exam.room}
              </span>
              {exam.teacherName ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <User aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{exam.teacherName}</span>
                </span>
              ) : null}
            </p>

            {/* Не допущен: причина обязательна и всегда видна, с действием. */}
            {exam.status === 'NOT_ADMITTED' && exam.admissionReason ? (
              <div className="mt-2.5 rounded-button border border-error-soft bg-error-soft/50 p-2.5">
                <p data-testid="admission-reason" className="text-sm font-medium text-error-ink">
                  {exam.admissionReason}
                </p>
                {exam.actionHref ? (
                  <Link
                    data-testid="admission-action"
                    href={exam.actionHref}
                    className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline"
                  >
                    Что сдать
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <Badge
            data-testid="exam-status"
            status={exam.statusBadge}
            className="shrink-0 self-start sm:self-center"
          >
            {exam.statusLabel}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
