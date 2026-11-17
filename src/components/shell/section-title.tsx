// DIG-69 — заголовок раздела по локали. Серверный компонент: сам читает
// cookie du-locale и берёт текст из словаря i18n по pathname-префиксу
// (sectionTitle). Заменяет статические <h1> разделов кабинета; RU-тексты
// байт-в-байт равны прежним заголовкам.
import { sectionTitle } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function SectionTitle({
  href,
  className,
  fallback,
}: {
  /** Префикс раздела («/requests», «/grades/session») — ключ словаря. */
  href: string;
  /** Прежние классы h1 конкретной страницы (десктоп/мобайл не менялись). */
  className?: string;
  /** Текст, когда префикс не сматчился (страницы без словарной записи). */
  fallback?: string;
}) {
  const locale = await getLocale();
  return <h1 className={className}>{sectionTitle(locale, href, fallback)}</h1>;
}
