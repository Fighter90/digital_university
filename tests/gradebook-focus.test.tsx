// DIG-26 — ?discipline= из карточек главной раскрывает семестр зачётки.
// Render-контракт: focusSemesterKey на не-первом семестре → details open.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GradebookList } from '@/components/gradebook/gradebook-list';
import type { GradebookData, GradebookSemesterView } from '@/server/data/gradebook';

const sem = (startYear: number, term: 'FALL' | 'SPRING', avg: number | null): GradebookSemesterView => ({
  key: { startYear, term },
  label: `${term === 'FALL' ? 'Осень' : 'Весна'} ${startYear}/${(startYear + 1) % 100}`,
  disciplines: [
    {
      disciplineCode: 'PI21-ALG',
      disciplineName: 'Алгебра',
      credits: 4,
      controlType: 'EXAM',
      controlTypeLabel: 'Экзамен',
      finalGrade: 5,
      accumulated: 88.7,
      completedAt: new Date('2026-06-15'),
      admission: true,
    },
    {
      disciplineCode: 'PI21-DB',
      disciplineName: 'Базы данных',
      credits: 3,
      controlType: 'DIFFERENTIATED',
      controlTypeLabel: 'Дифзачёт',
      finalGrade: null,
      accumulated: 61.5,
      completedAt: null,
      admission: false,
    },
  ],
  average: avg,
  creditsEarned: 28,
  creditsTotal: 30,
});

const data: GradebookData = {
  student: {
    fullName: 'Анна Смирнова',
    groupName: 'ИВТ-21',
    course: 2,
    program: 'ИВТ',
    gradebookNumber: '216001',
  },
  overallAverage: 4.7,
  creditsEarned: 120,
  creditsRequired: 240,
  hasGrades: true,
  semesters: [sem(2025, 'SPRING', 4.8), sem(2025, 'FALL', 4.6)],
};

describe('?discipline= focus (DIG-26 спека)', () => {
  it('focusSemesterKey на не-первом семестре → его details open', () => {
    const html = renderToStaticMarkup(
      createElement(GradebookList, { data, focusSemesterKey: { startYear: 2025, term: 'FALL' } }),
    );
    // тег details с этим testid содержит атрибут open (раскрыт)
    const tag = html.match(/<details[^>]*semester-accordion-2025-fall[^>]*/)?.[0] ?? '';
    expect(tag).toMatch(/\bopen\b/);
  });

  it('без focusSemesterKey — раскрыт только первый семестр', () => {
    const html = renderToStaticMarkup(createElement(GradebookList, { data }));
    expect(html).toContain('semester-accordion-2025-spring');
  });
});
