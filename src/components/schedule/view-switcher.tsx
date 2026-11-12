'use client';

import { useEffect, useRef } from 'react';
import { cn } from 'cn';

// DIG-23: ViewSwitcher — переключатель День / Неделя / Месяц поверх
// радиогруппы ССЫЛОК (визуал и a11y-контракт Segmented DIG-13: radiogroup +
// radio, roving tabindex, стрелки ←/→ перемещают фокус).
//
// Почему обычные <a>, а не next/link + router.push: soft-навигация (и
// router.push, и перехваченные Link-переходы) между поисковыми вариантами
// страницы расписания изолированным прогоном матрицы переходов
// детерминированно не коммитится (RSC отвечает 200 валидным деревом,
// а переход «залипает» на старом виде; направление застревания меняется от
// сборки к сборке — week→day / week→month / day→month по очереди). Полная
// загрузка ?view=… работает всегда (все прямые заходы зелёные), поэтому вид
// переключается нативной навигацией обычной ссылки — она работает даже до
// гидрации и без JS. URL остаётся честным: ?view=… с переносом контекста
// (см. buildViewHref — канонические полные URL), вид переживает перезагрузку
// и делится ссылкой. Все три вида доступны на обоих брейкпоинтах. Дефолт без
// ?view= считает страница: десктоп открывает неделю, мобильный — «сегодня»
// (лента дат).
//
// Текущий query приходит ПРОПОСОМ currentQuery, «сегодня» — пропсом todayKey
// (детерминированная дата от сервера): клиентские useSearchParams и new Date()
// не используются — они дают расхождения SSR/гидрации и подвешивают
// soft-навигацию без Suspense-границы.
import { buildViewHref, parseDateKey, type ScheduleView } from '@/lib/schedule-cards';

export interface ViewSwitcherProps {
  /** Вид, отмеченный на ЭТОМ брейкпоинте (десктоп и мобильный могут различаться в auto-режиме). */
  view: ScheduleView;
  /** Только для data-testid и aria-label — поведение переключателя одинаковое. */
  platform: 'desktop' | 'mobile';
  /** Query текущего URL без ведущего «?» (?view/&date/&week/&month); пустая строка — дефолт. */
  currentQuery: string;
  /** Московский ключ «сегодня» («2026-11-12») — для buildViewHref (детерминизм SSR). */
  todayKey: string;
}

const VIEWS: ReadonlyArray<{ value: ScheduleView; label: string }> = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

export function ViewSwitcher({ view, platform, currentQuery, todayKey }: ViewSwitcherProps) {
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);
  // now нужен buildViewHref только для фокуса месяца; серверный todayKey
  // делает href одинаковым на сервере и после гидрации.
  const now = parseDateKey(todayKey) ?? new Date();

  const selectedIndex = Math.max(
    VIEWS.findIndex((option) => option.value === view),
    0,
  );

  const move = (delta: number) => {
    const next = (selectedIndex + delta + VIEWS.length) % VIEWS.length;
    refs.current[next]?.focus();
  };

  // Маркер гидрации: стрелки и roving tabindex живут на обработчиках, которые
  // появляются после гидрации (ссылки кликабельны и до неё — урок DIG-50).
  // data-hydrated="true" — сигнал готовности к интерактиву для e2e.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    rootRef.current?.setAttribute('data-hydrated', 'true');
  }, []);

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={`Вид расписания (${platform === 'desktop' ? 'основной' : 'мобильный'})`}
      data-testid={`view-switcher-${platform}`}
      data-hydrated="false"
      className="inline-flex rounded-pill border border-border bg-card p-1"
    >
      {VIEWS.map((option, i) => {
        const selected = option.value === view;
        const href = buildViewHref(new URLSearchParams(currentQuery), option.value, now);
        return (
          <a
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            href={href}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey) return;
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(-1);
              } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                move(1);
              }
            }}
            className={cn(
              'h-8 rounded-pill px-4 text-sm font-medium transition-colors',
              selected
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </a>
        );
      })}
    </div>
  );
}
