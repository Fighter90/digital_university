// DIG-69 — переключатель языка кабинета RU/EN в шапке Shell.
//
// Сегмент-контрол из двух кнопок одной формы с server action setLocale:
// активная локаль — по cookie (проп locale); кнопки с name="locale"
// отдают значение обычным POST — работает и без JavaScript.
// Компактный (два тапа-цели 28 px), помещается в шапку 360 px.
import { setLocale } from '@/server/actions/locale';
import { LOCALES, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const LABELS: Record<Locale, string> = { ru: 'RU', en: 'EN' };

export function LocaleSwitch({ locale }: { locale: Locale }) {
  return (
    <form
      action={setLocale}
      data-testid="locale-switch"
      aria-label="Язык интерфейса / Language"
      className="flex shrink-0 items-center rounded-pill border border-neutral-200 bg-neutral-50 p-0.5"
    >
      {LOCALES.map((value) => {
        const active = value === locale;
        return (
          <button
            key={value}
            type="submit"
            name="locale"
            value={value}
            aria-pressed={active}
            data-testid={`locale-${value}`}
            aria-label={LABELS[value]}
            className={cn(
              'rounded-pill px-2 py-0.5 text-[11px] font-semibold leading-4 transition-colors focus-visible:outline-2 focus-visible:outline-coral-600',
              active
                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            {LABELS[value]}
          </button>
        );
      })}
    </form>
  );
}
