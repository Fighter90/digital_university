// DIG-27 — контракт страницы карточки дисциплины /grades/[disciplineId] (SSR).
// Приёмка: шапка (название, преподаватель, кредиты, накопленная крупно),
// формула оценки полосами с текущими баллами частей, список отдельных
// оценок с пометкой пересдачи, слот калькулятора «Что нужно на экзамене»,
// «Ошибка в оценке?» → обращение в деканат; чужая дисциплина → notFound().
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { DisciplineCardData } from '@/server/data/gradebook';
import type { DataCtx } from '@/server/data/types';
const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const state = vi.hoisted(() => ({
  ctx: null as unknown,
  card: null as DisciplineCardData | null,
  notFoundCalled: false,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getDisciplineCard: vi.fn(async () => state.card),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    state.notFoundCalled = true;
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
}));

import DisciplineCardPage from '@/app/(cabinet)/grades/[disciplineId]/page';

async function renderPage(disciplineId = 'PI21-ALG'): Promise<string> {
  const Page = DisciplineCardPage as unknown as ComponentType<{
    params: Promise<{ disciplineId: string }>;
  }>;
  const { prelude } = await prerenderToNodeStream(
    createElement(Page, { params: Promise.resolve({ disciplineId }) }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  // React вставляет `<!-- -->` между текстовыми узлами — для литеральных
  // проверок «5 кредитов» / «85 из 100» комментарии убираем.
  return html.replaceAll('<!-- -->', '');
}

function cardFixture(): DisciplineCardData {
  return {
    disciplineCode: 'PI21-ALG',
    disciplineName: 'Алгоритмы и структуры данных',
    teacherName: 'Иванова Ирина Игоревна',
    credits: 5,
    semesterLabel: 'Весенний семестр 2025/26',
    accumulated: 86.5,
    maxPossible: 86.5,
    finalGrade: 87,
    isComplete: true,
    creditEarned: true,
    parts: [
      {
        kind: 'TEST',
        label: 'Контрольные',
        weightPercent: 30,
        earnedPercent: 90,
        gradedCount: 1,
      },
      {
        kind: 'EXAM',
        label: 'Экзамен',
        weightPercent: 70,
        earnedPercent: 85,
        gradedCount: 1,
      },
    ],
    grades: [
      {
        id: 'grd-2',
        elementCode: 'PI21-ALG-EX',
        elementName: 'Экзамен',
        kindLabel: 'Экзамен',
        score: 85,
        maxScore: 100,
        gradedAt: new Date(2026, 3, 15, 12, 0),
        isLatest: true,
        comment: null,
      },
      {
        id: 'grd-1',
        elementCode: 'PI21-ALG-T',
        elementName: 'Тест 1',
        kindLabel: 'Контрольные',
        score: 90,
        maxScore: 100,
        gradedAt: new Date(2026, 1, 20, 12, 0),
        isLatest: true,
        comment: null,
      },
    ],
    exam: { elementCode: 'PI21-ALG-EX', elementName: 'Экзамен', weightPercent: 70, maxScore: 100, graded: true },
  };
}

describe('/grades/[disciplineId] — карточка дисциплины', () => {
  it('шапка: название, преподаватель, кредиты, итог крупно, семестр', async () => {
    state.ctx = studentCtx;
    state.card = cardFixture();
    state.notFoundCalled = false;
    const html = await renderPage();
    expect(html).toContain('Алгоритмы и структуры данных');
    expect(html).toContain('Иванова Ирина Игоревна');
    expect(html).toContain('5 кредитов');
    // Завершённая дисциплина: крупно итог, не накопленная.
    expect(html).toContain('data-testid="final-grade"');
    expect(html).toContain('>87</p>');
    expect(html).toContain('Весенний семестр 2025/26');
    // Обратная ссылка на зачётку.
    expect(html).toContain('href="/grades/gradebook"');
  });

  it('формула оценки полосами: проценты частей и текущие баллы', async () => {
    state.ctx = studentCtx;
    state.card = cardFixture();
    state.notFoundCalled = false;
    const html = await renderPage();
    expect(html).toContain('data-testid="grade-formula"');
    expect(html).toContain('data-testid="part-TEST"');
    expect(html).toContain('data-testid="part-EXAM"');
    expect(html).toContain('Контрольные');
    expect(html).toContain('30%');
    expect(html).toContain('90');
    expect(html).toContain('Экзамен');
    expect(html).toContain('70%');
    expect(html).toContain('85');
  });

  it('список отдельных оценок: элемент, дата, балл', async () => {
    state.ctx = studentCtx;
    state.card = cardFixture();
    state.notFoundCalled = false;
    const html = await renderPage();
    expect(html).toContain('data-testid="grade-rows"');
    expect(html).toContain('data-testid="grade-row-grd-1"');
    expect(html).toContain('data-testid="grade-row-grd-2"');
    expect(html).toContain('15.04.2026');
    expect(html).toContain('85 из 100');
  });

  it('пересдача: не учитываемая попытка помечена', async () => {
    state.ctx = studentCtx;
    state.card = cardFixture();
    state.card!.grades.unshift({
      id: 'grd-0',
      elementCode: 'PI21-ALG-T',
      elementName: 'Тест 1',
      kindLabel: 'Контрольные',
      score: 64,
      maxScore: 100,
      gradedAt: new Date(2026, 0, 20, 12, 0),
      isLatest: false,
      comment: null,
    });
    state.notFoundCalled = false;
    const html = await renderPage();
    const staleRow = html.slice(html.indexOf('grade-row-grd-0'));
    expect(staleRow).toContain('пересдача');
  });

  it('слот калькулятора «Что нужно на экзамене» и форма «Ошибка в оценке?»', async () => {
    state.ctx = studentCtx;
    state.card = cardFixture();
    state.notFoundCalled = false;
    const html = await renderPage();
    expect(html).toContain('data-testid="calculator-slot"');
    expect(html).toContain('Что нужно на экзамене');
    // Форма обращения в деканат — кнопка «Ошибка в оценке?».
    expect(html).toContain('Ошибка в оценке');
    expect(html).toContain('form');
  });

  it('итог крупно у завершённой дисциплины с зачтённым кредитом', async () => {
    state.ctx = studentCtx;
    state.card = cardFixture();
    state.notFoundCalled = false;
    const html = await renderPage();
    expect(html).toContain('data-testid="final-grade"');
    expect(html).toContain('87');
    expect(html).toContain('Кредит зачтён');
  });

  it('чужая дисциплина (null от слоя данных) → notFound()', async () => {
    state.ctx = studentCtx;
    state.card = null;
    state.notFoundCalled = false;
    await expect(renderPage('EK11-MATH')).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(state.notFoundCalled).toBe(true);
  });

  it('накопленная у идущей дисциплины: крупно с максимумом и статусом «в процессе»', async () => {
    state.ctx = studentCtx;
    state.card = cardFixture();
    state.card!.isComplete = false;
    state.card!.finalGrade = null;
    state.card!.maxPossible = 98.5;
    state.notFoundCalled = false;
    const html = await renderPage('PI21-INFO');
    // Идущей дисциплине крупно показывается накопленная (86,5) с границей
    // максимума (98,5) и статус «в процессе»; итога нет.
    expect(html).toContain('data-testid="accumulated-grade"');
    expect(html).toContain('86,5');
    expect(html).toContain('98,5');
    expect(html).toContain('в процессе');
    expect(html).not.toContain('data-testid="final-grade"');
  });
});
