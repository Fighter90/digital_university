// DIG-32 — «Мои заявки» (фрейм Figma «06 · Заявки — мои заявки»):
// пилюли-фильтры со счётчиками (Все · В работе · Нужно действие · Готовы ·
// Архив), поиск по номеру/названию, карточки с единым словарём статусов,
// степпером конвейера и кнопками действий; «Нужна доработка» всегда наверху.
//
// Данные — одним агрегатом getRequestsScreen(dataDb, ctx): оба списка
// (канон «ЗД-…» DIG-30 и legacy «SR-…» DIG-12) читаются owner-scoped
// функциями слоя; контекст строится из живой сессии (requireDataCtx),
// сотруднику — пустое состояние, а его чтения аудируются слоем.
// Фильтр заказа из каталога (/requests?order=…) обрабатывает мастер
// заказа DIG-31 — здесь параметр не читается.
import Link from 'next/link';
import { FileText } from 'lucide-react';

import { requireDataCtx, getRequestsScreen } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { RequestsBrowser } from '@/components/requests/requests-browser';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: 'Мои заявки — Цифровой деканат' };

export default async function RequestsPage() {
  const ctx = await requireDataCtx('/requests');
  const { cards } = await getRequestsScreen(dataDb, ctx);

  const orderCta = (testid: string) => (
    <Link
      href="/services"
      data-testid={testid}
      className="inline-flex items-center gap-1.5 rounded-button bg-coral-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
    >
      <FileText aria-hidden="true" className="size-4" />
      Заказать справку
    </Link>
  );

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Мои заявки</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Справки и заявления в одном месте: видно, на каком шаге каждая заявка и что от вас ждут
            дальше.
          </p>
        </div>
        {ctx.role === 'STUDENT' && cards.length > 0 ? orderCta('requests-order-cta') : null}
      </div>

      {ctx.role === 'STAFF' ? (
        <EmptyState
          className="mt-8"
          title="Заявки студентов"
          description="Раздел показывает заявки студента: у сотрудника он пуст. Чтение списков сотрудником фиксируется в журнале доступа."
        />
      ) : cards.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={FileText}
          title="Заявок пока нет"
          description="Закажите справку или напишите заявление — заявка появится здесь вместе со сроком готовности."
          action={orderCta('requests-empty-order-cta')}
        />
      ) : (
        <div className="mt-5">
          <RequestsBrowser cards={cards} />
        </div>
      )}
    </section>
  );
}
