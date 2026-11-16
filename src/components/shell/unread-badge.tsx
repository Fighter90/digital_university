'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Период опроса счётчика непрочитанных: критерий приёмки DIG-14 —
// значение обновляется без перезагрузки страницы (раз в 60 секунд).
const POLL_MS = 60_000;

type UnreadBadgeProps = {
  count: number;
  /**
   * floating (по умолчанию) — бейдж на колокольчике top-bar: absolute внутри
   * relative-контейнера иконки (DIG-54). inline — статичный бейдж в строке
   * сайдбара: без absolute, чтобы никогда не позиционироваться относительно
   * сайдбара (на проде бейдж «уезжал» в угол <aside sticky>).
   */
  variant?: 'floating' | 'inline';
};

// Точка непрочитанных уведомлений на колокольчике и в меню.
// Начальное значение приходит с сервера, далее — polling /api/notifications/count.
export function UnreadBadge({ count: initialCount, variant = 'floating' }: UnreadBadgeProps) {
  const [count, setCount] = useState(initialCount);
  // DIG-35: синхронизация с пропом во время рендера (паттерн React
  // «adjusting state when a prop changes») — без setState-in-effect
  // (react-hooks/set-state-in-effect).
  const [prevInitialCount, setPrevInitialCount] = useState(initialCount);
  if (initialCount !== prevInitialCount) {
    setPrevInitialCount(initialCount);
    setCount(initialCount);
  }

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/notifications/count', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: unknown };
        if (alive && typeof data.count === 'number') {
          setCount(data.count);
        }
      } catch {
        // Сеть недоступна — повторим на следующем интервале.
      }
    };
    const interval = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  // DIG-35: после server action'ов экран вызывает router.refresh() — каркас
  // приносит свежее серверное значение: его подхватывает проверка пропа выше.

  if (count <= 0) return null;

  // floating: уголок на иконке (контейнер обязан быть relative — см. TopBar).
  // inline: элемент потока строки меню — позиционируется только сам собой.
  const position =
    variant === 'floating' ? 'absolute -top-0.5 -right-0.5 ring-2 ring-white' : 'static';

  return (
    <span
      data-testid="unread-count"
      aria-hidden="true"
      className={cn(
        position,
        'grid h-4 min-w-4 place-items-center rounded-full bg-coral-500 px-1 text-[10px] leading-none font-semibold text-white',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
