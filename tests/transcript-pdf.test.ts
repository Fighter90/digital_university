// DIG-27 — выписка из зачётной книжки (PDF): компоновка, писатель, шрифт.
// Красная фаза: контракт зафиксирован ДО реализации.
//
// Приёмка: «Выписка PDF скачивается без заявки и очереди». PDF собирается
// собственным минимальным писателем с векторным шрифтом (глифы —
// прямоугольники), поэтому кириллица открывается в любом просмотрщике
// без вложенных шрифтов.
// DIG-82 — выписка несёт сканируемый QR со ссылкой на /verify/<код>,
// код проверки регистрируется в реестре справок (BUG-01 вар. А).
import { describe, expect, it } from 'vitest';

import { decodeQrMatrix } from './helpers/qr-decode';
import {
  buildTranscriptPdf,
  newVerificationCode,
  transcriptLines,
  transcriptFilename,
  transcriptQrMatrix,
  type TranscriptData,
} from '@/lib/transcript-pdf';
import { hasGlyphFor } from '@/lib/pdf/vector-font';

const NOW = new Date(2026, 10, 12, 15, 30, 0);

const VERIFY_URL = 'http://localhost:3000/verify/ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777';

const data: TranscriptData = {
  student: {
    fullName: 'Анна Ковалёва',
    groupName: 'ПИ-21',
    course: 2,
    program: 'Прикладная информатика',
    gradebookNumber: '20231234',
  },
  semesters: [
    {
      label: 'Осенний семестр 2026/27',
      average: 30.82,
      creditsEarned: 0,
      creditsTotal: 18,
      disciplines: [
        {
          name: 'Информатика',
          controlType: 'Экзамен',
          credits: 4,
          grade: null,
          completedAt: new Date(2026, 9, 28, 12, 0),
        },
        {
          name: 'Алгоритмы и структуры данных',
          controlType: 'Экзамен',
          credits: 5,
          grade: 87,
          completedAt: new Date(2026, 3, 15, 12, 0),
        },
      ],
    },
  ],
  overallAverage: 81.22,
  creditsEarned: 9,
  creditsRequired: 240,
};

describe('transcript-pdf: модель строк', () => {
  it('строки выписки содержат студента, семестры, дисциплины и итоги', () => {
    const lines = transcriptLines(data, {
      now: NOW,
      code: 'ABCD-EFGH-JKLM-NPQR',
      verifyUrl: VERIFY_URL,
    });
    const text = lines.join('\n');
    expect(text).toContain('Выписка из зачётной книжки');
    expect(text).toContain('Анна Ковалёва');
    expect(text).toContain('ПИ-21');
    expect(text).toContain('20231234');
    expect(text).toContain('Осенний семестр 2026/27');
    expect(text).toContain('Информатика');
    expect(text).toContain('Алгоритмы и структуры данных');
    expect(text).toContain('Экзамен');
    expect(text).toContain('Средний балл за всё время: 81.22');
    expect(text).toContain('Кредиты набрано: 9 из 240');
    expect(text).toContain('ABCD-EFGH-JKLM-NPQR');
    // Плашка «Концепт для конкурса» — обязательна.
    expect(text).toContain('Концепт для конкурса');
  });

  it('незавершённая дисциплина: вместо оценки прочерк', () => {
    const lines = transcriptLines(data, {
      now: NOW,
      code: 'X',
      verifyUrl: VERIFY_URL,
    });
    const infoRow = lines.find((line) => line.includes('Информатика'))!;
    expect(infoRow).toContain('-');
  });

  it('каждый символ строк выписки покрыт глифами векторного шрифта', () => {
    const lines = transcriptLines(data, {
      now: NOW,
      code: newVerificationCode(() => 0.5),
      verifyUrl: VERIFY_URL,
    });
    const missing = new Set<string>();
    for (const line of lines) {
      for (const ch of line) {
        if (!hasGlyphFor(ch)) missing.add(ch);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('DIG-84 — transcript-pdf: EN-локаль', () => {
  const enData: TranscriptData = {
    ...data,
    semesters: [
      {
        ...data.semesters[0]!,
        label: 'Fall semester 2026/27',
        disciplines: data.semesters[0]!.disciplines.map((discipline) => ({
          ...discipline,
          controlType: 'Exam',
        })),
      },
    ],
  };

  it('строки EN-выписки: заголовок, итоги и проверка по-английски', () => {
    const lines = transcriptLines(enData, {
      now: NOW,
      code: 'ABCD-EFGH-JKLM-NPQR',
      verifyUrl: VERIFY_URL,
      locale: 'en',
    });
    const text = lines.join('\n');
    expect(text).toContain('Academic transcript');
    expect(text).toContain('Digital Deanery (demonstration university)');
    expect(text).toContain('Concept entry for the hackathon. All data is fictional.');
    expect(text).toContain('Student: Анна Ковалёва');
    expect(text).toContain('Group: ПИ-21');
    expect(text).toContain('Gradebook number: 20231234');
    expect(text).toContain('Issue date: 12.11.2026');
    expect(text).toContain('Discipline');
    expect(text).toContain('Fall semester 2026/27');
    expect(text).toContain('Exam');
    expect(text).toContain('Semester average: 30.82   Credits: 0 of 18');
    expect(text).toContain('Overall GPA: 81.22');
    expect(text).toContain('Credits earned: 9 of 240');
    expect(text).toContain('Verification code: ABCD-EFGH-JKLM-NPQR');
    expect(text).toContain('Verify via the link or QR code');
    expect(text).toContain('Document authenticity verification');
  });

  it('каждый символ EN-строк покрыт глифами векторного шрифта', () => {
    const lines = transcriptLines(enData, {
      now: NOW,
      code: newVerificationCode(() => 0.5),
      verifyUrl: VERIFY_URL,
      locale: 'en',
    });
    const missing = new Set<string>();
    for (const line of lines) {
      for (const ch of line) {
        if (!hasGlyphFor(ch)) missing.add(ch);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('локаль по умолчанию — ru: прежние строки байт-в-байт', () => {
    const lines = transcriptLines(data, {
      now: NOW,
      code: 'ABCD-EFGH-JKLM-NPQR',
      verifyUrl: VERIFY_URL,
    });
    expect(lines[0]).toBe('Выписка из зачётной книжки');
    expect(lines.join('\n')).toContain('Проверка подлинности документа');
  });
});

describe('transcript-pdf: код проверки', () => {
  it('128 бит энтропии: 32 символа base32 в группах по 4', () => {
    const code = newVerificationCode(() => 0.123);
    expect(code).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){7}$/);
    expect(code.replaceAll('-', '').length).toBe(32);
  });

  it('детерминирован при фиксированном генераторе', () => {
    const rng = () => 0.25;
    expect(newVerificationCode(rng)).toBe(newVerificationCode(rng));
    expect(newVerificationCode(rng)).not.toBe(newVerificationCode(() => 0.75));
  });
});

describe('transcript-pdf: писатель PDF', () => {
  const pdf = buildTranscriptPdf(data, {
    now: NOW,
    code: 'ABCD-EFGH-JKLM-NPQR',
    verifyUrl: VERIFY_URL,
  });

  it('детерминирован: одинаковые входы — байты в байт', () => {
    const again = buildTranscriptPdf(data, {
      now: NOW,
      code: 'ABCD-EFGH-JKLM-NPQR',
      verifyUrl: VERIFY_URL,
    });
    expect(Buffer.from(again).equals(Buffer.from(pdf))).toBe(true);
  });

  it('валидная структура: %PDF-1.4, xref/trailer, %%EOF', () => {
    const text = Buffer.from(pdf).toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Page');
    expect(text).toContain('/MediaBox [0 0 595 842]');
    expect(text).toContain('xref');
    expect(text).toContain('/Root 1 0 R');
  });

  it('xref-смещения указывают ровно на заголовки объектов', () => {
    const text = Buffer.from(pdf).toString('latin1');
    const startxref = Number(text.match(/startxref\s+(\d+)/)![1]);
    const xrefBlock = text.slice(startxref);
    // Каждое смещение в таблице xref указывает на «N 0 obj».
    const offsets = [...xrefBlock.matchAll(/^(\d{10}) 00000 n/gm)].map((m) => Number(m[1]));
    expect(offsets.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < offsets.length; i += 1) {
      const head = `${i + 1} 0 obj`;
      expect(text.slice(offsets[i]!, offsets[i]! + head.length)).toBe(head);
    }
  });

  it('контент-стрим содержит прямоугольники (векторные глифы и таблицы)', () => {
    const text = Buffer.from(pdf).toString('latin1');
    expect(text).toMatch(/re\s*\n?f\s*\n/);
    expect(text).toContain('/Count 1');
  });
});

describe('transcript-pdf: имя файла', () => {
  it('ASCII без кириллицы, с датой выдачи', () => {
    expect(transcriptFilename(NOW)).toBe('transcript-2026-11-12.pdf');
  });
});

describe('transcript-pdf: QR проверки подлинности (DIG-82, BUG-01)', () => {
  it('строки блока проверки содержат ссылку; обещание «QR-код появится» снято', () => {
    const lines = transcriptLines(data, {
      now: NOW,
      code: 'ABCD-EFGH-JKLM-NPQR',
      verifyUrl: VERIFY_URL,
    });
    const text = lines.join('\n');
    expect(text).toContain('Проверить по ссылке или QR-коду');
    expect(text).not.toContain('появится');
    // URL печатается текстом (переносится по ширине блока): чанки строк
    // склеиваются в полную ссылку.
    expect(lines.join('')).toContain(VERIFY_URL);
  });

  it('QR-матрица строится по verifyUrl и декодируется обратно в неё', () => {
    const matrix = transcriptQrMatrix(data, {
      now: NOW,
      code: 'ABCD-EFGH-JKLM-NPQR',
      verifyUrl: VERIFY_URL,
    });
    expect(matrix).not.toBeNull();
    expect(decodeQrMatrix(matrix!)).toBe(VERIFY_URL);
  });

  it('в контенте PDF ровно тёмные модули QR вместо пунктирной заглушки (парсер)', () => {
    const options = { now: NOW, code: 'ABCD-EFGH-JKLM-NPQR', verifyUrl: VERIFY_URL };
    const matrix = transcriptQrMatrix(data, options)!;
    const darkModules = matrix.flat().filter(Boolean).length;
    const pdfText = Buffer.from(buildTranscriptPdf(data, options)).toString('latin1');
    const modulePt = (96 / matrix.length).toFixed(2);
    const rects = [...pdfText.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/g)].filter(
      (m) => m[3] === modulePt && m[4] === modulePt,
    );
    expect(rects.length).toBe(darkModules);
    expect(rects.length).toBeGreaterThan(300);
  });

  it('плотная выписка: QR целиком на странице, без пересечения нижнего поля', () => {
    // Шесть семестров выталкивают блок проверки в «опасную зону» у низа
    // страницы — строитель обязан унести блок с QR на новую страницу.
    const semesters = Array.from({ length: 6 }, (_, i) => ({
      label: `Семестр ${i + 1}`,
      average: 82.5,
      creditsEarned: 18,
      creditsTotal: 18,
      disciplines: [
        {
          name: `Дисциплина ${i + 1}.1`,
          controlType: 'Экзамен',
          credits: 4,
          grade: 88,
          completedAt: new Date(2026, 5, 10, 12, 0),
        },
        {
          name: `Дисциплина ${i + 1}.2`,
          controlType: 'Зачёт',
          credits: 3,
          grade: 91,
          completedAt: new Date(2026, 5, 11, 12, 0),
        },
      ],
    }));
    const long: TranscriptData = {
      ...data,
      semesters,
      creditsEarned: 108,
    };
    const options = { now: NOW, code: 'ABCD-EFGH-JKLM-NPQR', verifyUrl: VERIFY_URL };
    const pdfText = Buffer.from(buildTranscriptPdf(long, options)).toString('latin1');
    const modulePt = (96 / transcriptQrMatrix(long, options)!.length).toFixed(2);
    const ys = [...pdfText.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/g)]
      .filter((m) => m[3] === modulePt && m[4] === modulePt)
      .map((m) => Number(m[2]));
    expect(ys.length).toBeGreaterThan(0);
    for (const pdfY of ys) {
      // PDF-координаты (y вверх): нижнее поле страницы = 44.
      expect(pdfY).toBeGreaterThanOrEqual(44 - 0.5);
      expect(pdfY).toBeLessThanOrEqual(842 - 44 + 0.5);
    }
  });
});
