// DIG-38 — экран «Вопросы и ответы» (/help, Figma «11 · Вопросы и ответы»):
// база знаний с поиском, который находит. Статьи публичны и одинаковы для
// студента и сотрудника — owner-scoped данных нет, IDOR-поверхности нет;
// доступ гарантирует requireUser каркаса кабинета (layout). Поиск и фильтры
// клиентские, каталог — статический вымышленный контент из lib/faq-kb-catalog.
// DIG-88 — интро и каталог статей по локали cookie du-locale; RU — байт-в-байт.
import type { Metadata } from 'next';

import { HelpBrowser } from '@/components/help/help-browser';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { SectionTitle } from '@/components/shell/section-title';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.help') };
}

export default async function HelpPage() {
  const locale = await getLocale();
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <SectionTitle href="/help" className="text-xl font-bold sm:text-2xl" />
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t(locale, 'help.intro')}</p>

      <HelpBrowser locale={locale} />
    </section>
  );
}
