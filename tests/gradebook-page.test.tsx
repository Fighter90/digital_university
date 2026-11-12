// DIG-27 — контракт страницы /grades/gradebook («Зачётная книжка», SSR).
// Приёмка: аккордеон семестров, на 360 px таблица превращается в карточки
// (таблица — md+, карточки — до md), кнопка «Скачать выписку PDF»,
// ссылки в карточки дисциплин, пустое состояние и состояние сотрудника.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { GradebookData } from '@/server/data/gradebook';
import type { DataCtx } from '@/server/data/types';

const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const staffCtx: DataCtx = { ...studentCtx, role: 'STAFF', studentId: null, groupName: null };

const state = vi.hoisted(() => ({
  ctx: null as unknown,
  gradebook: null as GradebookData | null,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getGradebook: vi.fn(async () => state.gradebook),
}));

import GradebookPage from '@/app/(cabinet)/grades/gradebook/page';

async function renderPage(): Promise<string> {
  const Page = GradebookPage as unknown as ComponentType;
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  // React вставляет `<!-- -->` между текстовыми узлами — для литеральных
  // проверок («9 из 240») комментарии убираем.
  return html.replaceAll('<!-- -->', '');
}

function gradebookFixture(): GradebookData {
  return {
    student: {
      fullName: 'Анна Ковалёва',
      groupName: 'ПИ-21',
      course: 2,
      program: 'Прикладная информатика',
      gradebookNumber: '20231234',
    },
    semesters: [
      {
        key: { startYear: 2026, term: 'FALL' },
        label: 'Осенний семестр 2026/27',
        average: 30.82,
        creditsEarned: 0,
        creditsTotal: 18,
        disciplines: [
          {
            disciplineCode: 'PI21-DB',
            disciplineName: 'Базы данных',
            credits: 5,
            controlType: 'EXAM',
            controlTypeLabel: 'Экзамен',
            finalGrade: null,
            accumulated: 25.5,
            completedAt: new Date(2026, 10, 7, 12, 0),
            creditEarned: false,
          },
        ],
      },
      {
        key: { startYear: 2025, term: 'SPRING' },
        label: 'Весенний семестр 2025/26',
        average: 81.22,
        creditsEarned: 9,
        creditsTotal: 9,
        disciplines: [
          {
            disciplineCode: 'PI21-ALG',
            disciplineName: 'Алгоритмы и структуры данных',
            credits: 5,
            controlType: 'EXAM',
            controlTypeLabel: 'Экзамен',
            finalGrade: 87,
            accumulated: 86.5,
            completedAt: new Date(2026, 3, 15, 12, 0),
            creditEarned: true,
          },
        ],
      },
    ],
    overallAverage: 81.22,
    creditsEarned: 9,
    creditsRequired: 240,
    hasGrades: true,
  };
}

describe('/grades/gradebook — студент', () => {
  it('заголовок, данные студента и кнопка «Скачать выписку PDF»', async () => {
    state.ctx = studentCtx;
    state.gradebook = gradebookFixture();
    
    const html = await renderPage();
    expect(html).toContain('Зачётная книжка');
    expect(html).toContain('Анна Ковалёва');
    expect(html).toContain('20231234');
    expect(html).toContain('data-testid="transcript-download"');
    expect(html).toContain('href="/api/grades/transcript"');
    expect(html).toContain('Скачать выписку PDF');
    // Сводка по программе.
    expect(html).toContain('Средний балл за всё время');
    expect(html).toContain('9 из 240');
  });

  it('аккордеон семестров: свежий семестр раскрыт, прошлый свернут', async () => {
    state.ctx = studentCtx;
    state.gradebook = gradebookFixture();
    
    const html = await renderPage();
    expect(html).toContain('data-testid="semester-accordion-2026-fall"');
    expect(html).toContain('data-testid="semester-accordion-2025-spring"');
    // data-testid стоит на самом <details>: открытый семестр несёт атрибут open.
    const fallTag = html.match(/<details[^>]*data-testid="semester-accordion-2026-fall"[^>]*>/)![0];
    const springTag = html.match(
      /<details[^>]*data-testid="semester-accordion-2025-spring"[^>]*>/,
    )![0];
    expect(fallTag).toMatch(/\bopen\b/);
    expect(springTag).not.toMatch(/\bopen\b/);
    expect(html).toContain('Осенний семестр 2026/27');
    expect(html).toContain('Весенний семестр 2025/26');
  });

  it('итог семестра в шапке аккордеона: средний балл и кредиты', async () => {
    state.ctx = studentCtx;
    state.gradebook = gradebookFixture();
    
    const html = await renderPage();
    expect(html).toContain('81,22');
    expect(html).toContain('9 из 9');
    expect(html).toContain('0 из 18');
  });

  it('таблица (md+) и карточки (до md) — взаимоисключающие брейкпоинты', async () => {
    state.ctx = studentCtx;
    state.gradebook = gradebookFixture();
    
    const html = await renderPage();
    // Десктопная таблица скрыта на мобильном и видима от md.
    expect(html).toContain('data-testid="gradebook-table-2026-fall"');
    expect(html).toMatch(/hidden md:block/);
    // Карточки — только до md.
    expect(html).toContain('data-testid="gradebook-cards-2026-fall"');
    expect(html).toMatch(/md:hidden/);
  });

  it('строки семестра: тип контроля, кредиты, итог, дата и ссылка на карточку', async () => {
    state.ctx = studentCtx;
    state.gradebook = gradebookFixture();
    
    const html = await renderPage();
    expect(html).toContain('Экзамен');
    expect(html).toContain('href="/grades/PI21-ALG"');
    expect(html).toContain('href="/grades/PI21-DB"');
    // Незавершённая дисциплина — прочерк вместо итога.
    expect(html).toContain('—');
  });
});

describe('/grades/gradebook — пустые состояния', () => {
  it('нет оценок: пустое состояние с кнопкой выписки', async () => {
    state.ctx = studentCtx;
    state.gradebook = { ...gradebookFixture(), semesters: [], hasGrades: false };
    const html = await renderPage();
    expect(html).toContain('Оценок пока нет');
    expect(html).toContain('data-testid="transcript-download"');
  });

  it('сотруднику деканата зачётка не показывается', async () => {
    state.ctx = staffCtx;
    state.gradebook = gradebookFixture();
    const html = await renderPage();
    expect(html).toContain('Доступно студентам');
    expect(html).not.toContain('data-testid="transcript-download"');
    expect(html).not.toContain('semester-accordion-2026-fall');
  });
});
