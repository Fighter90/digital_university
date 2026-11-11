'use client';

import { useRouter, useSearchParams } from 'next/navigation';

// DIG-23: ViewSwitcher — переключатель День / Неделя / Месяц поверх Segmented.
// Выбор вида — URL (?view=… с переносом контекста даты, см. buildViewHref):
// вид переживает перезагрузку и делится ссылкой. Все три вида доступны на
// обоих брейкпоинтах: «Неделя» на десктопе — недельная сетка DIG-22, на
// мобильном — компактный список по дням. Дефолт без ?view= считает страница:
// десктоп открывает неделю, мобильный — «сегодня» (лента дат).
import { Segmented } from '@/components/ui/segmented';
import { buildViewHref, type ScheduleView } from '@/lib/schedule-cards';

export interface ViewSwitcherProps {
  /** Вид, отмеченный на ЭТОМ брейкпоинте (десктоп и мобильный могут различаться в auto-режиме). */
  view: ScheduleView;
  /** Только для data-testid и aria-label — поведение переключателя одинаковое. */
  platform: 'desktop' | 'mobile';
}

export function ViewSwitcher({ view, platform }: ViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <div data-testid={`view-switcher-${platform}`}>
      <Segmented
        aria-label={`Вид расписания (${platform === 'desktop' ? 'основной' : 'мобильный'})`}
        value={view}
        onChange={(next) => {
          router.push(buildViewHref(new URLSearchParams(searchParams.toString()), next, new Date()));
        }}
        options={[
          { value: 'day', label: 'День' },
          { value: 'week', label: 'Неделя' },
          { value: 'month', label: 'Месяц' },
        ]}
      />
    </div>
  );
}
