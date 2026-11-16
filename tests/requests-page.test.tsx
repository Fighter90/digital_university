// DIG-32 — контракт страницы /requests («Мои заявки», SSR).
// Приёмка: пилюли со счётчиками, карточки с единым словарём статусов
// (легаси-метки не рендерятся), «Нужна доработка» наверху с причиной,
// кнопка «Скачать PDF» готовой, пустое состояние «Заявок пока нет» с
// «Заказать справку», состояние сотрудника. Данные приходят из
// getRequestsScreen — здесь они замоканы (изолированно от слоя).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { RequestsScreenData } from '@/server/data/requests-screen';
import type { DataCtx } from '@/server/data/types';
import type { RequestCardView } from '@/lib/requests-view';

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
  screen: null as unknown,
}));

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getRequestsScreen: vi.fn(async () => state.screen),
  listCanonicalRequestTypes: vi.fn(async () => []),
  getOwnProfile: vi.fn(async () => null),
}));

vi.mock('@/server/actions/requests', () => ({
  createRequestAction: vi.fn(async () => null),
  cancelRequestAction: vi.fn(async () => null),
  resubmitRequestAction: vi.fn(async () => null),
}));

import RequestsPage from '@/app/(cabinet)/requests/page';

async function renderPage(): Promise<string> {
  const Page = RequestsPage as unknown as ComponentType;
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

const card = (overrides: Partial<RequestCardView> & Pick<RequestCardView, 'id' | 'status'>): RequestCardView => ({
  number: 'ЗД-2026-000001',
  title: 'Справка об обучении · для банка',
  typeName: 'Справка об обучении',
  iconKind: 'certificate',
  createdAtISO: '2026-11-10T10:00:00.000Z',
  createdAtLabel: '10 ноября, 13:00',
  readyByISO: null,
  readyByLabel: null,
  updatedAtISO: '2026-11-10T10:00:00.000Z',
  action: null,
  pipelineStep: 1,
  nextAction: 'Ожидает приёма деканатом',
  reason: null,
  isFix: false,
  ...overrides,
});

describe('/requests — студент с заявками', () => {
  beforeEach(() => {
    state.ctx = studentCtx;
    state.screen = {
      cards: [
        card({ id: 'fix', status: 'NEEDS_FIX', title: 'Справка об обучении · для военкомата', number: 'ЗД-2026-000003', nextAction: 'Нужна доработка: Укажите ФИО латиницей', isFix: true, action: 'FIX', createdAtISO: '2026-10-20T10:00:00.000Z', createdAtLabel: '20 октября, 13:00' }),
        card({ id: 'ready', status: 'READY', number: 'ЗД-2026-000001', nextAction: 'Документ готов к скачиванию', action: 'DOWNLOAD', createdAtISO: '2026-11-12T06:00:00.000Z', createdAtLabel: '12 ноября, 09:00' }),
        card({
          // Легаси-значение «как из старого хранилища» (нарочно с нарушением
          // контракта вида): экран обязан показать канон «Выдана», а не
          // «Выполнена» — защита на входе в экран (unifyRequestStatus).
          id: 'old',
          status: 'COMPLETED' as RequestCardView['status'],
          title: 'Справка об обучении для налоговой',
          number: 'SR-2026-AB1C2',
          typeName: 'CERTIFICATE',
          iconKind: 'certificate',
          createdAtISO: '2026-11-01T10:00:00.000Z',
          createdAtLabel: '1 ноября, 13:00',
        }),
      ] satisfies RequestCardView[],
    } satisfies RequestsScreenData;
  });

  it('заголовок, пилюли-фильтры со счётчиками и CTA «Заказать справку»', async () => {
    const html = await renderPage();
    expect(html).toContain('Мои заявки');
    expect(html).toContain('Все');
    expect(html).toContain('В работе');
    expect(html).toContain('Нужно действие');
    expect(html).toContain('Готовы');
    expect(html).toContain('Архив');
    expect(html).toContain('requests-filters');
    expect(html).toContain('requests-order-cta');
    // Счётчик «Все» = 3.
    expect(html).toContain('>3</span>');
  });

  it('«Нужна доработка» — первая карточка, с причиной и кнопкой «Исправить»', async () => {
    const html = await renderPage();
    const fixAt = html.indexOf('для военкомата');
    const readyAt = html.indexOf('для банка');
    expect(fixAt).toBeGreaterThan(-1);
    expect(fixAt).toBeLessThan(readyAt);
    expect(html).toContain('Нужна доработка: Укажите ФИО латиницей');
    expect(html).toContain('Исправить');
    expect(html).toContain('data-testid="request-action-fix"');
  });

  it('готовая заявка предлагает PDF, номер и дата подачи на карточке', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="request-action-download"');
    expect(html).toContain('Скачать PDF');
    expect(html).toContain('ЗД-2026-000001');
    expect(html).toContain('подана 12 ноября, 09:00');
  });

  it('статусы — только из единого словаря: легаси-метки не рендерятся', async () => {
    const html = await renderPage();
    // Legacy-заявка SR- с легаси-статусом показана как «Выдана» (unify).
    expect(html).toContain('Выдана');
    expect(html).not.toContain('Выполнена');
    expect(html).not.toContain('Требует правок');
    expect(html).not.toContain('Завершён');
    // Степпер легаси-статуса тоже считается по канону (не «Шаг из 5»).
    expect(html).not.toContain('Шаг undefined');
    expect(html).toContain('Шаг 5 из 5 · Выдана');
  });

  it('компактный и полный степперы присутствуют в разметке', async () => {
    const html = await renderPage();
    expect(html).toContain('request-stepper-compact');
    expect(html).toContain('Шаг 1 из 5');
  });
});

describe('/requests — студент без заявок', () => {
  it('пустое состояние: «Заявок пока нет» + «Заказать справку» → мастер заказа (DIG-31)', async () => {
    state.ctx = studentCtx;
    state.screen = { cards: [] } satisfies RequestsScreenData;
    const html = await renderPage();
    expect(html).toContain('Заявок пока нет');
    expect(html).toContain('requests-empty-order-cta');
    expect(html).toContain('href="/requests?order=new"');
    expect(html).not.toContain('requests-filters');
  });
});

describe('/requests — сотрудник', () => {
  it('список недоступен: пустое состояние без фильтров, CTA и мастера заказа (DIG-31)', async () => {
    state.ctx = staffCtx;
    state.screen = { cards: [] } satisfies RequestsScreenData;
    const html = await renderPage();
    expect(html).toContain('Заявки студентов');
    expect(html).not.toContain('requests-filters');
    expect(html).not.toContain('requests-order-cta');
    expect(html).not.toContain('order-wizard-root');
    expect(html).not.toContain('Заявок пока нет');
  });
});
