// DIG-41 — контракт финансового каталога (чистые данные, red-first).
// Приёмка задачи: у бюджетника экран не пустой (стипендия + выплаты),
// у платника — договор с таймлайном платежей и квитанциями; нигде нет
// реальных реквизитов и платёжных форм; фильтр документов — чистая функция.
import { describe, expect, it } from 'vitest';

import {
  FINANCE_ACTIONS,
  FINANCE_DOC_FILTERS,
  FINANCE_DOC_KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  filterFinanceDocuments,
  financeBundleFor,
  financeDocumentById,
  formatFinanceDate,
  formatMoney,
  isContractFunding,
  type FinanceBundle,
  type FinanceDocument,
} from '@/lib/finance-catalog';

// Фиксированное «сегодня» — все даты каталога считаются от него.
const NOW = new Date('2026-11-17T12:00:00');

/** Запрет банковских реквизитов и платёжных форм (критерий приёмки). */
const REQUISITES_RE = /БИК|ИНН|КПП|расч\.\s*сч|расчётный\s*сч|р\/с\b|IBAN|SWIFT|оплата\s*онлайн/i;

function serialize(bundle: FinanceBundle): string {
  return JSON.stringify(bundle);
}

describe('финансовый каталог: бюджетник (DIG-41)', () => {
  const bundle = financeBundleFor('бюджет', NOW);

  it('экран не пустой: стипендия, выплаты, «Задолженности нет»', () => {
    expect(bundle.summary.fundingLabel).toContain('Бюджет');
    expect(bundle.summary.isContract).toBe(false);
    // Приёмка: стипендия и выплаты есть всегда.
    expect(bundle.summary.scholarship).not.toBeNull();
    expect(bundle.summary.scholarship?.monthlyAmount).toBeGreaterThan(0);
    expect(bundle.summary.scholarship?.kindLabel.trim().length).toBeGreaterThan(2);
    expect(bundle.summary.scholarship?.nextPayoutAt).toBeInstanceOf(Date);
    expect(bundle.payouts.length).toBeGreaterThanOrEqual(4);
    // Задолженности у бюджетника нет.
    expect(bundle.summary.debt).toBeNull();
    expect(bundle.contract).toBeNull();
  });

  it('история выплат: свежие сверху, суммы положительные, есть материальная помощь', () => {
    const dates = bundle.payouts.map((p) => p.paidAt.getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    for (const payout of bundle.payouts) {
      expect(payout.amount).toBeGreaterThan(0);
      expect(payout.title.trim().length).toBeGreaterThan(2);
    }
    expect(bundle.payouts.some((p) => p.kind === 'AID')).toBe(true);
    expect(bundle.payouts.some((p) => p.kind === 'SCHOLARSHIP')).toBe(true);
  });
});

describe('финансовый каталог: платник (DIG-41)', () => {
  const bundle = financeBundleFor('контракт', NOW);

  it('договор: номер, стоимость семестра, таймлайн платежей со статусами', () => {
    expect(bundle.summary.isContract).toBe(true);
    expect(bundle.contract).not.toBeNull();
    const contract = bundle.contract!;
    expect(contract.number.trim().length).toBeGreaterThan(3);
    expect(contract.semesterCost).toBeGreaterThan(0);
    expect(contract.semesterLabel).toMatch(/семестр/i);
    expect(contract.payments.length).toBeGreaterThanOrEqual(2);

    const statuses = new Set(contract.payments.map((p) => p.status));
    expect(statuses.has('PAID')).toBe(true);
    // Демо-ситуация платника: есть платёж «к оплате» с дедлайном.
    const due = contract.payments.find((p) => p.status === 'DUE');
    expect(due).toBeDefined();
    expect(due!.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
    for (const payment of contract.payments) {
      expect(PAYMENT_STATUS_LABELS[payment.status].length).toBeGreaterThan(2);
    }
  });

  it('задолженность в сводке = сумме платежей «к оплате»', () => {
    const dueSum = bundle
      .contract!.payments.filter((p) => p.status === 'DUE')
      .reduce((sum, p) => sum + p.amount, 0);
    expect(bundle.summary.debt).not.toBeNull();
    expect(bundle.summary.debt!.amount).toBe(dueSum);
    expect(bundle.summary.debt!.amount).toBeGreaterThan(0);
  });

  it('у каждого оплаченного платежа — квитанция в списке документов', () => {
    const receipts = bundle.documents.filter((d) => d.kind === 'RECEIPT');
    const receiptIds = new Set(receipts.map((d) => d.id));
    for (const payment of bundle.contract!.payments) {
      if (payment.status === 'PAID') {
        expect(payment.receiptId, payment.id).toBeTruthy();
        expect(receiptIds.has(payment.receiptId!)).toBe(true);
      } else {
        expect(payment.receiptId).toBeNull();
      }
    }
    expect(receipts.length).toBeGreaterThanOrEqual(1);
  });

  it('документы платника: договор и допсоглашение есть, у каждого вид и реквизиты строки', () => {
    const kinds = bundle.documents.map((d) => d.kind);
    expect(kinds).toContain('CONTRACT');
    expect(kinds).toContain('AGREEMENT');
    for (const doc of bundle.documents) {
      expect(FINANCE_DOC_KIND_LABELS[doc.kind].length).toBeGreaterThan(2);
      expect(doc.title.trim().length).toBeGreaterThan(2);
      expect(doc.number.trim().length).toBeGreaterThan(2);
      expect(doc.date).toBeInstanceOf(Date);
    }
  });
});

describe('финансовый каталог: общие инварианты (DIG-41)', () => {
  it('нигде нет банковских реквизитов и платёжных форм (критерий приёмки)', () => {
    for (const funding of ['бюджет', 'контракт', null]) {
      const bundle = financeBundleFor(funding, NOW);
      expect(REQUISITES_RE.test(serialize(bundle)), String(funding)).toBe(false);
      for (const doc of bundle.documents) {
        expect(REQUISITES_RE.test(`${doc.title} ${doc.number}`)).toBe(false);
      }
    }
  });

  it('бюджет и null (форма не указана) — оба без договора, контракты различаются', () => {
    expect(financeBundleFor(null, NOW).summary.isContract).toBe(false);
    expect(isContractFunding('контракт')).toBe(true);
    expect(isContractFunding('Контракт')).toBe(true);
    expect(isContractFunding('бюджет')).toBe(false);
    expect(isContractFunding(null)).toBe(false);
  });

  it('даты детерминированы от now: ближайшая выплата в будущем, долги после now', () => {
    const bundle = financeBundleFor('контракт', NOW);
    expect(bundle.summary.scholarship!.nextPayoutAt.getTime()).toBeGreaterThan(NOW.getTime());
    const due = bundle.contract!.payments.find((p) => p.status === 'DUE')!;
    expect(due.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
    // Оплаченные — в прошлом.
    for (const payment of bundle.contract!.payments) {
      if (payment.status === 'PAID') {
        expect(payment.paidAt!.getTime()).toBeLessThan(NOW.getTime());
      }
    }
  });

  it('filterFinanceDocuments: пилюли — Все + виды каталога, фильтр чистый', () => {
    expect(FINANCE_DOC_FILTERS[0]).toBe('ALL');
    const bundle = financeBundleFor('контракт', NOW);
    const all = bundle.documents;
    expect(filterFinanceDocuments(all, 'ALL')).toEqual(all);
    const receipts = filterFinanceDocuments(all, 'RECEIPT');
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts.every((d: FinanceDocument) => d.kind === 'RECEIPT')).toBe(true);
    // Чистота: исходный список не мутируется, неизвестный фильтр — весь список.
    expect(filterFinanceDocuments(all, 'UNKNOWN' as never)).toEqual(all);
    expect(all.length).toBe(bundle.documents.length);
  });

  it('financeDocumentById находит документ своего набора и не находит чужой', () => {
    const bundle = financeBundleFor('контракт', NOW);
    const doc = bundle.documents[0]!;
    expect(financeDocumentById(bundle, doc.id)).toBe(doc);
    expect(financeDocumentById(bundle, 'no-such-id')).toBeNull();
    // Документ бюджетника недостижим из набора платника.
    const budget = financeBundleFor('бюджет', NOW);
    for (const foreign of budget.documents) {
      expect(financeDocumentById(bundle, foreign.id)).toBeNull();
    }
  });

  it('действия ведут в мастер заявки (параметры заказа каталога DIG-29/31)', () => {
    expect(FINANCE_ACTIONS.map((a) => a.orderParam)).toEqual([
      'fin-material-aid',
      'fin-scholarship-cert',
    ]);
    for (const action of FINANCE_ACTIONS) {
      expect(action.label.trim().length).toBeGreaterThan(4);
      expect(action.description.trim().length).toBeGreaterThan(4);
    }
  });

  it('формат суммы и даты: NBSP-разряды и знак ₽, дата — «день месяц»', () => {
    expect(formatMoney(48000)).toBe('48\u00A0000\u00A0₽');
    expect(formatMoney(3620)).toBe('3\u00A0620\u00A0₽');
    expect(formatFinanceDate(new Date('2026-11-25T10:00:00'))).toBe('25\u00A0ноября');
    expect(FINANCE_DOC_FILTERS).toContain('ACT');
    expect(FINANCE_DOC_FILTERS).toContain('INVOICE');
  });
});
