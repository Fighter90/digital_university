// DIG-42 — карточка «Моей программы» /dpo: демо-прогресс (полоса по
// progressPercent, паттерн полосы из «Успеваемости») и «Продолжить» —
// заглушка-линк (переход к материалам в полной версии, прототип).
import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n';
import type { DpoMyProgramView } from '@/server/data';

export function DpoMyProgramCard({
  view,
  locale = 'ru',
}: {
  view: DpoMyProgramView;
  locale?: Locale;
}) {
  const { enrollment, program } = view;
  const percent = Math.min(100, Math.max(0, enrollment.progressPercent));
  return (
    <article
      data-testid={`dpo-my-${program.slug}`}
      className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-soft"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug">{program.title}</h3>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
          {t(locale, 'dpo.my.progressOf', { percent })}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t(locale, 'dpo.my.progressAria', { title: program.title })}
        className="h-2 overflow-hidden rounded-pill bg-muted"
      >
        <div className="h-full rounded-pill bg-accent" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {program.facultyTag} · {t(locale, 'dpo.card.hours', { hours: program.hours })}
        </span>
        {/* Заглушка-линк: материалы курса существуют только в полной версии. */}
        <Link
          href="#"
          title={t(locale, 'dpo.my.continueHint')}
          data-testid={`dpo-continue-${program.slug}`}
          className="rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-coral-200 hover:bg-coral-50"
        >
          {t(locale, 'dpo.continue')}
        </Link>
      </div>
    </article>
  );
}
