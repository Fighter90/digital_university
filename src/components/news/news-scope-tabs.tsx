'use client';

import { useEffect, useRef } from 'react';
import { cn } from 'cn';

import { NEWS_SCOPE_LABELS, type NewsScope } from '@/lib/news-catalog';

// DIG-36: NewsScopeTabs — переключатель вкладок скоупа новостей поверх
// радиогруппы ССЫЛОК (визуал и a11y-контракт ViewSwitcher расписания:
// radiogroup + radio, roving tabindex, стрелки ←/→ перемещают фокус).
// Нативные ссылки вместо router.push: вид переключается полной загрузкой
// ?scope=… — работает до гидрации и без JS, URL честный и делится ссылкой.
// Тема фильтра (?topic=…) переносится в href — фильтр не сбрасывается.

export interface NewsScopeTabsProps {
  /** Отмеченная (эффективная) вкладка на этом запросе. */
  scope: NewsScope;
  /** true — вкладка «Моя группа» недоступна (сотрудник без группы). */
  groupDisabled?: boolean;
  /** Query текущего URL без ведущего «?» (например, «topic=dormitory»). */
  currentQuery: string;
}

const ORDER: ReadonlyArray<NewsScope> = ['group', 'faculty', 'university'];

export function buildNewsHref(scope: NewsScope, currentQuery: string): string {
  const params = new URLSearchParams(currentQuery);
  const next = new URLSearchParams();
  next.set('scope', scope);
  const topic = params.get('topic');
  if (topic) next.set('topic', topic);
  const query = next.toString();
  return query ? `/news?${query}` : '/news';
}

export function NewsScopeTabs({ scope, groupDisabled = false, currentQuery }: NewsScopeTabsProps) {
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);

  const selectedIndex = Math.max(ORDER.indexOf(scope), 0);

  // Маркер гидрации: стрелки живут на обработчиках после гидрации,
  // ссылки кликабельны и до неё (урок DIG-50).
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    rootRef.current?.setAttribute('data-hydrated', 'true');
  }, []);

  const move = (delta: number) => {
    let next = selectedIndex + delta;
    while (next >= 0 && next < ORDER.length) {
      if (next === 0 && groupDisabled) {
        next += delta;
        continue;
      }
      refs.current[next]?.focus();
      return;
    }
  };

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label="Вкладки новостей"
      data-testid="news-scope-tabs"
      data-hydrated="false"
      className="inline-flex rounded-pill border border-border bg-card p-1"
    >
      {ORDER.map((option, i) => {
        const selected = option === scope;
        const disabled = option === 'group' && groupDisabled;
        return (
          <a
            key={option}
            ref={(el) => {
              refs.current[i] = el;
            }}
            href={buildNewsHref(option, currentQuery)}
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={(event) => {
              if (disabled) event.preventDefault();
            }}
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
              disabled && 'cursor-not-allowed opacity-50 hover:text-muted-foreground',
            )}
          >
            {NEWS_SCOPE_LABELS[option]}
          </a>
        );
      })}
    </div>
  );
}
