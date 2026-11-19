// DIG-26 — скелетон экрана «Успеваемость» на время загрузки RSC-данных.
import { GradesSkeleton } from '@/components/performance/grades-skeleton';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export default async function GradesLoading() {
  const locale = await getLocale();
  return <GradesSkeleton label={t(locale, 'loading.grades')} />;
}
