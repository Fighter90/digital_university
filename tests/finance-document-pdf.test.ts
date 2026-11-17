// DIG-41 — демо-PDF финансового документа (квитанция/договор/акт/счёт).
// Контракт как у выписки DIG-27: кириллица векторным шрифтом (глиф на каждый
// символ), вывод детерминирован при равных входах, на документе плашка
// «Концепт для конкурса» и пометка «не является платёжным документом».
// Банковских реквизитов в строках документа быть не должно (критерий приёмки).
import { describe, expect, it } from 'vitest';
import { hasGlyphFor } from '@/lib/pdf/vector-font';

import {
  buildFinanceDocumentPdf,
  financeDocumentFilename,
  financeDocumentPdfLines,
  type FinanceDocumentPdfInput,
} from '@/lib/finance-document-pdf';

const NOW = new Date('2026-11-17T12:00:00');

const receipt: FinanceDocumentPdfInput = {
  kindLabel: 'Квитанция',
  title: 'Квитанция на оплату по договору',
  number: 'КВ-2026-0041',
  date: new Date('2026-09-05T10:00:00'),
  studentName: 'Илья Смирнов',
  groupName: 'ЭК-11',
  rows: [
    { label: 'Договор', value: 'ДОГ-2025-0147 от 20.08.2025' },
    { label: 'Период', value: 'Осенний семестр 2026/27' },
    { label: 'Платёж', value: 'Первый платёж — сентябрь' },
    { label: 'Статус', value: 'Оплачен 05.09.2026' },
  ],
  amountLabel: 'Сумма платежа',
  amountValue: '48 000 руб.',
};

describe('finance-document-pdf: квитанция (DIG-41)', () => {
  it('содержит реквизиты демо-документа и плашку концепта, без банковских реквизитов', () => {
    const lines = financeDocumentPdfLines(receipt, { now: NOW });
    const text = lines.join('\n');
    expect(text).toContain('Квитанция на оплату по договору');
    expect(text).toContain('КВ-2026-0041');
    expect(text).toContain('Илья Смирнов');
    expect(text).toContain('ЭК-11');
    expect(text).toContain('48 000 руб.');
    expect(text).toContain('Концепт для конкурса');
    expect(text).toContain('не является платёжным документом');
    // Критерий приёмки: никаких реквизитов банка.
    expect(/БИК|ИНН|КПП|расчётный сч|р\/с\b|IBAN|SWIFT/i.test(text)).toBe(false);
  });

  it('каждый символ строк покрыт глифами векторного шрифта (кириллица без fallback)', () => {
    const lines = financeDocumentPdfLines(receipt, { now: NOW });
    const missing = new Set<string>();
    for (const line of lines) {
      for (const ch of line) {
        if (!hasGlyphFor(ch)) missing.add(ch);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('PDF детерминирован при равных входах и валиден по заголовку', () => {
    const a = buildFinanceDocumentPdf(receipt, { now: NOW });
    const b = buildFinanceDocumentPdf(receipt, { now: NOW });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Buffer.from(a.slice(0, 5)).toString('ascii')).toBe('%PDF-');
  });

  it('имя файла — ASCII, без кириллицы', () => {
    const filename = financeDocumentFilename(receipt, NOW);
    expect(filename).toMatch(/^[a-z0-9-]+\.pdf$/);
    expect(filename.endsWith('.pdf')).toBe(true);
  });

  it('договор рендерит стоимость и программу без суммы к оплате', () => {
    const contract: FinanceDocumentPdfInput = {
      kindLabel: 'Договор',
      title: 'Договор на обучение',
      number: 'ДОГ-2025-0147',
      date: new Date('2025-08-20T10:00:00'),
      studentName: 'Илья Смирнов',
      groupName: 'ЭК-11',
      rows: [
        { label: 'Программа', value: 'Экономика (бакалавриат), очная форма' },
        { label: 'Семестр', value: 'Осенний семестр 2026/27' },
        { label: 'Стоимость семестра', value: '96 000 руб.' },
      ],
      amountLabel: null,
      amountValue: null,
    };
    const text = financeDocumentPdfLines(contract, { now: NOW }).join('\n');
    expect(text).toContain('Договор на обучение');
    expect(text).toContain('Экономика');
    expect(text).toContain('96 000 руб.');
    expect(text).toContain('Концепт для конкурса');
  });
});
