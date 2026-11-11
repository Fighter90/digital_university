import Link from 'next/link';
import { GraduationCap, Layers, TriangleAlert, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { Icon } from '@/components/ui/icon';

// DIG-20: единственный тёмный блок на главной — hero «Ваша неделя» с
// коралловым свечением (референс: тёмный hero ResumeCraft). Плитки 2×2 на
// 360 px (grid-cols-2) и в одну линию от 640 px; каждая ведёт в свой раздел.

export interface HeroTileView {
  key: string;
  label: string;
  value: string;
  hint: string;
  href: string;
  icon: LucideIcon;
}

export interface WeekHeroProps {
  /** «Ваша неделя · среда, 11 ноября» — h1 экрана. */
  heading: string;
  /** «Добрый день, Анна!» */
  greetingLine: string;
  /** Детерминированная строка-резюме из данных; null → не рендерим. */
  summary: string | null;
  tiles: HeroTileView[];
}

export function WeekHero({ heading, greetingLine, summary, tiles }: WeekHeroProps) {
  return (
    <section
      aria-label="Ваша неделя"
      className="hero-glow rounded-block bg-neutral-900 px-5 py-6 text-white sm:px-8 sm:py-8"
    >
      <p className="text-sm font-medium text-white/70">{greetingLine}</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-heading sm:text-3xl">{heading}</h1>
      {summary ? (
        <p data-testid="dashboard-summary" className="mt-2 text-sm text-white/80 sm:text-base">
          {summary}
        </p>
      ) : null}

      <div
        data-testid="hero-tiles"
        className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
      >
        {tiles.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            className="lift-hover flex flex-col gap-1 rounded-card border border-white/10 bg-white/10 p-3.5 outline-offset-2 transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-white sm:p-4"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-white/70">
              <Icon icon={tile.icon} size={16} className="text-coral-400" />
              {tile.label}
            </span>
            <span className="text-2xl font-extrabold tracking-heading sm:text-3xl">
              {tile.value}
            </span>
            <span className={cn('text-xs', tile.hint ? 'text-white/70' : 'hidden')}>{tile.hint}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Иконки плиток героя — единый словарь, чтобы порядок плиток был стабильным. */
export const HERO_TILE_ICONS = {
  average: GraduationCap,
  credits: Layers,
  debts: TriangleAlert,
  requests: ClipboardList,
} as const;
