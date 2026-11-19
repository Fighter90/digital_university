// DIG-37 — «Справочник» (/people, Figma «15 · Справочник»): преподаватели
// и сотрудники вуза в одном месте. Каталог — вымышленный публичный контент,
// персональные пометки («Мои преподаватели», «Ваш менеджер», «дисциплины
// студента у него») собирает getPeopleDirectory строго из скоупа сессии.
// Поиск и фильтры — на клиенте (PeopleBrowser), данные приходят одним агрегатом.
import { requireDataCtx, getPeopleDirectory } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { PeopleBrowser } from '@/components/people/people-browser';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionTitle } from '@/components/shell/section-title';

import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata() {
  const locale = await getLocale();
  return { title: t(locale, 'meta.people') };
}

export default async function PeoplePage() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/people'), getLocale()]);
  const data = await getPeopleDirectory(dataDb, ctx);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <SectionTitle href="/people" className="text-xl font-bold sm:text-2xl" />
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {t(locale, 'people.subtitle')}
      </p>

      {data.people.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={t(locale, 'people.empty.title')}
          description={t(locale, 'people.empty.desc')}
        />
      ) : (
        <div className="mt-5">
          <PeopleBrowser people={data.people} showPersonal={data.hasPersonalScope} locale={locale} />
        </div>
      )}
    </section>
  );
}
