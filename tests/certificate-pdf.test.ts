// DIG-47 — PDF-шаблон справки: модель строк, покрытие шрифта, QR, детерминизм.
// Красная фаза: контракт зафиксирован ДО реализации.
import { describe, expect, it } from 'vitest';

import {
  buildCertificatePdf,
  certificateFilename,
  certificateLines,
  certificateQrMatrix,
  type CertificatePdfData,
} from '@/lib/certificate-pdf';
import { hasGlyphFor } from '@/lib/pdf/vector-font';

const NOW = new Date(2026, 10, 12, 15, 30, 0);

const data: CertificatePdfData = {
  documentType: 'Справка об обучении',
  number: 'СП-2026-000412',
  issuedAt: NOW,
  fullName: 'Смирнова Алла Викторовна',
  program: 'Прикладная информатика',
  course: 2,
  studyForm: 'очная',
  purpose: 'для предъявления в банк',
  verificationCode: 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777',
  verifyUrl: 'https://du.example/verify/ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777',
};

describe('certificate-pdf: модель строк', () => {
  it('реквизиты документа: вуз, номер, дата, персональные поля', () => {
    const lines = certificateLines(data);
    const text = lines.join('\n');
    expect(text).toContain('ЦИФРОВОЙ ДЕКАНАТ');
    expect(text).toContain('СПРАВКА ОБ ОБУЧЕНИИ'); // заголовок капителью
    expect(text).toContain('СП-2026-000412');
    expect(text).toContain('Дата выдачи: 12.11.2026');
    expect(text).toContain('Смирнова Алла Викторовна');
    expect(text).toContain('Прикладная информатика');
    expect(text).toContain('Курс: 2');
    expect(text).toContain('очная');
    expect(text).toContain('для предъявления в банк');
    // Отметка «электронный документ» и проверка подлинности.
    expect(text).toContain('Электронный документ');
    expect(text).toContain('ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777');
    expect(text).toContain('https://du.example/verify/ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777');
    // Плашка «Концепт для конкурса» обязательна на документе.
    expect(text).toContain('Концепт для конкурса');
  });

  it('без назначения — «по месту требования»', () => {
    const lines = certificateLines({ ...data, purpose: null });
    expect(lines.join('\n')).toContain('по месту требования');
  });

  it('каждый символ строк покрыт глифами векторного шрифта (кириллица без вложений)', () => {
    const lines = certificateLines(data);
    const missing = new Set<string>();
    for (const line of lines) {
      for (const ch of line) {
        if (!hasGlyphFor(ch)) missing.add(ch);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('certificate-pdf: QR', () => {
  it('матрица QR строится по verifyUrl и достаточно велика для сканирования', () => {
    const qr = certificateQrMatrix(data);
    expect(qr).not.toBeNull();
    expect(qr!.length).toBeGreaterThanOrEqual(25);
    expect(qr!.length).toBeLessThanOrEqual(41);
  });

  it('QR кодирует именно страницу проверки', () => {
    const qr = certificateQrMatrix(data)!;
    // Первый finder сверху-слева не зависит от данных; проверяем размер
    // и то, что смена URL меняет матрицу (QR не заглушка).
    const other = certificateQrMatrix({ ...data, verifyUrl: `${data.verifyUrl}x` });
    expect(other).not.toBeNull();
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(qr));
  });
});

describe('certificate-pdf: сборка PDF', () => {
  const pdf = buildCertificatePdf(data);

  it('детерминирован: одинаковые входы — байты в байт', () => {
    const again = buildCertificatePdf(data);
    expect(Buffer.from(again).equals(Buffer.from(pdf))).toBe(true);
  });

  it('валидная структура: %PDF-1.4, Catalog/Page, xref, %%EOF', () => {
    const text = Buffer.from(pdf).toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Page');
    expect(text).toContain('/MediaBox [0 0 595 842]');
    expect(text).toContain('/Root 1 0 R');
    expect(text).toContain('xref');
  });

  it('xref-смещения указывают ровно на заголовки объектов', () => {
    const text = Buffer.from(pdf).toString('latin1');
    const startxref = Number(text.match(/startxref\s+(\d+)/)![1]);
    const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n/gm)].map((m) =>
      Number(m[1]),
    );
    for (let i = 0; i < offsets.length; i += 1) {
      const head = `${i + 1} 0 obj`;
      expect(text.slice(offsets[i]!, offsets[i]! + head.length)).toBe(head);
    }
  });

  it('QR нарисован модулями: в контенте сотни коротких прямоугольников', () => {
    const text = Buffer.from(pdf).toString('latin1');
    const rects = [...text.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/g)];
    expect(rects.length).toBeGreaterThan(300);
  });

  it('длинный документ переносится на новую страницу', () => {
    const long: CertificatePdfData = {
      ...data,
      fullName: 'Смирнова Алла Викторовна Длиннодействующая',
      program: 'Прикладная информатика в цифровой экономике, профиль анализа данных',
      // Длинное назначение: перенос по словам должен увести документ на 2 страницы.
      purpose: 'для предъявления по месту требования в банк, визовый центр и военкомат '.repeat(50),
    };
    const text = Buffer.from(buildCertificatePdf(long)).toString('latin1');
    expect(text).toContain('/Count 2');
  });
});

describe('certificate-pdf: имя файла', () => {
  it('ASCII без кириллицы, с датой выдачи', () => {
    expect(certificateFilename(NOW)).toBe('certificate-2026-11-12.pdf');
  });
});
