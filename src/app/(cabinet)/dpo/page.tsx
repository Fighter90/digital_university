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

export const metadata = { title: 'Доп. образование — Цифровой деканат' };

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
                  <DpoProgramCard view={view} canEnroll={canEnroll} locale={locale} />
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
                <DpoMyProgramCard view={view} locale={locale} />
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
          <DpoDocumentList documents={documents} locale={locale} />
        ))}
    </section>
  );
}
