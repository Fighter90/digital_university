// DIG-29 — «Каталог сервисов» (/services, Figma «06 · Заявки — каталог»):
// услуги деканата и вуза, отфильтрованные под роль и курс студента.
//
// Данные — одним серверным агрегатом getServicesPage(dataDb, ctx); контекст
// строится из живой сессии (requireDataCtx) — чужое избранное недостижимо
// по построению, сотруднику — пустое состояние + аудит. Категорий пилюлями
// шесть (не 12), «Избранное и часто используемые» — до 6 закреплений
// (хранятся на сервере), «Часто нужно на N курсе» — без дублей с избранным.
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { requireDataCtx, getServicesPage } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { MAX_FAVORITES } from '@/lib/services-catalog';
import { ServicesBrowser } from '@/components/services/services-browser';
import { ServiceCard } from '@/components/services/service-card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: 'Каталог сервисов — Цифровой деканат' };

const gridClasses = 'mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3';

export default async function ServicesPage() {
  const ctx = await requireDataCtx('/services');
  const data = await getServicesPage(dataDb, ctx);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <h1 className="text-xl font-bold sm:text-2xl">Каталог сервисов</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Услуги деканата и вуза в одном месте — только то, что доступно вам как студенту.
      </p>

      {ctx.role === 'STAFF' ? (
        <EmptyState
          className="mt-6"
          title="Доступно студентам"
          description="Каталог показывает учебные сервисы студента: справки, заявления и сроки выполнения."
        />
      ) : (
        <>
          {/* Избранное и часто используемые — до 6 закреплённых сервисов. */}
          <section
            data-testid="services-favorites"
            aria-labelledby="services-favorites-heading"
            className="mt-6"
          >
            <h2 id="services-favorites-heading" className="text-base font-extrabold">
              Избранное и часто используемые
            </h2>
            {data.favorites.length === 0 ? (
              <EmptyState
                className="mt-3"
                icon={Plus}
                title="В избранном пока пусто"
                description="Нажмите звёздочку на карточке каталога — сервис закрепится здесь, и заказывать его станет ближе."
                action={
                  <Link
                    href="#catalog"
                    data-testid="favorite-add"
                    className="inline-flex items-center gap-1.5 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Добавить
                  </Link>
                }
              />
            ) : (
              <>
                <ul className={gridClasses}>
                  {data.favorites.map((service) => (
                    <li key={service.id}>
                      <ServiceCard service={service} isFavorite />
                    </li>
                  ))}
                </ul>
                {data.favorites.length < MAX_FAVORITES ? (
                  <Link
                    href="#catalog"
                    data-testid="favorite-add"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-button px-1 text-sm font-semibold text-coral-600 transition-colors hover:text-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Добавить
                  </Link>
                ) : null}
              </>
            )}
          </section>

          {/* Часто нужно на N курсе — подборка без дублей с избранным. */}
          {data.picks.length > 0 ? (
            <section
              data-testid="services-picks"
              aria-labelledby="services-picks-heading"
              className="mt-8"
            >
              <h2 id="services-picks-heading" className="text-base font-extrabold">
                Часто нужно на {data.course} курсе
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Подобрано по вашему курсу и программе — без повторов с избранным.
              </p>
              <ul className={gridClasses}>
                {data.picks.map((service) => (
                  <li key={service.id}>
                    <ServiceCard service={service} isFavorite={false} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Все сервисы: поиск с подсветкой + категории пилюлями. */}
          <section
            id="catalog"
            aria-labelledby="services-catalog-heading"
            className="mt-8 scroll-mt-20"
          >
            <h2 id="services-catalog-heading" className="mb-3 text-base font-extrabold">
              Все сервисы
            </h2>
            <ServicesBrowser favoriteIds={data.favorites.map((s) => s.id)} />
          </section>
        </>
      )}
    </section>
  );
}
