'use client';

import { useEffect, useState } from 'react';

// Период опроса счётчика непрочитанных: критерий приёмки DIG-14 —
// значение обновляется без перезагрузки страницы (раз в 60 секунд).
const POLL_MS = 60_000;

type UnreadBadgeProps = {
  count: number;
};

// Точка непрочитанных уведомлений на колокольчике и в меню.
// Начальное значение приходит с сервера, далее — polling /api/notifications/count.
export function UnreadBadge({ count: initialCount }: UnreadBadgeProps) {
  const [count, setCount] = useState(initialCount);

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

  if (count <= 0) return null;

  return (
    <span
      data-testid="unread-count"
      aria-hidden="true"
      className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral-500 px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
