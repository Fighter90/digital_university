// DIG-34 — контракт страницы /tasks («Задачи», SSR).
// Приёмка: группы в порядке срочности (Просрочено, Сегодня, На этой неделе,
// Позже), строки задач (иконка-источник, глагол, откуда, срок, кнопка
// действия), «Отметить выполненной» только у ручных, пустое состояние
// «Все дела сделаны 🎉», заглушка сотрудника и состояние ошибки.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { TasksData, TaskView } from '@/server/data/tasks';
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
  ctx: null as DataCtx | null,
  data: null as TasksData | null,
  throwing: false,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getTasks: vi.fn(async () => {
    if (state.throwing) throw new Error('tasks db down');
    return state.data;
  }),
}));

import TasksPage from '@/app/(cabinet)/tasks/page';

async function renderPage(): Promise<string> {
  const Page = TasksPage as unknown as ComponentType;
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

const task = (over: Partial<TaskView> & { id: string }): TaskView => ({
  source: 'COURSE',
  verb: 'Сдать: Тест 1',
  origin: 'Физика',
  dueAt: new Date(2026, 10, 11, 23, 59),
  daysLeft: 0,
  href: '/grades/PI21-PHYS',
  manual: false,
  ...over,
});

const day = (offset: number, hour = 12, minute = 0): Date => {
  const d = new Date(2026, 10, 11, hour, minute, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

function tasksFixture(): TasksData {
  return {
    overdue: [
      task({
        id: 'course-dl-1',
        verb: 'Сдать: Тест 1 «Кинематика»',
        origin: 'Физика',
        daysLeft: -2,
        dueAt: day(-2, 23, 59),
      }),
      task({
        id: 'manual-task-sign',
        source: 'MANUAL',
        verb: 'Подписать согласие',
        origin: 'Деканат',
        manual: true,
        daysLeft: -1,
        dueAt: day(-1, 18),
        href: '/tasks',
      }),
    ],
    today: [
      task({
        id: 'request-creq-1',
        source: 'REQUEST',
        verb: 'Доработать заявку',
        origin: 'Справка об обучении · ЗД-2026-000003',
        dueAt: null,
        daysLeft: null,
        href: '/requests/ЗД-2026-000003',
      }),
      task({
        id: 'deanery-apl-1',
        source: 'DEANERY',
        verb: 'Ответить на обращение',
        origin: 'Пересдача математического анализа',
        dueAt: null,
        daysLeft: null,
        href: '/deanery',
      }),
    ],
    week: [
      task({
        id: 'session-exm-1',
        source: 'SESSION',
        verb: 'Сдать: Тест 2',
        origin: 'Базы данных',
        dueAt: day(2, 10, 40),
        daysLeft: 2,
        href: '/grades/PI21-DB',
      }),
      task({
        id: 'retake-exm-1',
        source: 'RETAKE',
        verb: 'Записаться на пересдачу',
        origin: 'Информатика',
        dueAt: day(7, 9),
        daysLeft: 7,
        href: '/grades/session',
      }),
      task({
        id: 'manual-task-pay',
        source: 'MANUAL',
        verb: 'Оплатить обучение по договору',
        origin: 'Договор У-2026-114',
        manual: true,
        dueAt: day(5, 18),
        daysLeft: 5,
        href: '/tasks',
      }),
    ],
    later: [
      task({
        id: 'course-dl-2',
        verb: 'Сдать: Реферат',
        origin: 'Алгоритмы',
        dueAt: day(21, 23, 59),
        daysLeft: 21,
        href: '/grades/PI21-ALG',
      }),
    ],
    openCount: 8,
  };
}

describe('TasksPage: студент с задачами', () => {
  it('группы в порядке срочности с заголовками и счётчиками', async () => {
    state.ctx = studentCtx;
    state.data = tasksFixture();
    state.throwing = false;
    const html = await renderPage();

    expect(html).toContain('Задачи');
    expect(html).toContain('Просрочено');
    expect(html).toContain('Сегодня');
    expect(html).toContain('На этой неделе');
    expect(html).toContain('Позже');
    // Группы не перепутаны: просроченная секция идёт раньше «Сегодня».
    expect(html.indexOf('Просрочено')).toBeLessThan(html.indexOf('На этой неделе'));
    // Счётчик открытых задач в шапке экрана.
    expect(html).toContain('8');
  });

  it('строка задачи: глагол, откуда, срок и действие по href', async () => {
    state.ctx = studentCtx;
    state.data = tasksFixture();
    const html = await renderPage();

    expect(html).toContain('Сдать: Тест 1 «Кинематика»');
    expect(html).toContain('Физика');
    expect(html).toContain('Сдать: Тест 2');
    expect(html).toContain('Базы данных');
    expect(html).toContain('Доработать заявку');
    expect(html).toContain('Записаться на пересдачу');
    expect(html).toContain('href="/requests/ЗД-2026-000003"');
    expect(html).toContain('href="/grades/session"');
    expect(html).toContain('href="/grades/PI21-DB"');
    expect(html).toContain('href="/deanery"');
    // Просроченный срок выделен; задачи без срока помечены честно.
    expect(html).toContain('Просрочено · до 9 ноября');
    expect(html).toContain('Срок не назначен');
  });

  it('ручные задачи: кнопка «Отметить выполненной»; неручные — ссылка-действие', async () => {
    state.ctx = studentCtx;
    state.data = tasksFixture();
    const html = await renderPage();

    expect(html).toContain('Отметить выполненной');
    const manualRow = html.slice(html.indexOf('manual-task-pay'));
    expect(manualRow).toContain('Отметить выполненной');
    // У ручной строки нет ссылки-действия на чужой экран.
    expect(html.match(/href="\/tasks"/g)?.length ?? 0).toBe(0);
  });
});

describe('TasksPage: пусто, сотрудник, ошибка', () => {
  it('все задачи закрыты → «Все дела сделаны 🎉»', async () => {
    state.ctx = studentCtx;
    state.data = {
      overdue: [],
      today: [],
      week: [],
      later: [],
      openCount: 0,
    };
    const html = await renderPage();
    expect(html).toContain('Все дела сделаны 🎉');
  });

  it('сотруднику: заглушка «Экран доступен студентам»', async () => {
    state.ctx = staffCtx;
    state.data = null;
    const html = await renderPage();
    expect(html).toContain('Экран доступен студентам');
  });

  it('сбой агрегата: состояние ошибки блока, страница жива', async () => {
    state.ctx = studentCtx;
    state.data = null;
    state.throwing = true;
    const html = await renderPage();
    expect(html).toContain('Задачи не загрузились');
    expect(html).toContain('Обновите страницу');
    state.throwing = false;
  });
});
