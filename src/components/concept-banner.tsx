// DIG-13 — плашка «Концепт для конкурса» (обязательна на каждой странице).
// DIG-69 — текст переводится: RU по умолчанию, EN — «Concept entry for the
// hackathon». data-testid и aria-свойства не менялись (приёмка e2e).
import { t, type Locale } from '@/lib/i18n';

export function ConceptBanner({ locale = 'ru' }: { locale?: Locale }) {
  return (
    <div
      role="note"
      aria-label={t(locale, 'concept.bannerAria')}
      className="sticky top-0 z-50 border-b border-amber-200 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 sm:text-sm md:static md:z-auto"
    >
      {t(locale, 'concept.banner')}
    </div>
  );
}
