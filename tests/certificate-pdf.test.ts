// DIG-31 — PDF мгновенной справки: модель строк + сборка.
// Красная фаза: контракт зафиксирован ДО реализации.
//
// Приёмка задачи: «для мгновенных — сразу кнопка „Скачать PDF"». Документ
// собирается писателем DIG-27 (векторный шрифт без вложенных файлов),
// данные только вымышленные, на документе плашка «Концепт для конкурса».
// Код проверки — формат DIG-47 (сейчас рамка под QR, сканируемый QR позже).
import { describe, expect, it } from 'vitest';

import {
  buildCertificatePdf,
  certificateFilename,
  certificateLines,
  type CertificateData,
} from '@/lib/certificate-pdf';
import { hasGlyphFor } from '@/lib/pdf/vector-font';

const NOW = new Date(2026, 10, 16, 12, 0, 0);

const data: CertificateData = {
  title: 'Справка об обучении',
  number: 'SR-2026-A1B2C',
  issuedAt: NOW,
  code: 'ABCD-EFGH-JKLM-NOPQ',
  student: {
    fullName: 'Анна Ковалёва',
    groupName: 'ПИ-21',
    course: 2,
    program: 'Прикладная информатика',
    gradebookNumber: '20231234',
  },
};

describe('certificate-pdf: модель строк', () => {
  it('строки содержат документ, студента, номер заявки и дату выдачи', () => {
    const lines = certificateLines(data);
    const text = lines.join('\n');
    expect(text).toContain('Справка об обучении');
    expect(text).toContain('Анна Ковалёва');
    expect(text).toContain('ПИ-21');
    expect(text).toContain('Прикладная информатика');
    expect(text).toContain('20231234');
    expect(text).toContain('SR-2026-A1B2C');
    expect(text).toContain('16.11.2026');
    expect(text).toContain('Концепт для конкурса');
    expect(text).toContain('ABCD-EFGH-JKLM-NOPQ');
  });

  it('без данных студента документ остаётся корректным (плейсхолдеры вместо ФИО)', () => {
    const lines = certificateLines({ ...data, student: null });
    expect(lines.join('\n')).toContain('Студент: —');
  });

  it('все символы строк покрыты векторным шрифтом (нет рамок-заглушек)', () => {
    const missing = new Set<string>();
    for (const line of certificateLines(data)) {
      for (const ch of line) {
        if (!hasGlyphFor(ch)) missing.add(ch);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('certificate-pdf: сборка файла', () => {
  it('детерминирована при равных входах и является валидным PDF-каркасом', () => {
    const a = buildCertificatePdf(data);
    const b = buildCertificatePdf(data);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    const head = Buffer.from(a.slice(0, 8)).toString('latin1');
    expect(head.startsWith('%PDF-1.')).toBe(true);
    const tail = Buffer.from(a.slice(-5)).toString('latin1');
    expect(tail).toBe('%%EOF');
    expect(a.byteLength).toBeGreaterThan(1000);
  });

  it('имя файла ASCII с номером заявки (кириллица в Content-Disposition запрещена)', () => {
    const name = certificateFilename('SR-2026-A1B2C');
    expect(name).toBe('certificate-SR-2026-A1B2C.pdf');
    expect(/^[\x20-\x7e]+$/.test(name)).toBe(true);
  });
});
