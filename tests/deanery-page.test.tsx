// DIG-39 — контракт страниц «Обращения в деканат» (SSR, unit).
// Приёмка: список (тема, номер, статус, последний ответ, время, точка
// непрочитанного) + обещание срока; чат (аватар, ФИО, «Менеджер программы»,
// вложения, «Прочитано»); композер (5 тем, вложения, привязка к заявке и
// дисциплине, «Возможно, это ответ на ваш вопрос»); две панели на десктопе
// (aside скрыт на мобильном), отдельный экран чата на мобильном; состояние
// сотрудника «Доступно студентам»; чужой/несуществующий номер → notFound().
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { DeaneryPageData, TicketChatData, TicketListItem } from '@/server/data/deanery';
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
  page: null as DeaneryPageData | null,
  chat: null as TicketChatData | null,
  notFoundCalled: false,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/data')>();
  return {
    ...original,
    requireDataCtx: vi.fn(async () => state.ctx),
    getDeaneryPage: vi.fn(async () => state.page),
    openTicketChat: vi.fn(async () => state.chat),
  };
});

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    state.notFoundCalled = true;
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
}));

import DeaneryPage from '@/app/(cabinet)/deanery/(list)/page';
import TicketChatPage from '@/app/(cabinet)/deanery/[number]/page';
import { TicketComposer } from '@/components/deanery/ticket-composer';

async function render(node: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node);
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

async function renderListPage(searchParams?: Record<string, string>): Promise<string> {
  const Page = DeaneryPage as unknown as ComponentType<{
    searchParams?: Promise<Record<string, string>>;
  }>;
  return render(
    createElement(Page, {
      searchParams: Promise.resolve(searchParams ?? {}),
    }),
  );
}

async function renderChatPage(number = 'TS-2026-AB12C'): Promise<string> {
  const Page = TicketChatPage as unknown as ComponentType<{ params: Promise<{ number: string }> }>;
  return render(createElement(Page, { params: Promise.resolve({ number }) }));
}

function ticketFixture(overrides: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: 'tkt-1',
    studentId: 'st-anna',
    number: 'TS-2026-AB12C',
    subject: 'GRADES',
    status: 'ANSWERED',
    assigneeUserId: 'auth-maria',
    requestNumber: 'SR-2026-AAAAA',
    disciplineCode: 'PI21-DB',
    createdAt: new Date(2026, 10, 12, 10, 0),
    updatedAt: new Date(2026, 10, 14, 15, 30),
    lastMessage: {
      authorRole: 'STAFF',
      body: 'Добрый день! Проверим ведомость и вернёмся с ответом.',
      createdAt: new Date(2026, 10, 14, 15, 30),
    },
    unreadStaffCount: 1,
    ...overrides,
  };
}

function pageFixture(): DeaneryPageData {
  return {
    tickets: [
      ticketFixture(),
      ticketFixture({
        id: 'tkt-2',
        number: 'TS-2026-CD34E',
        subject: 'ACADEMIC_LEAVE',
        status: 'OPEN',
        requestNumber: null,
        disciplineCode: null,
        updatedAt: new Date(2026, 10, 15, 9, 0),
        lastMessage: {
          authorRole: 'STUDENT',
          body: 'Как оформить академический отпуск?',
          createdAt: new Date(2026, 10, 15, 9, 0),
        },
        unreadStaffCount: 0,
      }),
    ],
    requests: [{ number: 'SR-2026-AAAAA', title: 'Справка об обучении' }],
    disciplines: [
      { code: 'PI21-DB', name: 'Базы данных' },
      { code: 'PI21-PROG', name: 'Программирование' },
    ],
  };
}

function chatFixture(): TicketChatData {
  return {
    ticket: ticketFixture({ unreadStaffCount: 0 }),
    messages: [
      {
        id: 'm-1',
        ticketId: 'tkt-1',
        authorRole: 'STUDENT',
        authorName: 'Анна Ковалёва',
        body: 'Проверьте, пожалуйста, оценку за проект по базам данных.',
        attachments: ['скрин-ведомости.png'],
        createdAt: new Date(2026, 10, 12, 10, 0),
        readAt: new Date(2026, 10, 14, 15, 29),
      },
      {
        id: 'm-2',
        ticketId: 'tkt-1',
        authorRole: 'STAFF',
        authorName: 'Мария Петрова',
        body: 'Добрый день! Проверим ведомость и вернёмся с ответом.',
        attachments: ['скан-ведомости.pdf'],
        createdAt: new Date(2026, 10, 14, 15, 30),
        readAt: new Date(2026, 10, 14, 18, 0),
      },
    ],
  };
}

describe('/deanery — список обращений (студент)', () => {
  it('заголовок и обещание срока на экране', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage();
    expect(html).toContain('Обращения в деканат');
    expect(html).toContain('Обычно отвечаем в течение 1 рабочего дня');
    expect(html).toContain('data-testid="deanery-list"');
  });

  it('карточка списка: тема, номер, статус, последний ответ, время, точка непрочитанного', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage();
    const card = html.match(/<a[^>]*data-testid="deanery-ticket-TS-2026-AB12C"[\s\S]*?<\/a>/);
    expect(card).not.toBeNull();
    expect(card![0]).toContain('href="/deanery/TS-2026-AB12C"');
    expect(card![0]).toContain('Оценки');
    expect(card![0]).toContain('TS-2026-AB12C');
    expect(card![0]).toContain('Ждём вас');
    expect(card![0]).toContain('Проверим ведомость');
    // Непрочитанный ответ менеджера — точкой (тест-ид).
    expect(card![0]).toContain('data-testid="ticket-unread"');

    // Решённая карточка без точки, статус другой.
    const second = html.match(/<a[^>]*data-testid="deanery-ticket-TS-2026-CD34E"[\s\S]*?<\/a>/)!;
    expect(second[0]).toContain('Академический отпуск');
    expect(second[0]).toContain('Открыто');
    expect(second[0]).not.toContain('data-testid="ticket-unread"');
  });

  it('две панели на десктопе: список и композер в сетке lg', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage();
    expect(html).toMatch(/lg:grid-cols/);
    expect(html).toContain('data-testid="deanery-composer"');
  });

  it('сотруднику список недоступен: «Доступно студентам»', async () => {
    state.ctx = staffCtx;
    state.page = { tickets: [], requests: [], disciplines: [] };

    const html = await renderListPage();
    expect(html).toContain('Доступно студентам');
    expect(html).not.toContain('data-testid="deanery-list"');
    expect(html).not.toContain('data-testid="deanery-composer"');
  });

  // DIG-38: «Написать в деканат» из пустого состояния /help переносит текст
  // запроса в параметр q — композер открывается с готовым текстом обращения.
  it('?q= из базы знаний предзаполняет текст нового обращения', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage({ q: 'не нашёл про пересдачу' });
    const composer = html.match(
      /<section[^>]*data-testid="deanery-composer"[\s\S]*?<\/section>/,
    )![0];
    expect(composer).toContain('не нашёл про пересдачу');
  });
});

describe('/deanery — композер нового обращения', () => {
  it('пять тем из задачи, вложения, привязка к заявке и дисциплине', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();

    const html = await renderListPage();
    const composer = html.match(
      /<section[^>]*data-testid="deanery-composer"[\s\S]*?<\/section>/,
    )![0];
    for (const subject of ['Учебный план', 'Оценки', 'Перевод', 'Академический отпуск', 'Другое']) {
      expect(composer).toContain(subject);
    }
    expect(composer).toContain('name="attachments"');
    expect(composer).toContain('name="requestNumber"');
    expect(composer).toContain('SR-2026-AAAAA');
    expect(composer).toContain('name="disciplineCode"');
    expect(composer).toContain('PI21-DB');
  });

  it('подсказки FAQ: «Возможно, это ответ на ваш вопрос» по набранному тексту', async () => {
    const html = await render(
      createElement(TicketComposer, {
        requests: [{ number: 'SR-2026-AAAAA', title: 'Справка об обучении' }],
        disciplines: [{ code: 'PI21-DB', name: 'Базы данных' }],
        initialBody: 'как взять академический отпуск',
      }),
    );
    expect(html).toContain('Возможно, это ответ на ваш вопрос');
    expect(html).toContain('data-testid="faq-hints"');
    expect(html.toLowerCase()).toContain('академический отпуск');
  });

  it('без текста подсказок нет', async () => {
    const html = await render(createElement(TicketComposer, { requests: [], disciplines: [] }));
    expect(html).not.toContain('data-testid="faq-hints"');
    expect(html).toContain('data-testid="deanery-composer-form"');
  });
});

describe('/deanery/[number] — чат обращения', () => {
  it('две панели на десктопе: список слева скрыт на мобильном, чат справа', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();
    state.chat = chatFixture();

    const html = await renderChatPage();
    const aside = html.match(/<(?:aside|div)[^>]*data-testid="deanery-chat-aside"[^>]*>/)![0];
    expect(aside).toMatch(/hidden/);
    expect(aside).toMatch(/lg:flex/);
    // В aside — тот же список ссылок на обращения.
    expect(html).toContain('href="/deanery/TS-2026-CD34E"');
    // Мобильный — отдельный экран чата: шапка с возвратом к списку.
    expect(html).toContain('href="/deanery"');
    expect(html).toContain('data-testid="ticket-chat"');
  });

  it('шапка чата: тема, номер, статус, обещание срока', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();
    state.chat = chatFixture();

    const html = await renderChatPage();
    expect(html).toContain('Оценки');
    expect(html).toContain('TS-2026-AB12C');
    expect(html).toContain('Ждём вас');
    expect(html).toContain('Обычно отвечаем в течение 1 рабочего дня');
  });

  it('сообщения: аватар, ФИО, «Менеджер программы», вложения, время', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();
    state.chat = chatFixture();

    const html = await renderChatPage();
    const chat = html.match(/<ol[^>]*data-testid="ticket-chat"[\s\S]*?<\/ol>/)![0];
    expect(chat).toContain('aria-label="Анна Ковалёва"');
    expect(chat).toContain('aria-label="Мария Петрова"');
    expect(chat).toContain('Менеджер программы');
    expect(chat).toContain('Проверьте, пожалуйста, оценку');
    expect(chat).toContain('Добрый день! Проверим ведомость');
    expect(chat).toContain('data-testid="ticket-attachment"');
    expect(chat).toContain('скрин-ведомости.png');
    expect(chat).toContain('скан-ведомости.pdf');
  });

  it('статус «Прочитано» — на сообщениях студента, прочитанных менеджером', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();
    state.chat = chatFixture();

    const html = await renderChatPage();
    // Срез от начала сообщения студента до конца списка: внутренние <li>
    // вложений не должны обрезать проверку (регэксп до первого </li> лжёт).
    const from = html.indexOf('data-testid="ticket-message-m-1"');
    const to = html.indexOf('</ol>');
    expect(from).toBeGreaterThan(0);
    const studentMsg = html.slice(from, to);
    expect(studentMsg).toContain('Прочитано');
  });

  it('форма ответа в чате: номер тикета скрытым полем, текст и вложения', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture();
    state.chat = chatFixture();

    const html = await renderChatPage();
    const form = html.match(/<form[^>]*data-testid="ticket-reply"[\s\S]*?<\/form>/)![0];
    expect(form).toContain('name="ticketNumber" value="TS-2026-AB12C"');
    expect(form).toContain('name="body"');
    expect(form).toContain('name="attachments"');
    expect(form).toContain('Отправить');
  });

  it('чужой/несуществующий номер → notFound()', async () => {
    state.ctx = studentCtx;
    state.chat = null;
    state.notFoundCalled = false;

    await expect(renderChatPage('TS-2026-ZZZZZ')).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(state.notFoundCalled).toBe(true);
  });

  it('некорректный percent-encoding в номере → notFound(), а не 500 (раунд 2 ревью)', async () => {
    state.ctx = studentCtx;
    state.chat = null;
    state.notFoundCalled = false;

    // decodeURIComponent на битом percent-encoding бросает URIError —
    // страница обязана отдать тот же контрактный 404 (единый notFound),
    // что для чужого/несуществующего номера, а не 500. Через реальный HTTP
    // битые последовательности отсекает сам Next (400); этот юнит —
    // защитный контракт страницы (см. e2e: status 400|404, не 500).
    await expect(renderChatPage('%zz')).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(state.notFoundCalled).toBe(true);
  });
});
