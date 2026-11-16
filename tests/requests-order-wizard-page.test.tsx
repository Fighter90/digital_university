// DIG-31 — контракт страницы /requests с мастером заказа: параметр ?order=
// из каталога/FAQ открывает мастер с предвыбором типа, CTA «Заказать
// справку» ведёт на /requests?order=new, студенту подставляются типы
// словаря и профиль, сотруднику мастера нет. Данные замоканы — изолировано
// от слоя (как tests/requests-page.test.tsx).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { RequestsScreenData } from '@/server/data/requests-screen';
import type { DataCtx } from '@/server/data/types';

const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};
const staffCtx: DataCtx = { ...studentCtx, role: 'STAFF', studentId: null, groupName: null };

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

const state = vi.hoisted(() => ({
  ctx: null as unknown,
  screen: null as unknown,
  types: [
    {
      id: 'crt-cert',
      code: 'CERT_ENROLLMENT',
      name: 'Справка об обучении',
      etaDays: 1,
      format: 'ELECTRONIC',
      isInstant: true,
      formSchema: { keyField: 'purpose', fields: [] },
    },
  ] as Array<Record<string, unknown>>,
  profile: null as unknown,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getRequestsScreen: vi.fn(async () => state.screen),
  listCanonicalRequestTypes: vi.fn(async () => state.types),
  getOwnProfile: vi.fn(async () => state.profile),
}));

vi.mock('@/server/actions/requests', () => ({
  createRequestAction: vi.fn(async () => null),
  cancelRequestAction: vi.fn(async () => null),
  resubmitRequestAction: vi.fn(async () => null),
}));

import RequestsPage from '@/app/(cabinet)/requests/page';

async function renderPage(search: Record<string, string> = {}): Promise<string> {
  const Page = RequestsPage as unknown as ComponentType<{
    searchParams: Promise<Record<string, string>>;
  }>;
  const { prelude } = await prerenderToNodeStream(createElement(Page, { searchParams: Promise.resolve(search) }));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

beforeEach(() => {
  state.ctx = studentCtx;
  state.screen = { cards: [] } satisfies RequestsScreenData;
  state.profile = {
    fullName: 'Анна Ковалёва',
    groupName: 'ПИ-21',
    course: 2,
    faculty: 'ИТ',
  };
});

describe('/requests?order=… — вход в мастер заказа (DIG-31)', () => {
  it('CTA «Заказать справку» ведёт на /requests?order=new', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="requests-empty-order-cta"');
    expect(html).toContain('href="/requests?order=new"');
    expect(html).not.toContain('href="/services"');
  });

  it('без параметра order: точка монтирования мастера есть, мастера не открыт', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="order-wizard-root"');
    expect(html).not.toContain('data-auto-open="true"');
  });

  it('?order=cert-defer — мастер открыт, предвыбор CERT_ENROLLMENT (справка для военкомата)', async () => {
    const html = await renderPage({ order: 'cert-defer' });
    expect(html).toContain('data-auto-open="true"');
    expect(html).toContain('data-auto-type="CERT_ENROLLMENT"');
  });

  it('?order=неизвестный-сервис — мастер открыт без предвыбора, ошибки нет', async () => {
    const html = await renderPage({ order: 'cert-tax' });
    expect(html).toContain('data-auto-open="true"');
    expect(html).not.toContain('data-auto-type="CERT_');
  });

  it('массив вместо строки в order — берётся первый элемент, мастер открыт', async () => {
    const Page = RequestsPage as unknown as ComponentType<{
      searchParams: Promise<Record<string, string | string[]>>;
    }>;
    const { prelude } = await prerenderToNodeStream(
      createElement(Page, { searchParams: Promise.resolve({ order: ['cert-defer'] }) }),
    );
    let html = '';
    for await (const chunk of prelude) html += String(chunk);
    expect(html).toContain('data-auto-open="true"');
    expect(html).toContain('data-auto-type="CERT_ENROLLMENT"');
  });

  it('мастеру передаются типы словаря и профиль студента', async () => {
    const html = await renderPage();
    expect(html).toContain('data-wizard-types="CERT_ENROLLMENT"');
    expect(html).toContain('data-wizard-profile="Анна Ковалёва"');
  });

  it('сотрудник: мастера нет ни с параметром, ни без', async () => {
    state.ctx = staffCtx;
    const html = await renderPage({ order: 'cert-defer' });
    expect(html).not.toContain('order-wizard-root');
    expect(html).not.toContain('data-auto-open');
    expect(html).toContain('Заявки студентов');
  });
});
