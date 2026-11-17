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

export const metadata = { title: 'Справочник — Цифровой деканат' };

export default async function PeoplePage() {
  const ctx = await requireDataCtx('/people');
  const data = await getPeopleDirectory(dataDb, ctx);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <SectionTitle href="/people" className="text-xl font-bold sm:text-2xl" />
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Преподаватели и сотрудники вуза: контакты, кабинеты, часы консультаций.
      </p>

      {data.people.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Справочник пуст"
          description="Данные сотрудников появятся, когда деканат заведёт их в систему."
        />
      ) : (
        <div className="mt-5">
          <PeopleBrowser people={data.people} showPersonal={data.hasPersonalScope} />
        </div>
      )}
    </section>
  );
}
