// DIG-42 — «Дополнительное образование» (/dpo): три вкладки «Каталог
// программ», «Мои программы», «Документы». Активная вкладка — параметр
// ?tab= (паттерн настроек), фильтр каталога по формату — ?format=; оба
// состояния в URL, работают без JS. Чтение каталога — любой вошедший;
// «Мои программы» и «Документы» — owner-scoped по сессии (getDpoMyPrograms /
// getDpoDocuments скоупят по ctx.studentId, IDOR-запрет). Зачисляемости и
// оплаты нет: демо-данные, «Записаться» ставит строку записи владельца.
//
// Плашка «Концепт для конкурса» — общий баннер root layout.
import { GraduationCap } from 'lucide-react';

import { DpoDocumentList } from '@/components/dpo/dpo-document-list';
import { DpoFormatChips } from '@/components/dpo/dpo-format-chips';
import { DpoMyProgramCard } from '@/components/dpo/dpo-my-program-card';
import { DpoProgramCard } from '@/components/dpo/dpo-program-card';
import { DpoTabs } from '@/components/dpo/dpo-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveDpoTab } from '@/lib/dpo-tabs';
import { enDpoDocTitle, enDpoProgram } from '@/lib/en-demo-content';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import {
  filterDpoCatalog,
  getDpoCatalog,
  getDpoDocuments,
  getDpoMyPrograms,
  parseDpoFormat,
  requireDataCtx,
} from '@/server/data';
import { dataDb } from '@/server/data/db';

/** DIG-89 — <title> страницы по локали (RU байт-в-байт прежний). */
export async function generateMetadata() {
  const locale = await getLocale();
  return { title: t(locale, 'meta.dpo') };
}

/**
 * DIG-89 — EN-рендер демо-контента ДПО: титул/описание/теги программы и
 * названия документов — из словаря en-demo-content по id. RU — как в сиде
 * (байт-в-байт), маппинг не применяется.
 */
function localizeProgram<T extends { program: { id: string } }>(view: T, locale: 'ru' | 'en'): T {
  if (locale !== 'en') return view;
  const en = enDpoProgram(view.program.id);
  return en ? { ...view, program: { ...view.program, ...en } } : view;
}

function localizeDocTitle(doc: { id: string; title: string }, locale: 'ru' | 'en'): string {
  if (locale !== 'en') return doc.title;
  return enDpoDocTitle(doc.id) ?? doc.title;
}

export default async function DpoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [ctx, locale, params] = await Promise.all([
    requireDataCtx('/dpo'),
    getLocale(),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);

  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = resolveDpoTab(rawTab);
  const rawFormat = Array.isArray(params.format) ? params.format[0] : params.format;
  const format = parseDpoFormat(rawFormat);
  const canEnroll = ctx.role === 'STUDENT';

  const catalog = tab === 'catalog' ? await getDpoCatalog(dataDb, ctx) : [];
  const views = filterDpoCatalog(catalog, format);
  const myPrograms = tab === 'my' ? await getDpoMyPrograms(dataDb, ctx) : [];
  const documents = tab === 'docs' ? await getDpoDocuments(dataDb, ctx) : [];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{t(locale, 'title.dpo')}</h1>
          <p className="mt-1 text-sm text-neutral-600">{t(locale, 'dpo.subtitle')}</p>
        </div>
        <DpoTabs active={tab} format={format} locale={locale} />
      </div>

      {tab === 'catalog' && (
        <>
          <DpoFormatChips format={format} locale={locale} />
          {views.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={t(locale, 'dpo.catalog.emptyTitle')}
              description={t(locale, 'dpo.catalog.emptyDesc')}
            />
          ) : (
            <ul className="flex flex-col gap-3" data-testid="dpo-catalog">
              {views.map((view) => (
                <li key={view.program.id}>
                  <DpoProgramCard
                    view={localizeProgram(view, locale)}
                    canEnroll={canEnroll}
                    locale={locale}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'my' &&
        (myPrograms.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={t(locale, 'dpo.my.emptyTitle')}
            description={t(locale, 'dpo.my.emptyDesc')}
          />
        ) : (
          <ul className="flex flex-col gap-3" data-testid="dpo-my-programs">
            {myPrograms.map((view) => (
              <li key={view.program.id}>
                <DpoMyProgramCard view={localizeProgram(view, locale)} locale={locale} />
              </li>
            ))}
          </ul>
        ))}

      {tab === 'docs' &&
        (documents.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={t(locale, 'dpo.docs.emptyTitle')}
            description={t(locale, 'dpo.docs.emptyDesc')}
          />
        ) : (
          <DpoDocumentList
            documents={documents.map((doc) => ({ ...doc, title: localizeDocTitle(doc, locale) }))}
            locale={locale}
          />
        ))}
    </section>
  );
}
