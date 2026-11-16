// DIG-30 — PDF «Справка об обучении» (мгновенная заявка).
// Контракт как у выписки DIG-27: каждый символ покрыт глифами векторного
// шрифта (кириллица без вложенных шрифтов), вывод детерминирован при
// равных входах, на документе плашка «Концепт для конкурса».
import { describe, expect, it } from 'vitest';
import { hasGlyphFor } from '@/lib/pdf/vector-font';
import {
  buildEnrollmentCertificatePdf,
  certificateFilename,
  certificateLines,
  certificateValidUntil,
  CERTIFICATE_VALIDITY_DAYS,
} from '@/lib/enrollment-certificate-pdf';

const NOW = new Date('2026-11-13T12:00:00');

const data = {
  student: {
    fullName: 'Анна Ковалёва',
    groupName: 'ПИ-21',
    course: 2,
    faculty: 'ИТ',
    program: 'Прикладная информатика',
    studyForm: 'очная',
    gradebookNumber: '20231234',
  },
  purpose: 'для банка',
};

const options = { now: NOW, code: 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567', requestNumber: 'ЗД-2026-000123' };

describe('certificate-pdf: справка об обучении (DIG-30)', () => {
  it('содержит реквизиты: ФИО, группа, назначение, номер заявки, плашку концепта', () => {
    const lines = certificateLines(data, options);
    const text = lines.join('\n');
    expect(text).toContain('Справка об обучении');
    expect(text).toContain('Анна Ковалёва');
    expect(text).toContain('ПИ-21');
    expect(text).toContain('для банка');
    expect(text).toContain('ЗД-2026-000123');
    expect(text).toContain('Концепт для конкурса');
    expect(text).toContain(options.code);
  });

  it('каждый символ строк покрыт глифами векторного шрифта (кириллица без fallback)', () => {
    const lines = certificateLines(data, options);
    const missing = new Set<string>();
    for (const line of lines) {
      for (const ch of line) {
        if (!hasGlyphFor(ch)) missing.add(ch);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('PDF детерминирован при равных входах и начинается с %PDF', () => {
    const first = buildEnrollmentCertificatePdf(data, options);
    const second = buildEnrollmentCertificatePdf(data, options);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(Buffer.from(first).subarray(0, 8).toString('latin1')).toMatch(/^%PDF-1\.4/);
  });

  it('срок действия — 30 дней; имя файла ASCII', () => {
    expect(CERTIFICATE_VALIDITY_DAYS).toBe(30);
    expect(certificateValidUntil(NOW)).toEqual(new Date('2026-12-13T12:00:00'));
    expect(certificateFilename(NOW)).toBe('certificate-2026-11-13.pdf');
    expect(/^[\x20-\x7e]+$/.test(certificateFilename(NOW))).toBe(true);
  });
});
