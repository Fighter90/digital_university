// DIG-37 — переход из заявки на карточку человека (критерий приёмки).
// В истории заявки имена сотрудников деканата (actorRole STAFF) — ссылки
// на /people/<id>; имя студента остаётся обычным текстом (его нет в
// справочнике сотрудников).
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { ServiceRequestRow } from '@/server/data/types';

const state = vi.hoisted(() => ({
  request: null as ServiceRequestRow | null,
  events: [] as Array<{
    id: string;
    actorRole: 'STUDENT' | 'STAFF';
    actorName: string;
    message: string;
    createdAt: Date;
  }>,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => ({
    userId: 'auth-anna',
    login: 'anna.smirnova',
    role: 'STUDENT' as const,
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  })),
  getRequestByNumber: vi.fn(async () => state.request),
  listRequestEvents: vi.fn(async () => state.events),
  normalizeRequestNumber: (raw: string) => raw,
  decodeRequestNumberParam: (raw: string) => raw,
  isValidCanonicalRequestNumber: (raw: string) => false,
  isValidServiceRequestNumber: (raw: string) => true,
  getOrCreateCertificateForRequest: vi.fn(async () => null),
  listCertificatesByStudent: vi.fn(async () => []),
}));

vi.mock('@/lib/request-labels', () => ({
  REQUEST_TYPE_LABELS: { CERTIFICATE: 'Справка' },
  formatRequestDate: () => '12 ноября 2026',
}));

vi.mock('@/components/request-status-badge', () => ({
  RequestStatusBadge: () => null,
}));

import RequestDetailPage from '@/app/(cabinet)/requests/[number]/page';

async function renderPage(): Promise<string> {
  const Page = RequestDetailPage as unknown as ComponentType<{
    params: Promise<{ number: string }>;
  }>;
  const { prelude } = await prerenderToNodeStream(
    createElement(Page, { params: Promise.resolve({ number: 'ЗД-2026-000001' }) }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

function requestFixture(): ServiceRequestRow {
  return {
    id: 'req-1',
    studentId: 'st-anna',
    number: 'ЗД-2026-000001',
    type: 'CERTIFICATE',
    title: 'Справка об обучении',
    status: 'IN_PROGRESS',
    assignee: 'Мария Петрова',
    resultNote: null,
    createdAt: new Date(2026, 10, 10, 10, 0),
    updatedAt: new Date(2026, 10, 11, 12, 0),
  };
}

describe('заявка → карточка человека (DIG-37)', () => {
  it('имя сотрудника в истории — ссылка на /people/<id>', async () => {
    state.request = requestFixture();
    state.events = [
      {
        id: 'evt-1',
        actorRole: 'STUDENT',
        actorName: 'Анна Ковалёва',
        message: 'Заявка подана через личный кабинет',
        createdAt: new Date(2026, 10, 10, 10, 0),
      },
      {
        id: 'evt-2',
        actorRole: 'STAFF',
        actorName: 'Мария Петрова',
        message: 'Передано в деканат',
        createdAt: new Date(2026, 10, 11, 12, 0),
      },
    ];

    const html = await renderPage();
    expect(html).toContain('href="/people/staff-petrova"');
    expect(html).toContain('Мария Петрова');
    // Имя студента — не ссылка на справочник сотрудников.
    expect(html).not.toContain('href="/people/st-anna"');
  });

  it('сотрудник вне справочника остаётся обычным текстом (без ссылки)', async () => {
    state.request = requestFixture();
    state.events = [
      {
        id: 'evt-3',
        actorRole: 'STAFF',
        actorName: 'Незнакомый Сотрудник',
        message: 'Принято',
        createdAt: new Date(2026, 10, 12, 9, 0),
      },
    ];

    const html = await renderPage();
    expect(html).not.toContain('href="/people/');
    expect(html).toContain('Незнакомый Сотрудник');
  });
});
