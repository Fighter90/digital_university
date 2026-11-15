'use client';

// DIG-66 — карточка «Что изменилось»: AI-объяснение динамики среднего балла
// с интерактивным графиком (тренд Product Hunt: AI-анализ данных →
// интерактивные визуалы). Логика детерминированная, без LLM и сети —
// расчёт и тексты приходят готовыми из buildGradeInsight (RSC → DTO
// с ISO-датами), здесь только представление и интерактив.
//
// Интерактив (приёмка): наведение / фокус / нажатие на точку графика
// показывает, какие работы сформировали средний на эту дату. Точки —
// обычные кнопки (доступны с клавиатуры, читаются скринридером); разбор
// активной точки — aria-live область под графиком, поэтому всплывающих
// popover'ов нет и вёрстка не ломается на 360 px.
import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { formatDateShort, formatScore } from '@/lib/performance-format';
import type { GradeInsight, InsightPoint } from '@/lib/grade-insight';
import { cn } from '@/lib/utils';

/** Геометрия точки: x/y в процентах контейнера графика. */
function pointGeometry(points: InsightPoint[], index: number): { x: number; y: number } {
  const n = points.length;
  const x = n === 1 ? 50 : (index / (n - 1)) * 100;
  const values = points.map((p) => p.average);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(3, (hi - lo) * 0.15);
  const domainLo = Math.max(0, lo - pad);
  const domainHi = Math.min(100, hi + pad);
  const y =
    domainHi - domainLo <= 0
      ? 50
      : 100 - ((points[index].average - domainLo) / (domainHi - domainLo)) * 100;
  return { x, y };
}

export function GradeInsightCard({ insight }: { insight: GradeInsight }) {
  // По умолчанию раскрыта последняя точка — актуальный разбор без действий.
  const [active, setActive] = useState(insight.points.length - 1);
  const points = insight.points;
  const currentPoint = points[Math.min(active, points.length - 1)];
  const coords = points.map((_, i) => pointGeometry(points, i));
  const line = coords.map(({ x, y }) => `${x},${100 - y}`).join(' ');

  const currentDate = new Date(currentPoint.dateISO);
  const activeIndex = points.indexOf(currentPoint);

  return (
    <section
      data-testid="grade-insight"
      className="animate-rise rounded-card border border-border bg-card p-5 shadow-soft"
      style={{ '--du-rise-delay': '90ms' } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-extrabold tracking-heading">
          <Sparkles aria-hidden="true" className="size-4 text-accent-ink" />
          Что изменилось
        </h2>
        <Badge status="accent">AI-анализ</Badge>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Демо-анализ по вашим оценкам {insight.semesterLabel.toLowerCase()}, без внешних сервисов.
      </p>

      <p data-testid="grade-insight-headline" className="mt-3 text-sm font-semibold leading-snug">
        {insight.headline}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{insight.detail}</p>

      {/* График: SVG-линия как фон, точки — кнопки поверх (focus/hover/click). */}
      <div className="relative mt-4 h-28" role="group" aria-label="График среднего балла">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          {/* базовая линия 0% */}
          <line
            x1="0"
            y1="100"
            x2="100"
            y2="100"
            style={{ stroke: 'var(--border)' }}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {points.length > 1 ? (
            <polyline
              points={line}
              fill="none"
              style={{ stroke: 'var(--accent)' }}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        {points.map((point, i) => {
          const { x, y } = coords[i];
          const date = new Date(point.dateISO);
          return (
            <button
              key={point.dateISO}
              type="button"
              data-testid="insight-point"
              aria-pressed={i === activeIndex}
              aria-label={`${formatDateShort(date)} — средний балл ${formatScore(point.average)} из 100`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={cn(
                'absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-150',
                // расширенная зона касания для 360 px
                'after:absolute after:-inset-2 after:rounded-pill after:content-[""]',
                'focus-visible:outline-2',
                i === activeIndex
                  ? 'border-accent bg-accent'
                  : 'border-accent-soft bg-card hover:border-accent',
              )}
            />
          );
        })}
      </div>

      {/* Разбор активной точки: какие работы сформировали средний. */}
      <div
        data-testid="insight-works"
        aria-live="polite"
        className="mt-3 rounded-button bg-muted p-3"
      >
        <p className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs">
          <span className="font-semibold">
            {formatDateShort(currentDate)} — средний балл{' '}
            <span data-testid="grade-insight-current">{formatScore(currentPoint.average)}</span> из
            100
          </span>
          {currentPoint.delta !== null ? (
            <span
              className={cn(
                'font-semibold',
                currentPoint.delta > 0
                  ? 'text-success-ink'
                  : currentPoint.delta < 0
                    ? 'text-error-ink'
                    : 'text-muted-foreground',
              )}
            >
              {currentPoint.delta > 0 ? '+' : currentPoint.delta < 0 ? '−' : ''}
              {formatScore(Math.abs(currentPoint.delta))} к предыдущей
            </span>
          ) : (
            <span className="text-muted-foreground">первая работа семестра</span>
          )}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Работы в среднем ({currentPoint.works.length}):
        </p>
        <ul className="mt-1 flex flex-col gap-1">
          {currentPoint.works.map((work) => (
            <li
              key={`${work.elementName}-${work.dateISO}`}
              data-testid="insight-work"
              className="flex items-baseline justify-between gap-2 text-xs"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{work.elementName}</span>
                <span aria-hidden="true"> · </span>
                <span className="text-muted-foreground">{work.disciplineName}</span>
              </span>
              <span className="shrink-0 font-semibold">
                {work.score} из {work.maxScore}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
