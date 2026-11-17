// DIG-41 — контракт страницы /finance («Договоры и оплата», SSR).
// Приёмка: сводка (форма обучения, стипендия, задолженность), договор с
// таймлайном платежей и «Скачать квитанцию» (только платное), документы
// с фильтром и скачиванием, выплаты, действия → мастер заявки; у бюджетника
// экран не пустой; нигде нет банковских реквизитов; сотрудник — пустое состояние.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { FinancePageData } from '@/server/data/finance';
import type { DataCtx } from '@/server/data/types';
import { financeBundleFor } from '@/lib/finance-catalog';

const NOW = new Date('2026-11-17T12:00:00');

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
  page: null as unknown,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getFinancePage: vi.fn(async () => state.page),
}));

import FinancePage from '@/app/(cabinet)/finance/page';

async function renderPage(): Promise<string> {
  const Page = FinancePage as unknown as ComponentType;
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

function pageFixture(funding: string | null): FinancePageData {
  const bundle = financeBundleFor(funding, NOW);
  return {
    student: {
      fullName: 'Анна Ковалёва',
      groupName: 'ПИ-21',
      funding,
    },
    bundle,
  };
}

describe('/finance — бюджетник (DIG-41)', () => {
  it('заголовок и сводка: форма обучения, стипендия, «Задолженности нет»', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture('бюджет');

    const html = await renderPage();
    expect(html).toContain('Финансы');
    expect(html).toContain('data-testid="finance-summary"');
    expect(html).toContain('Бюджетная основа');
    // Приёмка: стипендия видна (вид + сумма + ближайшая выплата).
    const summary = html.match(
      /<div[^>]*data-testid="finance-summary"[\s\S]*?<\/section>\s*<\/div>|<div[^>]*data-testid="finance-summary"[\s\S]*?<\/div>\s*<\/div>/,
    );
    expect(summary).not.toBeNull();
    expect(summary![0]).toContain('Государственная академическая');
    expect(summary![0]).toContain('Ближайшая выплата');
    expect(summary![0]).toContain('Задолженности нет');
    // Выплаты и действия на месте — экран не пустой.
    expect(html).toContain('data-testid="finance-payouts"');
    expect(html).toContain('Материальная помощь');
    expect(html).toContain('data-testid="finance-actions"');
  });

  it('блока договора у бюджетника нет, документы присутствуют', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture('бюджет');

    const html = await renderPage();
    expect(html).not.toContain('data-testid="finance-contract"');
    expect(html).toContain('data-testid="finance-documents"');
    expect(html).toContain('Договор о прохождении практики');
  });
});

describe('/finance — платник (DIG-41)', () => {
  it('договор: номер, стоимость семестра, таймлайн платежей со статусами', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture('контракт');

    const html = await renderPage();
    expect(html).toContain('data-testid="finance-contract"');
    const contract = html.match(/<div[^>]*data-testid="finance-contract"[\s\S]*?<\/ol>/)![0];
    expect(contract).toContain('ДОГ-');
    expect(contract).toContain('96');
    expect(contract).toContain('Оплачено');
    // Таймлайн: каждая точка платежа со статусом.
    const payments = contract.match(/data-testid="finance-payment"/g) ?? [];
    expect(payments.length).toBeGreaterThanOrEqual(2);
    expect(contract).toContain('Оплачен');
    expect(contract).toContain('К оплате');
  });

  it('«Скачать квитанцию» у оплаченного платежа ведёт в PDF-роут', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture('контракт');

    const html = await renderPage();
    const bundle = (state.page as FinancePageData).bundle!;
    const receiptId = bundle.contract!.payments.find((p) => p.status === 'PAID')!.receiptId!;
    expect(html).toContain(`href="/api/finance/documents/${receiptId}"`);
    expect(html).toContain('Скачать квитанцию');
  });

  it('сводка показывает задолженность с суммой и сроком', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture('контракт');

    const html = await renderPage();
    const summary = html.match(
      /<div[^>]*data-testid="finance-summary"[\s\S]*?<\/section>\s*<\/div>|<div[^>]*data-testid="finance-summary"[\s\S]*?<\/div>\s*<\/div>/,
    )![0];
    expect(summary).toContain('К оплате');
    expect(summary).toContain('Договор (платное)');
    expect(summary).not.toContain('Задолженности нет');
  });

  it('документы: пилюли фильтра и «Скачать», действия → мастер заявки', async () => {
    state.ctx = studentCtx;
    state.page = pageFixture('контракт');

    const html = await renderPage();
    expect(html).toContain('data-testid="finance-doc-filter"');
    expect(html).toContain('Допсоглашения');
    expect(html).toContain('Квитанции');
    // Каждая строка документа — ссылка на скачивание демо-PDF.
    expect(html).toMatch(/href="\/api\/finance\/documents\/[^"]+"/);
    // Действия → мастер заявки (предвыбор типа).
    expect(html).toContain('href="/requests?order=fin-material-aid"');
    expect(html).toContain('href="/requests?order=fin-scholarship-cert"');
    expect(html).toContain('Заявление на материальную помощь');
    expect(html).toContain('Справка о размере стипендии');
  });

  it('нигде нет банковских реквизитов и платёжных форм (критерий приёмки)', async () => {
    for (const funding of ['бюджет', 'контракт']) {
      state.ctx = studentCtx;
      state.page = pageFixture(funding);
      const html = await renderPage();
      expect(/БИК|ИНН|КПП|расчётный сч[её]т|р\/с\b|IBAN|SWIFT|оплатить картой/i.test(html)).toBe(
        false,
      );
    }
  });
});

describe('/finance — сотрудник (DIG-41)', () => {
  it('пустое состояние «Экран доступен студентам» без финансовых данных', async () => {
    state.ctx = staffCtx;
    state.page = { student: null, bundle: null };

    const html = await renderPage();
    expect(html).toContain('Экран доступен студентам');
    expect(html).not.toContain('data-testid="finance-summary"');
    expect(html).not.toContain('data-testid="finance-contract"');
  });
});
