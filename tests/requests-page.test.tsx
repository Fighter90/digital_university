// DIG-31 — точка входа мастера на странице «Мои заявки» (SSR).
// Приёмка: у студента есть CTA «Заказать справку или заявление», страница
// читает ?order= (валидный id каталога — параметр авто-открытия мастера);
// сотруднику ни CTA, ни мастер не показываются.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { RequestsPageData } from '@/server/data/requests';
import type { DataCtx, ServiceRequestRow } from '@/server/data/types';

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
  page: null as RequestsPageData | null,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getRequestsPage: vi.fn(async () => state.page),
}));

import RequestsPage from '@/app/(cabinet)/requests/page';

async function renderPage(searchParams: Record<string, string> = {}): Promise<string> {
  const Page = RequestsPage as unknown as ComponentType<{ searchParams: Promise<Record<string, string>> }>;
  const { prelude } = await prerenderToNodeStream(
    createElement(Page, { searchParams: Promise.resolve(searchParams) }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

function studentPage(): RequestsPageData {
  return {
    requests: [
      {
        id: 'req-anna-1',
        studentId: 'st-anna',
        number: 'SR-2026-XXXXX',
        type: 'CERTIFICATE',
        title: 'Справка об обучении для налоговой',
        status: 'COMPLETED',
        assignee: 'Мария Петрова',
        resultNote: null,
        createdAt: new Date(2026, 10, 10),
        updatedAt: new Date(2026, 10, 11),
      },
    ] satisfies ServiceRequestRow[],
    student: {
      id: 'st-anna',
      login: 'anna.smirnova',
      fullName: 'Анна Ковалёва',
      email: 'anna.kovaleva@example.edu',
      groupName: 'ПИ-21',
      course: 2,
      faculty: 'ИТ',
      program: 'Прикладная информатика',
      programCode: '09.03.03',
      studyForm: 'очная',
      funding: 'бюджет',
      gradebookNumber: '20231234',
    },
  };
}

describe('/requests — точка входа мастера заказа (DIG-31)', () => {
  it('у студента есть CTA «Заказать справку или заявление»', async () => {
    state.ctx = studentCtx;
    state.page = studentPage();

    const html = await renderPage();
    expect(html).toContain('data-testid="requests-order-cta"');
    expect(html).toContain('Заказать справку или заявление');
  });

  it('валидный ?order= передаётся в мастер (авто-открытие), невалидный — нет', async () => {
    state.ctx = studentCtx;
    state.page = studentPage();

    // Валидный id каталога: страница рендерится, мастер замонтирован.
    const valid = await renderPage({ order: 'cert-defer' });
    expect(valid).toContain('data-testid="requests-order-cta"');

    // Невалидный id — не должен привести к авто-открытию мастера с документом.
    const invalid = await renderPage({ order: '../etc/passwd' });
    expect(invalid).toContain('data-testid="requests-order-cta"');
    expect(invalid).not.toContain('Справка для отсрочки от армии</');
  });

  it('сотруднику CTA и мастер недоступны', async () => {
    state.ctx = staffCtx;
    state.page = { requests: [], student: null };

    const html = await renderPage({ order: 'cert-defer' });
    expect(html).not.toContain('data-testid="requests-order-cta"');
    expect(html).not.toContain('Что нужно');
  });
});
