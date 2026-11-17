// DIG-40 — контракт страниц «Обратная связь руководству» (SSR, unit).
// Приёмка: пункт меню с понятным названием (см. cabinet-shell), композер
// (3 типа, 4 адресата, текст, вложения, «Анонимно» с объяснением, что увидит
// адресат), после отправки — номер и срок ответа, лента «Что мы изменили по
// вашим предложениям», состояние сотрудника «Доступно студентам»; карточка
// по чужому/несуществующему/анонимному номеру → notFound(); подтверждение
// по номеру не раскрывает текст и пользовательские данные.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { FeedbackPageData, FeedbackSentView } from '@/server/data/feedback';
import type { DataCtx, FeedbackRow } from '@/server/data/types';

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
  page: null as FeedbackPageData | null,
  card: null as unknown,
  sent: null as FeedbackSentView | null,
  notFoundCalled: false,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/data')>();
  return {
    ...original,
    requireDataCtx: vi.fn(async () => state.ctx),
    getFeedbackPage: vi.fn(async () => state.page),
    openFeedbackCard: vi.fn(async () => state.card),
    getFeedbackSentView: vi.fn(async () => state.sent),
  };
});

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    state.notFoundCalled = true;
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
}));

import FeedbackPage from '@/app/(cabinet)/feedback/(list)/page';
import FeedbackCardPage from '@/app/(cabinet)/feedback/[number]/page';
import FeedbackSentPage from '@/app/(cabinet)/feedback/sent/[number]/page';
import { FeedbackComposer } from '@/components/feedback/feedback-composer';

async function render(node: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node);
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

async function renderListPage(): Promise<string> {
  const Page = FeedbackPage as unknown as ComponentType;
  return render(createElement(Page));
}

async function renderCardPage(number = 'FB-2026-AB12C'): Promise<string> {
  const Page = FeedbackCardPage as unknown as ComponentType<{
    params: Promise<{ number: string }>;
  }>;
  return render(createElement(Page, { params: Promise.resolve({ number }) }));
}

async function renderSentPage(number = 'FB-2026-AB12C'): Promise<string> {
  const Page = FeedbackSentPage as unknown as ComponentType<{
    params: Promise<{ number: string }>;
  }>;
  return render(createElement(Page, { params: Promise.resolve({ number }) }));
}

function cardFixture(): FeedbackRow {
  return {
    id: 'fb-1',
    studentId: 'st-anna',
    number: 'FB-2026-AB12C',
    kind: 'SUGGESTION',
    target: 'DEANERY',
    status: 'NEW',
    text: 'Добавьте, пожалуйста, фильтр по корпусу в расписании.',
    attachments: ['скрин-расписания.png'],
    isAnonymous: false,
    publishedOutcome: null,
    createdAt: new Date(2026, 10, 12, 10, 0),
    dueAt: new Date(2026, 10, 17, 10, 0),
    updatedAt: new Date(2026, 10, 12, 10, 0),
  };
}

function pageFixture(): FeedbackPageData {
  return {
    items: [
      cardFixture(),
      {
        ...cardFixture(),
        id: 'fb-2',
        number: 'FB-2026-CD34E',
        kind: 'GRATITUDE',
        target: 'PROGRAM_MANAGEMENT',
        status: 'ANSWERED',
        text: 'Спасибо за консультации перед сессией!',
        attachments: [],
        createdAt: new Date(2026, 10, 10, 9, 0),
        dueAt: new Date(2026, 10, 13, 9, 0),
        updatedAt: new Date(2026, 10, 11, 12, 0),
      },
    ],
    feed: [
      {
        number: 'FB-2026-OUT01',
        kind: 'SUGGESTION',
        target: 'DEANERY',
        suggestion: 'Сделайте запись к специалисту деканата из кабинета',
        outcome: 'Запись появилась в разделе «Связь с деканатом»',
        resolvedAt: new Date(2026, 9, 1, 12, 0),
      },
      {
        number: 'FB-2026-OUT02',
        kind: 'SUGGESTION',
        target: 'ACADEMIC_OFFICE',
        suggestion: 'Показывайте срок готовности справок при заказе',
        outcome: 'Срок готовности виден при заказе заявки',
        resolvedAt: new Date(2026, 9, 5, 12, 0),
      },
      {
        number: 'FB-2026-OUT03',
        kind: 'SUGGESTION',
        target: 'UNIVERSITY_MANAGEMENT',
        suggestion: 'Добавьте фильтр по корпусу в расписание',
        outcome: 'В расписании появился выбор корпуса',
        resolvedAt: new Date(2026, 9, 10, 12, 0),
      },
    ],
  };
}

function sentFixture(): FeedbackSentView {
  return {
    number: 'FB-2026-XY78Z',
    kind: 'COMPLAINT',
    target: 'UNIVERSITY_MANAGEMENT',
    status: 'NEW',
    createdAt: new Date(2026, 10, 16, 10, 0),
    dueAt: new Date(2026, 10, 19, 10, 0),
    isAnonymous: true,
    publishedOutcome: null,
  };
}

describe('/feedback — экран (студент)', () => {
  it('заголовок, обещание срока и список обращений', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage();
    expect(html).toContain('Обратная связь руководству');
    expect(html).toContain('Рассматриваем обращения в течение 3 рабочих дней');
    expect(html).toContain('data-testid="feedback-list"');
    // Статусы видимых обращений — в списке (приёмка «статус в Обращениях»).
    expect(html).toContain('На рассмотрении');
    expect(html).toContain('Отвечено');
  });

  it('карточка списка: тип, адресат, номер, статус, срок ответа', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage();
    const card = html.match(/<a[^>]*data-testid="feedback-item-FB-2026-AB12C"[\s\S]*?<\/a>/);
    expect(card).not.toBeNull();
    expect(card![0]).toContain('href="/feedback/FB-2026-AB12C"');
    expect(card![0]).toContain('Предложение');
    expect(card![0]).toContain('Деканат');
    expect(card![0]).toContain('FB-2026-AB12C');
    expect(card![0]).toContain('На рассмотрении');
    expect(card![0]).toContain('до 17 ноября');
  });

  it('композер: 3 типа, 4 адресата, текст, вложения, «Анонимно» с объяснением', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage();
    const composer = html.match(
      /<section[^>]*data-testid="feedback-composer"[\s\S]*?<\/section>/,
    )![0];
    for (const label of ['Предложение', 'Жалоба', 'Благодарность']) {
      expect(composer).toContain(label);
    }
    for (const label of ['Деканат', 'Учебный офис', 'Руководство программы', 'Руководство вуза']) {
      expect(composer).toContain(label);
    }
    expect(composer).toContain('name="kind"');
    expect(composer).toContain('name="target"');
    expect(composer).toContain('name="text"');
    expect(composer).toContain('name="attachments"');
    expect(composer).toContain('name="anonymous"');
    // Объяснение анонимности: что увидит адресат (видно по умолчанию — OFF).
    expect(composer).toContain('data-testid="feedback-anonymous-note"');
    expect(composer).toContain('Адресат увидит');
  });

  it('публичная лента «Что мы изменили по вашим предложениям»: 3 примера без авторов', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage();
    expect(html).toContain('Что мы изменили по вашим предложениям');
    expect(html).toContain('data-testid="feedback-outcomes"');
    expect(html).toContain('Запись появилась в разделе «Связь с деканатом»');
    expect(html).toContain('Срок готовности виден при заказе заявки');
    expect(html).toContain('В расписании появился выбор корпуса');
    const feed = html.match(/<section[^>]*data-testid="feedback-outcomes"[\s\S]*?<\/section>/)![0];
    expect(feed).not.toContain('Анна');
    expect(feed).not.toContain('studentId');
  });

  it('сотруднику раздел недоступен: «Доступно студентам»', async () => {
    state.ctx = staffCtx;
    state.page = { items: [], feed: [] };

    const html = await renderListPage();
    expect(html).toContain('Доступно студентам');
    expect(html).not.toContain('data-testid="feedback-list"');
    expect(html).not.toContain('data-testid="feedback-composer"');
  });

  it('пустой список: пустое состояние с призывом создать обращение', async () => {
    state.ctx = studentCtx;
    state.page = { items: [], feed: pageFixture().feed };

    const html = await renderListPage();
    expect(html).toContain('Обращений пока нет');
    expect(html).toContain('data-testid="feedback-composer"');
  });
});

describe('FeedbackComposer — объяснение «Анонимно» переключается', () => {
  it('объяснение по умолчанию (не анонимно)', async () => {
    const html = await render(createElement(FeedbackComposer));
    expect(html).toContain('data-testid="feedback-anonymous-note"');
    expect(html).toContain('имя и учебную группу');
  });

  it('включённое «Анонимно» в тестах контракта проверяется на клиенте (e2e), SSR даёт обе подписи в файле', async () => {
    // SSR не выполняет JS — переключение проверяет e2e; здесь пиним, что
    // оба текста объяснения существуют в модуле (источник правды один).
    const lib = await import('@/lib/feedback');
    expect(lib.ANONYMOUS_EXPLANATION_ON).toContain('без вашего имени');
    expect(lib.ANONYMOUS_EXPLANATION_OFF).toContain('имя и учебную группу');
  });
});

describe('/feedback/[number] — карточка обращения', () => {
  it('своя карточка: тип, адресат, номер, статус, срок, текст, вложения', async () => {
    state.ctx = studentCtx;
    state.card = cardFixture();

    const html = await renderCardPage('FB-2026-AB12C');
    expect(html).toContain('Предложение');
    expect(html).toContain('Деканат');
    expect(html).toContain('FB-2026-AB12C');
    expect(html).toContain('На рассмотрении');
    expect(html).toContain('до 17 ноября');
    expect(html).toContain('фильтр по корпусу');
    expect(html).toContain('скрин-расписания.png');
    expect(html).toContain('href="/feedback"');
  });

  it('чужой/несуществующий номер → notFound()', async () => {
    state.ctx = studentCtx;
    state.card = null;
    state.notFoundCalled = false;

    await expect(renderCardPage('FB-2026-ZZZZZ')).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(state.notFoundCalled).toBe(true);
  });

  it('номер анонимного обращения → notFound() всем, включая автора сессии', async () => {
    state.ctx = studentCtx;
    // Слой данных возвращает null и для анонимных (связи с владельцем нет).
    state.card = null;
    state.notFoundCalled = false;

    await expect(renderCardPage('FB-2026-DDD04')).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(state.notFoundCalled).toBe(true);
  });
});

describe('/feedback/sent/[number] — подтверждение по номеру', () => {
  it('номер, статус, срок и пояснение анонимности — без текста обращения', async () => {
    state.ctx = studentCtx;
    state.sent = sentFixture();

    const html = await renderSentPage('FB-2026-XY78Z');
    expect(html).toContain('FB-2026-XY78Z');
    expect(html).toContain('На рассмотрении');
    expect(html).toContain('до 19 ноября');
    expect(html).toContain('Жалоба');
    expect(html).toContain('Руководство вуза');
    // Анонимное: явное пояснение и никакого текста/вложений/пользовательских данных.
    expect(html).toContain('не связано с вашим аккаунтом');
    expect(html).not.toContain('Анна');
    expect(html).not.toContain('studentId');
  });

  it('несуществующий номер → notFound()', async () => {
    state.ctx = studentCtx;
    state.sent = null;
    state.notFoundCalled = false;

    await expect(renderSentPage('FB-2026-ZZZZZ')).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(state.notFoundCalled).toBe(true);
  });
});
