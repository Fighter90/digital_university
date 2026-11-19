// DIG-70 — экран «Справка» (/guide, отдельный пункт меню рядом с
// «Вопросами и ответами»): детальный гайд «Как пользоваться кабинетом».
// GET-only, статический вымышленный контент из lib/help-content — слоя данных
// нет, owner-scope не нужен, IDOR-поверхности нет; доступ гарантирует
// requireUser каркаса кабинета (layout). Поиск и оглавление — клиентские
// (help-search.tsx), сама страница — серверный компонент.
// DIG-88 — контент каталога по локали cookie du-locale; RU — байт-в-байт.
import type { Metadata } from 'next';

import { HelpSearch } from '@/components/help/help-search';
import { guideHeading, guideIntro, guideSections } from '@/lib/help-content';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { SectionTitle } from '@/components/shell/section-title';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.guide') };
}

export default async function GuidePage() {
  const locale = await getLocale();
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <SectionTitle
        href="/guide"
        className="text-xl font-bold sm:text-2xl"
        fallback={guideHeading(locale)}
      />
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{guideIntro(locale)}</p>

      <HelpSearch sections={guideSections(locale)} locale={locale} />
    </section>
  );
}
