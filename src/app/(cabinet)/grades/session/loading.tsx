// DIG-28 — скелетон на время загрузки RSC-данных экрана «Сессия».
import { SessionSkeleton } from '@/components/session/session-skeleton';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export default async function Loading() {
  const locale = await getLocale();
  return <SessionSkeleton label={t(locale, 'loading.session')} />;
}
