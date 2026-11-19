// DIG-42 — карточка программы в каталоге /dpo: часы, бейдж формата, цена
// («бесплатно для прототипа» или демо-цена), теги и кнопка «Записаться».
// Запись — обычная форма с server action (работает без JS, как в «МСП»);
// владелец уже записан → «Вы записаны ✓» (disabled); сотрудник каталог
// читает, кнопка недоступна.
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { t, type Locale, type TranslationKey } from '@/lib/i18n';
import { enrollDpoAction } from '@/server/actions/dpo';
import type { DpoCatalogView, DpoFormat } from '@/server/data';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dateFormatterEn = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long' });

const FORMAT_BADGE: Record<DpoFormat, 'info' | 'neutral' | 'accent'> = {
  ONLINE: 'info',
  OFFLINE: 'neutral',
  HYBRID: 'accent',
};

/** Ключ словаря по формату (типизированный индекс вместо шаблонной строки). */
const FORMAT_KEY: Record<DpoFormat, TranslationKey> = {
  ONLINE: 'dpo.format.online',
  OFFLINE: 'dpo.format.offline',
  HYBRID: 'dpo.format.hybrid',
};

/** «Бесплатно для прототипа» или демо-цена (реальной оплаты в прототипе нет). */
export function dpoPriceLabel(price: number, locale: Locale): string {
  return price === 0
    ? t(locale, 'dpo.price.free')
    : t(locale, 'dpo.price.rub', {
        price: price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU'),
      });
}

export function DpoProgramCard({
  view,
  canEnroll = true,
  locale = 'ru',
}: {
  view: DpoCatalogView;
  /** false — сотрудник: каталог читает, запись — только для студентов. */
  canEnroll?: boolean;
  locale?: Locale;
}) {
  const { program, enrolledByMe } = view;
  return (
    <article
      data-testid={`dpo-card-${program.slug}`}
      className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-soft"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={FORMAT_BADGE[program.format]}>{t(locale, FORMAT_KEY[program.format])}</Badge>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          {t(locale, 'dpo.card.hours', { hours: program.hours })}
        </span>
        <span className="ml-auto text-xs font-semibold text-accent-ink">
          {dpoPriceLabel(program.price, locale)}
        </span>
      </div>

      <h3 className="text-base font-semibold leading-snug">{program.title}</h3>
      <p className="line-clamp-2 text-sm text-muted-foreground">{program.description}</p>

      <p className="text-xs text-muted-foreground">
        {t(locale, 'dpo.card.startsAt', {
          date: (locale === 'en' ? dateFormatterEn : dateFormatter).format(program.startsAt),
        })}{' '}
        · {program.facultyTag}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {program.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-pill border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
          >
            {tag}
          </span>
        ))}
        <span className="ml-auto">
          {enrolledByMe ? (
            <span
              data-testid={`dpo-enrolled-${program.slug}`}
              title={t(locale, 'dpo.enroll.alreadyTitle')}
              className="inline-flex select-none items-center rounded-pill border border-success-soft bg-success-soft px-4 py-1.5 text-sm font-semibold text-success-ink"
            >
              {t(locale, 'dpo.enroll.done')}
            </span>
          ) : canEnroll ? (
            <form action={enrollDpoAction}>
              <input type="hidden" name="programId" value={program.id} />
              <button
                type="submit"
                data-testid={`dpo-enroll-${program.slug}`}
                className="rounded-pill bg-foreground px-4 py-1.5 text-sm font-semibold text-background shadow-soft transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
              >
                {t(locale, 'dpo.enroll')}
              </button>
            </form>
          ) : (
            <span
              title={t(locale, 'dpo.enroll.studentsOnly')}
              className="inline-flex select-none items-center rounded-pill border border-border bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground"
            >
              {t(locale, 'dpo.enroll')}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
