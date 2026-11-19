// DIG-30 — PDF «Справка об обучении» (мгновенная заявка).
// Контракт как у выписки DIG-27: каждый символ покрыт глифами векторного
// шрифта (кириллица без вложенных шрифтов), вывод детерминирован при
// равных входах, на документе плашка «Концепт для конкурса».
// DIG-82 — документ несёт сканируемый QR со ссылкой на /verify/<код>.
import { describe, expect, it } from 'vitest';
import { hasGlyphFor } from '@/lib/pdf/vector-font';
import { decodeQrMatrix } from './helpers/qr-decode';
import {
  buildEnrollmentCertificatePdf,
  certificateFilename,
  certificateLines,
  certificateQrMatrix,
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

const VERIFY_URL = 'http://localhost:3000/verify/ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567';
const options = {
  now: NOW,
  code: 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567',
  requestNumber: 'ЗД-2026-000123',
  verifyUrl: VERIFY_URL,
};

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

describe('certificate-pdf: QR проверки подлинности (DIG-82, BUG-01)', () => {
  it('строки блока проверки содержат ссылку; обещание «QR-код появится» снято', () => {
    const lines = certificateLines(data, options);
    const text = lines.join('\n');
    expect(text).toContain('Проверить по ссылке или QR-коду');
    expect(text).not.toContain('появится');
    // URL печатается текстом (переносится по ширине блока): чанки строк
    // склеиваются в полную ссылку.
    expect(lines.join('')).toContain(VERIFY_URL);
  });

  it('QR-матрица строится по verifyUrl и декодируется обратно в неё', () => {
    const matrix = certificateQrMatrix(data, options);
    expect(matrix).not.toBeNull();
    // «Сканирование»: полная проверка BCH + Рида–Соломона + byte-mode сегмент.
    expect(decodeQrMatrix(matrix!)).toBe(VERIFY_URL);
  });

  it('в контенте PDF ровно тёмные модули QR вместо пунктирной заглушки (парсер)', () => {
    const matrix = certificateQrMatrix(data, options)!;
    const darkModules = matrix.flat().filter(Boolean).length;
    const pdfText = Buffer.from(buildEnrollmentCertificatePdf(data, options)).toString('latin1');
    // Каждый тёмный модуль — квадратный `re` размером в модуль (2.91 pt при
    // 96 pt / 33 модуля); глифы шрифта и заглушки такой пары «ширина=высота»
    // не дают, поэтому точный подсчёт равносилен «pdfimages нашёл QR».
    const modulePt = (96 / matrix.length).toFixed(2);
    const rects = [...pdfText.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/g)].filter(
      (m) => m[3] === modulePt && m[4] === modulePt,
    );
    expect(rects.length).toBe(darkModules);
    expect(rects.length).toBeGreaterThan(300);
  });

  it('QR не пересекает нижнее поле страницы (блок переносится целиком)', () => {
    const pdfText = Buffer.from(buildEnrollmentCertificatePdf(data, options)).toString('latin1');
    const modulePt = (96 / certificateQrMatrix(data, options)!.length).toFixed(2);
    const ys = [...pdfText.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/g)]
      .filter((m) => m[3] === modulePt && m[4] === modulePt)
      .map((m) => Number(m[2]));
    expect(ys.length).toBeGreaterThan(0);
    for (const pdfY of ys) {
      // PDF-координаты (y вверх): низ страницы A4 = 0, нижнее поле = 44.
      expect(pdfY).toBeGreaterThanOrEqual(44 - 0.5);
      expect(pdfY).toBeLessThanOrEqual(842 - 44 + 0.5);
    }
  });
});
