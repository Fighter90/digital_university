// DIG-29 — контракт страницы /services («Каталог сервисов», SSR).
// Приёмка: заголовок, блок избранного («+ Добавить», звёздочка-форма),
// «Часто нужно на 2 курсе» без дублей с избранным, каталог с поиском и
// 6 пилюлями, карточки с сроком/форматом/Заказать/Открыть, ни одной
// чужеролевой услуги, пустое избранное, состояние сотрудника.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { ServicesPageData } from '@/server/data/services';
import type { DataCtx } from '@/server/data/types';
import { servicesForRole } from '@/lib/services-catalog';

const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const staffCtx: DataCtx = { ...studentCtx, role: 'STAFF', studentId: null, groupName: null };

const state = vi.hoisted(() => ({
  ctx: null as unknown,
  page: null as ServicesPageData | null,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getServicesPage: vi.fn(async () => state.page),
}));

import ServicesPage from '@/app/(cabinet)/services/page';

async function renderPage(): Promise<string> {
  const Page = ServicesPage as unknown as ComponentType;
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

function pageFixture(): ServicesPageData {
  const students = servicesForRole('STUDENT');
  const favorites = students.filter((s) =>
    ['cert-enrollment', 'transcript-instant'].includes(s.id),
  );
  const picks = students.filter((s) => ['cert-tax', 'stmt-individual-plan'].includes(s.id));
  return { course: 2, favorites, picks };
}

describe('/services — студент', () => {
  it('заголовок «Каталог сервисов» и блок избранного с «+ Добавить»', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderPage();
    expect(html).toContain('Каталог сервисов');
    expect(html).toContain('data-testid="services-favorites"');
    expect(html).toContain('Избранное и часто используемые');
    // Звёздочки избранного — формы с hidden serviceId.
    expect(html).toContain('name="serviceId" value="cert-enrollment"');
    // «+ Добавить» — ссылка на каталог.
    expect(html).toContain('data-testid="favorite-add"');
    expect(html).toMatch(/href="#catalog"/);
  });

  it('блок «Часто нужно на 2 курсе» без дублей с избранным', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderPage();
    expect(html).toContain('data-testid="services-picks"');
    expect(html).toContain('Часто нужно на 2 курсе');
    expect(html).toContain('data-testid="service-card-cert-tax"');
    // Дублей с избранным нет: cert-enrollment в избранном — не в подборке.
    const picksTag = html.match(/<section[^>]*data-testid="services-picks"[\s\S]*?<\/section>/)![0];
    expect(picksTag).not.toContain('cert-enrollment');
    expect(picksTag).not.toContain('transcript-instant');
  });

  it('карточка сервиса: срок, формат, «Заказать» и «Открыть»', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderPage();
    const docCard = html.match(
      /<article[^>]*data-testid="service-card-cert-enrollment"[\s\S]*?<\/article>/,
    );
    expect(docCard).not.toBeNull();
    expect(docCard![0]).toContain('2–3 дня');
    expect(docCard![0]).toContain('PDF');
    expect(docCard![0]).toContain('Заказать');
    expect(docCard![0]).toContain('href="/requests?order=cert-enrollment"');
    // Мгновенная услуга открывается внутри кабинета.
    const openCard = html.match(
      /<article[^>]*data-testid="service-card-transcript-instant"[\s\S]*?<\/article>/,
    );
    expect(openCard).not.toBeNull();
    expect(openCard![0]).toContain('Мгновенно');
    expect(openCard![0]).toContain('Открыть');
    expect(openCard![0]).toContain('href="/grades/gradebook"');
  });

  it('каталог: поиск с aria-меткой, 6 пилюль категорий, сетка карточек', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderPage();
    expect(html).toContain('data-testid="services-catalog"');
    expect(html).toContain('data-testid="services-search"');
    expect(html).toContain('data-testid="services-categories"');
    expect(html).toContain('data-testid="services-grid"');
    for (const label of [
      'Справки',
      'Заявления',
      'Учёба',
      'Финансы и стипендии',
      'Общежитие',
      'Помощь',
    ]) {
      expect(html).toContain(label);
    }
    // Пилюли скроллятся горизонтально (360 px): контейнер без переноса строк.
    const categories = html.match(/<div[^>]*data-testid="services-categories"[^>]*>/)![0];
    expect(categories).toMatch(/overflow-x-auto/);
  });

  it('ни одной услуги чужой роли: «абитуриент» отсутствует', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderPage();
    expect(html.toLowerCase()).not.toContain('абитуриент');
    expect(html).not.toContain('Личный кабинет абитуриента');
    expect(html).not.toContain('staff-schedule-editor');
  });
});

describe('/services — пустые состояния', () => {
  it('пустое избранное: подсказка и «+ Добавить»', async () => {
    state.ctx = studentCtx;
    state.page = { course: 2, favorites: [], picks: pageFixture().picks };

    const html = await renderPage();
    expect(html).toContain('В избранном пока пусто');
    expect(html).toContain('data-testid="favorite-add"');
    expect(html).toContain('звёздочку');
  });

  it('сотруднику каталог не показывается: «Доступно студентам»', async () => {
    state.ctx = staffCtx;
    state.page = { course: null, favorites: [], picks: [] };

    const html = await renderPage();
    expect(html).toContain('Доступно студентам');
    expect(html).not.toContain('data-testid="services-favorites"');
    expect(html).not.toContain('data-testid="services-catalog"');
    expect(html).not.toContain('data-testid="services-search"');
  });

  it('пустая подборка — блок скрывается', async () => {
    state.ctx = studentCtx;
    state.page = { course: 7, favorites: [], picks: [] };

    const html = await renderPage();
    expect(html).not.toContain('data-testid="services-picks"');
    expect(html).not.toContain('Часто нужно на');
  });
});
