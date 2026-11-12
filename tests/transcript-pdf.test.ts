// DIG-27 — выписка из зачётной книжки (PDF): компоновка, писатель, шрифт.
// Красная фаза: контракт зафиксирован ДО реализации.
//
// Приёмка: «Выписка PDF скачивается без заявки и очереди». PDF собирается
// собственным минимальным писателем с векторным шрифтом (глифы —
// прямоугольники), поэтому кириллица открывается в любом просмотрщике
// без вложенных шрифтов. Сканируемый QR и страница /verify/<код> —
// DIG-47: сейчас печатается код проверки (128 бит) и рамка под QR.
import { describe, expect, it } from 'vitest';

import {
  buildTranscriptPdf,
  newVerificationCode,
  transcriptLines,
  transcriptFilename,
  type TranscriptData,
} from '@/lib/transcript-pdf';
import { hasGlyphFor } from '@/lib/pdf/vector-font';

const NOW = new Date(2026, 10, 12, 15, 30, 0);

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
    const lines = transcriptLines(data, { now: NOW, code: 'ABCD-EFGH-JKLM-NPQR' });
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
    const lines = transcriptLines(data, { now: NOW, code: 'X' });
    const infoRow = lines.find((line) => line.includes('Информатика'))!;
    expect(infoRow).toContain('-');
  });

  it('каждый символ строк выписки покрыт глифами векторного шрифта', () => {
    const lines = transcriptLines(data, {
      now: NOW,
      code: newVerificationCode(() => 0.5),
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
  const pdf = buildTranscriptPdf(data, { now: NOW, code: 'ABCD-EFGH-JKLM-NPQR' });

  it('детерминирован: одинаковые входы — байты в байт', () => {
    const again = buildTranscriptPdf(data, { now: NOW, code: 'ABCD-EFGH-JKLM-NPQR' });
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
