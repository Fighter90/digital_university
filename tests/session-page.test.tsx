// DIG-28 — контракт страницы /grades/session («Сессия», SSR).
// Приёмка: шапка с названием сезона, диапазоном и отсчётом; таймлайн
// экзаменов/зачётов со статусами-пилюлями (Не допущен — с причиной и
// действием); блок пересдач с записью и состоянием «Заявка создана»;
// консультации; подсказка AI; кнопка «вся сессия в календарь»;
// пустое состояние и заглушка сотрудника.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { SessionData } from '@/server/data/session';
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
  session: null as SessionData | null,
  throwing: false,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getSession: vi.fn(async () => {
    if (state.throwing) throw new Error('exams db down');
    return state.session;
  }),
}));

import SessionPage from '@/app/(cabinet)/grades/session/page';

async function renderPage(): Promise<string> {
  const Page = SessionPage as unknown as ComponentType;
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

const day = (offset: number, hour = 10, minute = 0): Date => {
  const d = new Date(2026, 11, 20, hour, minute, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

function sessionFixture(): SessionData {
  return {
    studentId: 'st-anna',
    seasonTitle: 'Зимняя сессия',
    rangeLabel: '23 декабря – 1 января',
    countdown: { days: 3, label: 'До первого экзамена 3 дня' },
    exams: [
      {
        examId: 'exm-info-cr',
        disciplineCode: 'PI21-INFO',
        disciplineName: 'Информатика',
        kind: 'CREDIT',
        kindLabel: 'Зачёт',
        date: day(3),
        startsAt: day(3),
        room: '210',
        teacherName: 'Петров Пётр Петрович',
        status: 'NOT_ADMITTED',
        statusLabel: 'Не допущен',
        statusBadge: 'error',
        score: null,
        admissionReason: 'Не сдано: Коллоквиум',
        actionHref: '/grades/PI21-INFO',
      },
      {
        examId: 'exm-prog-cr',
        disciplineCode: 'PI21-PROG',
        disciplineName: 'Программирование',
        kind: 'CREDIT',
        kindLabel: 'Зачёт',
        date: day(5),
        startsAt: day(5),
        room: '210',
        teacherName: 'Иванова Ирина Игоревна',
        status: 'ADMITTED',
        statusLabel: 'Допущен',
        statusBadge: 'success',
        score: null,
        admissionReason: null,
        actionHref: null,
      },
      {
        examId: 'exm-disc-ex',
        disciplineCode: 'PI21-DISC',
        disciplineName: 'Дискретная математика',
        kind: 'EXAM',
        kindLabel: 'Экзамен',
        date: day(10),
        startsAt: day(10),
        room: '301',
        teacherName: 'Кузнецова Ксения Кирилловна',
        status: 'PASSED',
        statusLabel: 'Сдано · 74',
        statusBadge: 'success',
        score: 74,
        admissionReason: null,
        actionHref: null,
      },
    ],
    retakes: [
      {
        examId: 'exm-info-rt',
        disciplineCode: 'PI21-INFO',
        disciplineName: 'Информатика',
        date: day(9, 9),
        startsAt: day(9, 9),
        room: '305',
        note: 'Пересдача коллоквиума',
        requested: false,
        requestNumber: null,
        signUpAvailable: true,
      },
      {
        examId: 'exm-prog-rt',
        disciplineCode: 'PI21-PROG',
        disciplineName: 'Программирование',
        date: day(16, 9),
        startsAt: day(16, 9),
        room: '405',
        note: null,
        requested: true,
        requestNumber: 'SR-2026-ZZ001',
        signUpAvailable: true,
      },
    ],
    consultations: [
      {
        eventId: 'sch-consult-prog',
        disciplineCode: 'PI21-PROG',
        disciplineName: 'Программирование',
        date: day(4, 14),
        startsAt: day(4, 14),
        endsAt: day(4, 15, 30),
        room: '210',
        teacherName: 'Иванова Ирина Игоревна',
      },
    ],
  };
}

describe('/grades/session — студент', () => {
  it('шапка: сезон, диапазон, отсчёт, кнопка календаря и подсказка AI', async () => {
    state.ctx = studentCtx;
    state.session = sessionFixture();
    state.throwing = false;

    const html = await renderPage();
    expect(html).toContain('Зимняя сессия');
    expect(html).toContain('23 декабря – 1 января');
    expect(html).toContain('data-testid="session-countdown"');
    expect(html).toContain('До первого экзамена 3 дня');
    expect(html).toContain('data-testid="session-ics"');
    expect(html).toContain('href="/api/session/ics"');
    expect(html).toContain('Добавить всю сессию в календарь');
    expect(html).toContain('data-testid="ai-hint"');
    expect(html).toContain('Подготовиться к экзамену по «Информатика»');
    // В HTML-атрибуте React экранирует & как &amp;.
    expect(html).toContain('href="/ai-assistant?intent=exam-prep&amp;discipline=PI21-INFO"');
  });

  it('таймлайн: дата/время/аудитория/преподаватель/тип и статусы-пилюли', async () => {
    state.ctx = studentCtx;
    state.session = sessionFixture();

    const html = await renderPage();
    expect(html).toContain('data-testid="session-timeline"');
    expect(html).toContain('data-testid="exam-item-exm-info-cr"');
    expect(html).toContain('data-testid="exam-item-exm-prog-cr"');
    expect(html).toContain('data-testid="exam-item-exm-disc-ex"');
    expect(html).toContain('data-testid="exam-status"');
    expect(html).toContain('Допущен');
    expect(html).toContain('Сдано · 74');
    expect(html).toContain('10:00');
    expect(html).toContain('каб. 210');
    expect(html).toContain('Петров Пётр Петрович');
    expect(html).toContain('Зачёт');
    expect(html).toContain('Экзамен');
  });

  it('не допущенный экзамен: причина видна и есть действие «Что сдать»', async () => {
    state.ctx = studentCtx;
    state.session = sessionFixture();

    const html = await renderPage();
    expect(html).toContain('Не допущен');
    expect(html).toContain('data-testid="admission-reason"');
    expect(html).toContain('Не сдано: Коллоквиум');
    expect(html).toContain('data-testid="admission-action"');
    expect(html).toContain('href="/grades/PI21-INFO"');
  });

  it('пересдачи: карточки, кнопка «Записаться» и состояние «Заявка создана»', async () => {
    state.ctx = studentCtx;
    state.session = sessionFixture();

    const html = await renderPage();
    expect(html).toContain('Пересдачи');
    expect(html).toContain('data-testid="retake-item-exm-info-rt"');
    expect(html).toContain('data-testid="retake-signup"');
    expect(html).toContain('Записаться');
    expect(html).toContain('Пересдача коллоквиума');
    // Уже запрошенная пересдача: бейдж + ссылка на заявку вместо кнопки.
    expect(html).toContain('data-testid="retake-requested"');
    expect(html).toContain('href="/requests/SR-2026-ZZ001"');
  });

  it('консультации выводятся из расписания', async () => {
    state.ctx = studentCtx;
    state.session = sessionFixture();

    const html = await renderPage();
    expect(html).toContain('data-testid="session-consultations"');
    expect(html).toContain('Консультации');
    expect(html).toContain('Программирование');
    expect(html).toContain('14:00 – 15:30');
  });
});

describe('/grades/session — состояния', () => {
  it('прошедшая пересдача: пояснение вместо кнопки записи', async () => {
    state.ctx = studentCtx;
    state.session = sessionFixture();
    state.session.retakes[0]!.signUpAvailable = false;

    const html = await renderPage();
    expect(html).toContain('Пересдача уже состоялась — запись закрыта');
    expect(html).not.toContain('data-testid="retake-signup"');
  });

  it('пустая сессия: пустое состояние без таймлайна', async () => {
    state.ctx = studentCtx;
    state.session = {
      studentId: 'st-anna',
      seasonTitle: 'Сессия',
      rangeLabel: null,
      countdown: null,
      exams: [],
      retakes: [],
      consultations: [],
    };

    const html = await renderPage();
    expect(html).toContain('Сессия не запланирована');
    expect(html).not.toContain('data-testid="session-timeline"');
    expect(html).not.toContain('data-testid="session-retakes"');
    expect(html).not.toContain('data-testid="session-consultations"');
  });

  it('сотруднику деканата экран не показывается', async () => {
    state.ctx = staffCtx;
    state.session = null;

    const html = await renderPage();
    expect(html).toContain('Экран доступен студентам');
    expect(html).not.toContain('data-testid="session-ics"');
    expect(html).not.toContain('data-testid="session-timeline"');
  });

  it('сбой слоя данных: состояние ошибки с «Повторить»', async () => {
    state.ctx = studentCtx;
    state.throwing = true;
    state.session = null;

    const html = await renderPage();
    expect(html).toContain('Сессия не загрузилась');
    expect(html).toContain('Повторить');
    expect(html).not.toContain('data-testid="session-timeline"');
  });
});
