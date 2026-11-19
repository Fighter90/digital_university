'use client';

// DIG-90 — анимированные счётчики лендинга: число «докручивается» до значения,
// когда полоса попадает во вьюпорт (IntersectionObserver + rAF).
// Доступность: prefers-reduced-motion или html.a11y-no-effects (DIG-86) —
// значение показывается сразу, без анимации; без IntersectionObserver — тоже.
import { useEffect, useRef, useState } from 'react';

export function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  // Стартуем с финального значения: без JS / в jsdom / в a11y-режиме число
  // просто видно сразу; анимация (если разрешена) перезапишет его от нуля.
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // jsdom/старые окружения: без matchMedia анимации нет — значение уже показано
    if (typeof window.matchMedia !== 'function') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flat = document.documentElement.classList.contains('a11y-no-effects');
    if (reduced || flat || typeof IntersectionObserver === 'undefined') return;

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1100;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(Math.round(value * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref}>
      {shown}
      {suffix}
    </span>
  );
}
