// DIG-103 — render contract страницы «Рейтинг группы» (/grades/rating).
// Тот же подход, что tests/grades-page.test.tsx: async server component
// пререндерится с замоканными сессией/слоем данных. Фиксирует видимый
// контракт: таблица (место, ФИО, средний двумя знаками, прогресс-бар к
// шкале 0–100), метка «вы» на строке владельца, honest empty-state группы
// без оценок, заглушка сотруднику и скелетон loading.tsx.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { DataCtx } from '@/server/data/types';
import type { GroupRatingView } from '@/server/data/performance';

const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const staffCtx: DataCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

function viewFixture(overrides?: Partial<GroupRatingView>): GroupRatingView {
  return {
    groupName: 'ПИ-21',
    hasAnyGrades: true,
    rows: [
      { studentId: 'st-boris', fullName: 'Борис Орлов', average: 95, place: 1, isViewer: false },
      { studentId: 'st-anna', fullName: 'Анна Ковалёва', average: 85, place: 2, isViewer: true },
      { studentId: 'st-vera', fullName: 'Вера Иванова', average: 70, place: 3, isViewer: false },
      { studentId: 'st-gleb', fullName: 'Глеб Фёдоров', average: null, place: null, isViewer: false },
    ],
    ...overrides,
  };
}

vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => null),
  requireUser: vi.fn(async () => ({
    id: 'auth-anna',
    login: 'anna.smirnova',
    role: 'STUDENT' as const,
  })),
  requireStaff: vi.fn(async () => ({ id: 'x', login: 'x', role: 'STAFF' as const })),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => studentCtx),
  getGroupRating: vi.fn(async () => viewFixture()),
}));

import RatingPage, { generateMetadata } from '@/app/(cabinet)/grades/rating/page';

async function renderPage(Page: ComponentType, props?: Record<string, unknown>): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(Page, props));
  let html = '';
  for await (const chunk of prelude) html += String(chunk);
  return html;
}

async function renderWith(ctx: DataCtx, view: GroupRatingView | null): Promise<string> {
  const dataModule = await import('@/server/data');
  vi.mocked(dataModule.requireDataCtx).mockResolvedValueOnce(ctx);
  vi.mocked(dataModule.getGroupRating).mockResolvedValueOnce(view);
  return renderPage(RatingPage);
}

describe('страница /grades/rating: render contract', () => {
  it('заголовок раздела и подпись группы', async () => {
    const html = await renderWith(studentCtx, viewFixture());
    expect(html).toContain('Рейтинг группы');
    expect(html).toContain('ПИ-21');
  });

  it('таблица: место, ФИО, средний двумя знаками; строка без места — прочерк', async () => {
    const html = await renderWith(studentCtx, viewFixture());
    expect(html).toContain('Место');
    expect(html).toContain('Студент');
    expect(html).toContain('Средний балл');
    // Средний двумя знаками (RU — запятая), столбец выровнен и для целых.
    expect(html).toContain('95,00');
    expect(html).toContain('85,00');
    expect(html).toContain('70,00');
    // Студент без оценок: без места и без среднего — прочерки в его строке.
    const glebRow =
      '<tr' + (html.split('<tr').find((chunk) => chunk.includes('Глеб Фёдоров')) ?? '');
    expect(glebRow).toContain('—');
    expect(glebRow).not.toMatch(/\d,\d\d/);
  });

  it('прогресс-бар к шкале проекта 0–100 у каждой оценённой строки', async () => {
    const html = await renderWith(studentCtx, viewFixture());
    const bars = html.match(/role="progressbar"/g) ?? [];
    expect(bars.length).toBe(3); // глеб без оценок — без полосы
    expect(html).toMatch(/aria-valuemax="100"/);
    expect(html).toMatch(/aria-valuenow="95"/);
  });

  it('метка «вы» на строке владельца', async () => {
    const html = await renderWith(studentCtx, viewFixture());
    expect(html).toContain('вы');
    expect(html).toMatch(/data-viewer="true"/);
  });

  it('группа без оценок: honest empty-state вместо таблицы', async () => {
    const html = await renderWith(
      studentCtx,
      viewFixture({
        hasAnyGrades: false,
        rows: [
          { studentId: 'st-anna', fullName: 'Анна Ковалёва', average: null, place: null, isViewer: true },
        ],
      }),
    );
    expect(html).toContain('В группе пока нет оценок');
    expect(html).not.toMatch(/role="progressbar"/);
  });

  it('обратная ссылка на сводку успеваемости', async () => {
    const html = await renderWith(studentCtx, viewFixture());
    expect(html).toMatch(/href="\/grades"/);
  });

  it('STAFF — заглушка вместо студенческого рейтинга', async () => {
    const html = await renderWith(staffCtx, null);
    expect(html).not.toContain('Место');
    expect(html).not.toMatch(/role="progressbar"/);
  });

  it('<title> по локали и скелетон loading.tsx', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('Рейтинг группы — Цифровой деканат');
    const loading = readFileSync(
      resolve(__dirname, '../src/app/(cabinet)/grades/rating/loading.tsx'),
      'utf8',
    );
    expect(loading).toContain('GradesSkeleton');
  });
});
