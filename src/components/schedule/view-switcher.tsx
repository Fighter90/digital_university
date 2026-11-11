'use client';

import { useRouter } from 'next/navigation';

// DIG-23: ViewSwitcher — переключатель День / Неделя / Месяц поверх Segmented.
// Выбор вида — URL (?view=…, для «дня» сохраняется ?date=…): вид переживает
// перезагрузку и делится ссылкой. На десктопе «Неделя» недоступна до merge
// недельной сетки (DIG-22); на мобильном «Неделя» — компактный список дней.
import { Segmented } from '@/components/ui/segmented';
import type { ScheduleView } from '@/lib/schedule-cards';

export interface ViewSwitcherProps {
  view: ScheduleView;
  /** Ключ выбранного дня — сохраняется при переключении на «День». */
  dateKey: string;
  /** «desktop» — «Неделя» отключена (DIG-22), «mobile» — все виды доступны. */
  platform: 'desktop' | 'mobile';
}

export function ViewSwitcher({ view, dateKey, platform }: ViewSwitcherProps) {
  const router = useRouter();
  return (
    <div data-testid={`view-switcher-${platform}`}>
      <Segmented
        aria-label={`Вид расписания (${platform === 'desktop' ? 'основной' : 'мобильный'})`}
        value={view}
        onChange={(next) => {
          const params = new URLSearchParams({ view: next });
          if (next === 'day') params.set('date', dateKey);
          router.push(`/schedule?${params.toString()}`);
        }}
        options={[
          { value: 'day', label: 'День' },
          { value: 'week', label: 'Неделя', disabled: platform === 'desktop' },
          { value: 'month', label: 'Месяц' },
        ]}
      />
    </div>
  );
}
