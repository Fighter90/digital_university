// DIG-33 — контракт SSR-карточки заявки «ЗД-…» (Figma «06 · Заявки —
// карточка»). Шапка (номер + копирование, пилюля, степпер, срок, «Ведёт»),
// блок доработки с формой, блок готового документа (превью/скачать/
// проверить/email), параметры и вложения, таймлайн истории с «МСК»,
// действия (отмена, вопрос). Сотрудник видит карточку без действий
// студента. Данные замоканы — изолированно от слоя.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { CanonicalRequestEventRow, CanonicalRequestRow } from '@/server/data/types';
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

const state = vi.hoisted(() => ({
  ctx: null as unknown,
  request: null as unknown,
  events: [] as unknown[],
  types: [] as unknown[],
  legacyRequest: null as unknown,
  certificate: null as unknown,
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
    // Реальная notFound() бросает NEXT_NOT_FOUND — здесь то же поведение:
    // чужой/несуществующий номер обязан прерывать рендер 404-ом.
    notFound: () => {
      throw new Error('NEXT_NOT_FOUND');
    },
  };
});

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', async () => {
  const machine =
    await vi.importActual<typeof import('@/lib/request-machine')>('@/lib/request-machine');
  return {
    requireDataCtx: vi.fn(async () => state.ctx),
    getRequestByNumber: vi.fn(async () => state.legacyRequest),
    listRequestEvents: vi.fn(async () => []),
    normalizeRequestNumber: (value: string) => value,
    decodeRequestNumberParam: (value: string) => value,
    getOrCreateCertificateForRequest: vi.fn(async () => state.certificate),
    getCanonicalRequestByNumber: vi.fn(async () => state.request),
    listCanonicalRequestEvents: vi.fn(async () => state.events),
    listCanonicalRequestTypes: vi.fn(async () => state.types),
    isValidCanonicalRequestNumber: (value: string) => value.startsWith('ЗД-'),
    CANONICAL_REQUEST_STATUS_LABELS: machine.CANONICAL_REQUEST_STATUS_LABELS,
    isTerminalRequestStatus: machine.isTerminalRequestStatus,
  };
});

vi.mock('@/server/actions/requests', () => ({
  createRequestAction: vi.fn(async () => null),
  cancelRequestAction: vi.fn(async () => null),
  resubmitRequestAction: vi.fn(async () => null),
  sendRequestDocumentByEmailAction: vi.fn(async () => null),
  createRequestQuestionAction: vi.fn(async () => null),
}));

import RequestDetailPage from '@/app/(cabinet)/requests/[number]/page';

async function renderCard(): Promise<string> {
  const Page = RequestDetailPage as unknown as ComponentType<{
    params: Promise<{ number: string }>;
  }>;
  const { prelude } = await prerenderToNodeStream(
    createElement(Page, { params: Promise.resolve({ number: 'ЗД-2026-000042' }) }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

const WIZARD = {
  destination: 'В банк «Северный»',
  language: 'RU',
  copies: 2,
  delivery: 'PICKUP',
  comment: 'Нужно срочно',
  attachments: [{ name: 'scan-passport.png', size: 1258291 }],
};

const fixRequest: CanonicalRequestRow = {
  id: 'creq-42',
  number: 'ЗД-2026-000042',
  studentId: 'st-anna',
  typeCode: 'CERT_ENROLLMENT',
  typeName: 'Справка об обучении',
  title: 'Справка об обучении · для военкомата',
  params: { purpose: 'для военкомата', wizard: JSON.stringify(WIZARD) },
  status: 'NEEDS_FIX',
  createdAt: new Date('2026-11-14T08:00:00.000Z'),
  updatedAt: new Date('2026-11-15T07:05:00.000Z'),
};

const fixEvents: CanonicalRequestEventRow[] = [
  {
    id: 'cev-1',
    requestId: 'creq-42',
    actorUserId: 'auth-anna',
    actorRole: 'STUDENT',
    actorName: 'Анна Ковалёва',
    fromStatus: null,
    toStatus: 'SUBMITTED',
    comment: null,
    createdAt: new Date('2026-11-14T08:00:00.000Z'),
  },
  {
    id: 'cev-2',
    requestId: 'creq-42',
    actorUserId: 'auth-dean',
    actorRole: 'STAFF',
    actorName: 'Мария Петрова',
    fromStatus: 'SUBMITTED',
    toStatus: 'NEEDS_FIX',
    comment: 'Укажите ФИО латиницей',
    createdAt: new Date('2026-11-15T07:05:00.000Z'),
  },
];

const certType = {
  id: 'crt-cert',
  code: 'CERT_ENROLLMENT',
  name: 'Справка об обучении',
  etaDays: 3,
  format: 'ELECTRONIC',
  isInstant: true,
  formSchema: {
    keyField: 'purpose',
    fields: [
      {
        key: 'purpose',
        label: 'Назначение',
        type: 'enum',
        required: true,
        options: ['для банка', 'для военкомата'],
      },
    ],
  },
};

beforeEach(() => {
  state.ctx = studentCtx;
  state.request = fixRequest;
  state.events = fixEvents;
  state.types = [certType];
  state.legacyRequest = null;
  state.certificate = null;
});

describe('карточка «ЗД-…»: шапка', () => {
  it('номер, кнопка копирования, пилюля статуса, степпер', async () => {
    const html = await renderCard();
    expect(html).toContain('ЗД-2026-000042');
    expect(html).toContain('data-testid="copy-request-number"');
    expect(html).toContain('Нужна доработка'); // пилюля единого словаря
    expect(html).toContain('data-testid="request-stepper"');
    expect(html).toContain('data-testid="request-stepper-compact"');
  });

  it('NEEDS_FIX: срок «после исправления», ведёт последний сотрудник', async () => {
    const html = await renderCard();
    expect(html).toContain('Срок — после исправления');
    expect(html).toContain('Ведёт: Мария Петрова');
  });

  it('SUBMITTED: показывает срок по SLA от подачи', async () => {
    state.request = { ...fixRequest, status: 'SUBMITTED' as const };
    state.events = [fixEvents[0]!];
    const html = await renderCard();
    // Подача — сб 14 ноя: выходные пропускаются, +3 рабочих дня → ср 18 ноя.
    expect(html).toContain('Готовность до 18 ноября');
  });
});

describe('карточка «ЗД-…»: доработка', () => {
  it('красный блок с причиной и форма исправления с «Отправить повторно»', async () => {
    const html = await renderCard();
    expect(html).toContain('data-testid="request-fix-alert"');
    expect(html).toContain('Укажите ФИО латиницей');
    expect(html).toContain('data-testid="request-fix-comment"');
    expect(html).toContain('data-testid="request-resubmit"');
    expect(html).toContain('Отправить повторно');
  });
});

describe('карточка «ЗД-…»: параметры, вложения, история', () => {
  it('параметры с labels типа и мета мастера с вложением', async () => {
    const html = await renderCard();
    expect(html).toContain('Назначение');
    expect(html).toContain('для военкомата');
    expect(html).toContain('Язык');
    expect(html).toContain('Русский');
    expect(html).toContain('Экземпляров');
    expect(html).toContain('Забрать в деканате');
    expect(html).toContain('scan-passport.png');
    expect(html).toContain('1,2 МБ');
  });

  it('таймлайн истории: авторы, переход, комментарий и время в МСК', async () => {
    const html = await renderCard();
    expect(html.match(/data-testid="request-history-item"/g)?.length).toBe(2);
    expect(html).toContain('Подана → Нужна доработка');
    expect(html).toContain('Укажите ФИО латиницей');
    expect(html).toContain('11:00 МСК'); // 08:00 UTC = 11:00 МСК
    expect(html).toContain('10:05 МСК'); // 07:05 UTC = 10:05 МСК
  });
});

describe('карточка «ЗД-…»: готовый документ', () => {
  beforeEach(() => {
    state.request = {
      ...fixRequest,
      status: 'READY' as const,
      params: { purpose: 'для банка' },
      title: 'Справка об обучении · для банка',
      updatedAt: new Date('2026-11-14T08:00:00.000Z'),
    };
    state.events = [fixEvents[0]!];
  });

  it('превью (?inline=1), скачать, проверить, отправить на email', async () => {
    const html = await renderCard();
    expect(html).toContain('data-testid="request-document-preview"');
    expect(html).toContain(encodeURIComponent('ЗД-2026-000042') + '/document?inline=1');
    expect(html).toContain('data-testid="request-document-pdf"');
    expect(html).toContain('data-testid="request-document-verify"');
    expect(html).toContain('href="/verify"');
    expect(html).toContain('data-testid="request-email-send"');
    // Готовой заявке форма исправления не нужна.
    expect(html).not.toContain('data-testid="request-fix-comment"');
  });

  it('без мгновенного документа (бумажный READY) — блок документа не показывается', async () => {
    state.request = { ...(state.request as CanonicalRequestRow), typeCode: 'DIPLOMA_COPY' };
    state.types = [
      certType,
      {
        id: 'crt-diploma',
        code: 'DIPLOMA_COPY',
        name: 'Дубликат диплома',
        etaDays: 5,
        format: 'PAPER',
        isInstant: false,
        formSchema: null,
      },
    ];
    const html = await renderCard();
    expect(html).not.toContain('data-testid="request-document-preview"');
    expect(html).not.toContain('data-testid="request-email-send"');
  });
});

describe('карточка «ЗД-…»: действия', () => {
  it('NEEDS_FIX — отменить можно (до «В работе») и вопрос задать можно', async () => {
    const html = await renderCard();
    expect(html).toContain('data-testid="request-cancel"');
    expect(html).toContain('Задать вопрос по заявке');
  });

  it('терминальный статус — действий нет', async () => {
    state.request = { ...fixRequest, status: 'CANCELLED' as const };
    state.events = [
      fixEvents[0]!,
      {
        id: 'cev-3',
        requestId: 'creq-42',
        actorUserId: 'auth-anna',
        actorRole: 'STUDENT',
        actorName: 'Анна Ковалёва',
        fromStatus: 'NEEDS_FIX',
        toStatus: 'CANCELLED',
        comment: null,
        createdAt: new Date('2026-11-15T10:00:00.000Z'),
      },
    ];
    const html = await renderCard();
    expect(html).not.toContain('data-testid="request-cancel"');
    expect(html).not.toContain('data-testid="request-resubmit"');
    expect(html).not.toContain('data-testid="request-email-send"');
    // Вопрос по заявке уместен и после отмены — форма остаётся.
    expect(html).toContain('Задать вопрос по заявке');
  });
});

describe('карточка «ЗД-…»: сотрудник', () => {
  it('видит карточку без действий студента', async () => {
    state.ctx = staffCtx;
    const html = await renderCard();
    expect(html).toContain('ЗД-2026-000042');
    expect(html).not.toContain('data-testid="request-resubmit"');
    expect(html).not.toContain('data-testid="request-cancel"');
    expect(html).not.toContain('data-testid="request-email-send"');
    expect(html).not.toContain('Задать вопрос по заявке');
  });
});

describe('карточка «ЗД-…»: чужой или отсутствующий номер', () => {
  it('рендер прерывается notFound()', async () => {
    state.request = null;
    await expect(renderCard()).rejects.toThrow('NEXT_NOT_FOUND'); // notFound() из next/navigation
  });
});

// Карточка legacy-мира (SR-…) сохраняет свой поток DIG-12.
describe('карточка «SR-…»', () => {
  it('рендерится по прежнему контракту', async () => {
    state.legacyRequest = {
      id: 'sr-1',
      studentId: 'st-anna',
      number: 'SR-2026-A1B2C',
      type: 'CERTIFICATE',
      title: 'Справка об обучении',
      status: 'COMPLETED',
      assignee: null,
      resultNote: null,
      createdAt: new Date('2026-11-10T10:00:00.000Z'),
      updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    };
    // Выполненная заявка-справка даёт строку реестра DIG-47.
    state.certificate = {
      id: 'cert-1',
      studentId: 'st-anna',
      requestId: 'sr-1',
      documentType: 'Справка об обучении',
      purpose: null,
      number: 'СП-2026-000001',
      verificationCode: 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777',
      issuedAt: new Date('2026-11-10T10:00:00.000Z'),
      expiresAt: new Date('2027-11-10T10:00:00.000Z'),
      revokedAt: null,
      revokedReason: null,
    };
    // dispatch: SR- не канонический номер → legacy-ветка читает getRequestByNumber.
    const Page = RequestDetailPage as unknown as ComponentType<{
      params: Promise<{ number: string }>;
    }>;
    const { prelude } = await prerenderToNodeStream(
      createElement(Page, { params: Promise.resolve({ number: 'SR-2026-A1B2C' }) }),
    );
    let html = '';
    for await (const chunk of prelude) html += String(chunk);
    expect(html).toContain('SR-2026-A1B2C');
    expect(html).toContain('data-testid="certificate-block"'); // DIG-47: реестр справок
  });
});
