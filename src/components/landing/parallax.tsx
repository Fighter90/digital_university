'use client';

// DIG-90 — параллакс-декор лендинга: градиентные пятна, смещающиеся
// с прокруткой с разной скоростью. Без внешних зависимостей: rAF +
// пассивный scroll-листенер. Прогрессивные улучшения и доступность:
// - prefers-reduced-motion: reduce — слои статичны (transform не меняется);
// - html.a11y-no-effects (DIG-86) — эффекты отключены, слои статичны;
// - без window/jsdom — рендер без смещений, контент не зависит от слоя.
import { useEffect, useRef } from 'react';

type Layer = { className: string; speed: number; initial?: string };

const LAYERS: Layer[] = [
  // большое тёплое пятно за hero — плывёт медленно
  {
    className:
      'absolute -top-40 left-[8%] size-[36rem] rounded-full bg-accent-soft blur-3xl sm:size-[44rem]',
    speed: 0.12,
  },
  // коралловое — справа, быстрее
  {
    className: 'absolute top-64 -right-32 size-96 rounded-full bg-coral-100 blur-3xl',
    speed: 0.22,
  },
  // голубое — слева ниже, ещё быстрее (ощущение глубины)
  {
    className: 'absolute top-[52rem] -left-40 size-[30rem] rounded-full bg-accent-soft blur-3xl',
    speed: 0.3,
  },
];

export function ParallaxOrbs() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const layers = Array.from(root.children) as HTMLElement[];

    // jsdom/старые окружения: без matchMedia эффект отключён (слои статичны)
    if (typeof window.matchMedia !== 'function') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flat = document.documentElement.classList.contains('a11y-no-effects');
    if (reduced || flat) return; // слои остаются на initial-позициях

    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = window.scrollY;
      for (const layer of layers) {
        const speed = Number(layer.dataset.speed ?? '0.15');
        layer.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {LAYERS.map((layer, i) => (
        <div key={i} data-speed={layer.speed} className={layer.className} />
      ))}
    </div>
  );
}
