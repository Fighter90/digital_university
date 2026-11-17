// DIG-68 — логотип-квадрат проекта каталога «МСП»: буква из названия на
// coral/accent-фоне. Фон детерминированный (хэш названия, НЕ random) —
// один и тот же проект выглядит одинаково в ленте, «Запуске дня» и карточке.
import type { MspProjectRow } from '@/server/data/types';

const LETTER_STYLES = [
  'bg-coral-100 text-coral-600',
  'bg-accent-soft text-accent-ink',
  'bg-coral-200 text-coral-600',
] as const;

/** Детерминированный фон по хэшу названия (одинаков между рендерами). */
export function mspLetterStyle(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % LETTER_STYLES.length;
  return LETTER_STYLES[index]!;
}

export function MspLetterBadge({
  project,
  size = 'md',
}: {
  project: Pick<MspProjectRow, 'title' | 'letter'>;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-card font-bold tracking-heading shadow-soft ${
        size === 'lg' ? 'size-16 text-3xl' : 'size-12 text-xl'
      } ${mspLetterStyle(project.title)}`}
    >
      {project.letter}
    </span>
  );
}
