// DIG-26 — ?discipline= из карточек главной раскрывает семестр зачётки.
// Render-контракт: focusSemesterKey на не-первом семестре → details open.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GradebookList } from '@/components/gradebook/gradebook-list';
import type { GradebookData } from '@/server/data';

const sem = (startYear: number, term: 'FALL' | 'SPRING', avg: number | null) => ({
  key: { startYear, term },
  label: `${term === 'FALL' ? 'Осень' : 'Весна'} ${startYear}/${(startYear + 1) % 100}`,
  average: avg,
  creditsTotal: 30,
  creditsEarned: 28,
  disciplines: [
    { disciplineCode: 'PI21-ALG', disciplineName: 'Алгебра', grade: 5, credits: 4, admission: true },
    { disciplineCode: 'PI21-DB', disciplineName: 'Базы данных', grade: null, credits: 3, admission: false },
  ],
});

const data: GradebookData = {
  student: { fullName: 'Анна Смирнова', groupName: 'ИВТ-21', course: 2, faculty: 'ИВТ' },
  gpa: { overall: 4.7, semester: null, semesterKey: null, delta: null },
  credits: { earned: 120, required: 240 },
  debts: [],
  semesters: [sem(2025, 'SPRING', 4.8), sem(2025, 'FALL', 4.6)],
};

describe('?discipline= focus (DIG-26 спека)', () => {
  it('focusSemesterKey на не-первом семестре → его details open', () => {
    const html = renderToStaticMarkup(
      createElement(GradebookList, { data, focusSemesterKey: { startYear: 2025, term: 'FALL' } }),
    );
    const openIdx = html.indexOf('open=""') !== -1 ? html.indexOf('open=""') : html.indexOf('open=');
    const fallIdx = html.indexOf('data-testid="semester-accordion-2025-fall"');
    expect(fallIdx).toBeGreaterThan(-1);
    // attributes около fall-аккордеона содержат open
    expect(html.slice(fallIdx - 200, fallIdx + 100)).toMatch(/open/);
  });

  it('без focusSemesterKey — раскрыт только первый семестр', () => {
    const html = renderToStaticMarkup(createElement(GradebookList, { data }));
    expect(html).toContain('semester-accordion-2025-spring');
  });
});
