'use client';

// DIG-57 — плавное появление блоков лендинга при прокрутке: чистый
// IntersectionObserver без внешних зависимостей. Прогрессивное улучшение:
// без IntersectionObserver (jsdom, старые окружения) контент отображается
// сразу; CSS-стили .reveal применяются только при
// prefers-reduced-motion: no-preference — скрытого контента не остаётся.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** каскадная задержка появления, мс */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const classes = ['reveal', visible && 'reveal-visible', className].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      data-reveal=""
      className={classes}
      style={delay ? ({ '--du-reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
