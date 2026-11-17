import type { CSSProperties } from 'react';

/**
 * DIG-71 — каскадное (stagger) появление карточек в списках.
 * Возвращает inline-стиль с задержкой для утилиты `.animate-rise`
 * (globals.css, DIG-26): шаг 40 мс, максимум 11 шагов — даже в длинных
 * списках (справочник) последний элемент стартует не позже 440 мс.
 *
 * const style = riseDelayStyle(index);
 * <li className="animate-rise" style={style}>…</li>
 */
export function riseDelayStyle(index: number, stepMs = 40, maxSteps = 11): CSSProperties {
  return { '--du-rise-delay': `${Math.min(index, maxSteps) * stepMs}ms` } as CSSProperties;
}
