// DIG-103 — скелетон страницы «Рейтинг группы» на время загрузки RSC.
import { GradesSkeleton } from '@/components/performance/grades-skeleton';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export default async function GroupRatingLoading() {
  const locale = await getLocale();
  return <GradesSkeleton label={t(locale, 'loading.gradesRating')} />;
}
