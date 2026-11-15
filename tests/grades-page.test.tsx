// DIG-26 — render contract of the «Успеваемость: сводка» screen (unit, SSR).
// Same approach as tests/dashboard-page.test.tsx: the async server component
// is prerendered with mocked session/data modules. Pins the visible contract:
// semester pills, summary (ring + delta, credits bar, group rating with
// tooltips), traffic light, discipline cards grid, debts block, footer links,
// empty semester state, error state and the staff stub.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { PerformanceData, DisciplinePerformance } from '@/server/data/performance';
import type { GradeInsight } from '@/lib/grade-insight';
import type { DataCtx, ExamSessionRow } from '@/server/data/types';

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

const FALL_26 = { startYear: 2026, term: 'FALL' as const };
const SPRING_25 = { startYear: 2025, term: 'SPRING' as const };

function disc(overrides: Partial<DisciplinePerformance>): DisciplinePerformance {
  return {
    disciplineCode: 'X',
    disciplineName: 'Дисциплина',
    credits: 4,
    teacherName: 'Преподаватель П П',
    semester: FALL_26,
    semesterLabel: 'Осенний семестр 2026/27',
    accumulated: null,
    minGuaranteed: null,
    maxPossible: null,
    finalGrade: null,
    gradedElements: 0,
    totalElements: 3,
    isComplete: false,
    creditEarned: false,
    hasExamElement: true,
    examGraded: false,
    ...overrides,
  };
}

/**
 * Богатая фикстура: идущая осень 2026/27 (три дисциплины с накопленными) +
 * завершённая весна 2025/26 (ALG 87, DISC 74) + два активных долга.
 */
const richPerformance: PerformanceData = {
  studentId: 'st-anna',
  disciplines: [
    disc({
      disciplineCode: 'PI21-INFO',
      disciplineName: 'Информатика',
      credits: 4,
      teacherName: 'Петров Пётр Петрович',
      accumulated: 48.9,
      minGuaranteed: 48.9,
      maxPossible: 88.9,
      gradedElements: 2,
    }),
    disc({
      disciplineCode: 'PI21-PROG',
      disciplineName: 'Программирование',
      credits: 6,
      teacherName: 'Иванова Ирина Игоревна',
      accumulated: 14,
      minGuaranteed: 14,
      maxPossible: 54,
      gradedElements: 2,
      hasExamElement: false,
    }),
    disc({
      disciplineCode: 'PI21-DB',
      disciplineName: 'Базы данных',
      credits: 5,
      teacherName: 'Соколов Сергей Сергеевич',
      accumulated: 25.5,
      minGuaranteed: 25.5,
      maxPossible: 95.5,
      gradedElements: 1,
    }),
    disc({
      disciplineCode: 'PI21-ALG',
      disciplineName: 'Алгоритмы и структуры данных',
      credits: 5,
      teacherName: 'Иванова Ирина Игоревна',
      semester: SPRING_25,
      semesterLabel: 'Весенний семестр 2025/26',
      accumulated: 86.5,
      minGuaranteed: 86.5,
      maxPossible: 100,
      finalGrade: 87,
      gradedElements: 2,
      totalElements: 2,
      isComplete: true,
      creditEarned: true,
      examGraded: true,
    }),
    disc({
      disciplineCode: 'PI21-DISC',
      disciplineName: 'Дискретная математика',
      credits: 4,
      teacherName: 'Кузнецова Ксения Кирилловна',
      semester: SPRING_25,
      semesterLabel: 'Весенний семестр 2025/26',
      accumulated: 74.2,
      minGuaranteed: 74.2,
      maxPossible: 100,
      finalGrade: 74,
      gradedElements: 2,
      totalElements: 2,
      isComplete: true,
      creditEarned: true,
      examGraded: true,
    }),
  ],
  gpa: {
    overall: 51.44,
    currentSemesterKey: FALL_26,
    currentSemesterLabel: 'Осенний семестр 2026/27',
    semester: 27.14,
    previousSemesterLabel: 'Весенний семестр 2025/26',
    previousSemesterGpa: 81.22,
    semesterDelta: -54.08,
  },
  credits: { earned: 9, required: 240 },
  rating: {
    rank: 2,
    groupSize: 5,
    bestPercent: 40,
    label: 'Вы входите в 40% лучших в группе',
  },
  debts: [
    {
      disciplineCode: 'PI21-PROG',
      disciplineName: 'Программирование',
      retakeDate: new Date(2026, 10, 8, 9, 0),
      daysLeft: -3,
      status: 'OVERDUE',
    },
    {
      disciplineCode: 'PI21-INFO',
      disciplineName: 'Информатика',
      retakeDate: new Date(2026, 10, 19, 9, 0),
      daysLeft: 7,
      status: 'ASSIGNED',
    },
  ],
};

/**
 * Фикстура «реального демо» (как у Анны в сиде): оценки только за весну
 * 2025/26, осень 2026/27 без оценок, долгов нет.
 */
const freshSemesterPerformance: PerformanceData = {
  ...richPerformance,
  disciplines: [
    ...richPerformance.disciplines.filter((d) => d.semester && d.semester.term === 'SPRING'),
    disc({
      disciplineCode: 'PI21-INFO',
      disciplineName: 'Информатика',
      accumulated: null,
      semester: null,
      semesterLabel: null,
    }),
    disc({
      disciplineCode: 'PI21-PROG',
      disciplineName: 'Программирование',
      accumulated: null,
      hasExamElement: false,
      semester: null,
      semesterLabel: null,
    }),
  ],
  gpa: {
    overall: 81.22,
    currentSemesterKey: FALL_26,
    currentSemesterLabel: 'Осенний семестр 2026/27',
    semester: null,
    previousSemesterLabel: 'Весенний семестр 2025/26',
    previousSemesterGpa: 81.22,
    semesterDelta: null,
  },
  debts: [],
};

const examSessions: ExamSessionRow[] = [
  {
    id: 'exm-credit-db',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    kind: 'CREDIT',
    date: new Date(2026, 10, 14, 10, 0),
    startsAt: new Date(2026, 10, 14, 10, 0),
    room: '212',
    note: null,
  },
  {
    id: 'exm-exam-info',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    kind: 'EXAM',
    date: new Date(2026, 11, 24, 10, 0),
    startsAt: new Date(2026, 11, 24, 10, 0),
    room: '305',
    note: null,
  },
  {
    id: 'exm-retake',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    kind: 'RETAKE',
    date: new Date(2026, 10, 20, 9, 0),
    startsAt: new Date(2026, 10, 20, 9, 0),
    room: '405',
    note: null,
  },
];

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
  getPerformance: vi.fn(async () => richPerformance),
  listExams: vi.fn(async () => examSessions),
  getGradeInsight: vi.fn(async () => demoInsight),
}));

/**
 * DIG-66 — фикстура инсайта «Что изменилось» для контракта рендера.
 * Числа согласованы с richPerformance по формулам GPA-кольца (ревью r2:
 * приёмка «данные совпадают с успеваемостью» закреплена и в юните):
 * INFO 48,9 (4 кр) → с PROG 14 (6 кр) среднее 27,96 → с DB 25,5 (5 кр)
 * среднее 27,14 — как у кольца сводки. Три работы месяца, направление
 * «new» (окно открывает семестр).
 */
const demoInsight: GradeInsight = {
  semesterLabel: 'Осенний семестр 2026/27',
  points: [
    {
      dateISO: '2026-10-28T12:00:00.000Z',
      average: 48.9,
      delta: null,
      works: [
        {
          disciplineName: 'Информатика',
          elementName: 'Тест 1',
          score: 88,
          maxScore: 100,
          dateISO: '2026-10-28T12:00:00.000Z',
        },
      ],
    },
    {
      dateISO: '2026-11-01T12:00:00.000Z',
      average: 27.96,
      delta: -20.94,
      works: [
        {
          disciplineName: 'Программирование',
          elementName: 'Лабораторная 2',
          score: 92,
          maxScore: 100,
          dateISO: '2026-11-01T12:00:00.000Z',
        },
        {
          disciplineName: 'Информатика',
          elementName: 'Тест 1',
          score: 88,
          maxScore: 100,
          dateISO: '2026-10-28T12:00:00.000Z',
        },
      ],
    },
    {
      dateISO: '2026-11-05T12:00:00.000Z',
      average: 27.14,
      delta: -0.82,
      works: [
        {
          disciplineName: 'Базы данных',
          elementName: 'Проект',
          score: 85,
          maxScore: 100,
          dateISO: '2026-11-05T12:00:00.000Z',
        },
        {
          disciplineName: 'Программирование',
          elementName: 'Лабораторная 2',
          score: 92,
          maxScore: 100,
          dateISO: '2026-11-01T12:00:00.000Z',
        },
        {
          disciplineName: 'Информатика',
          elementName: 'Тест 1',
          score: 88,
          maxScore: 100,
          dateISO: '2026-10-28T12:00:00.000Z',
        },
      ],
    },
  ],
  current: 27.14,
  month: {
    direction: 'new',
    works: [
      {
        disciplineName: 'Базы данных',
        elementName: 'Проект',
        score: 85,
        maxScore: 100,
        dateISO: '2026-11-05T12:00:00.000Z',
      },
      {
        disciplineName: 'Программирование',
        elementName: 'Лабораторная 2',
        score: 92,
        maxScore: 100,
        dateISO: '2026-11-01T12:00:00.000Z',
      },
      {
        disciplineName: 'Информатика',
        elementName: 'Тест 1',
        score: 88,
        maxScore: 100,
        dateISO: '2026-10-28T12:00:00.000Z',
      },
    ],
    baseline: null,
    delta: null,
  },
  headline: 'За месяц появились 3 новые работы — средний балл достиг 27,1 из 100',
  detail:
    'Сильнее всего средний снизила «Лабораторная 2» (Программирование, 92 из 100): 20,9 пункта.',
};

import GradesPage from '@/app/(cabinet)/grades/(summary)/page';

async function renderPage(Page: ComponentType, props?: Record<string, unknown>): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(Page, props));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html;
}

async function renderWith(overrides: {
  ctx?: DataCtx;
  performance?: PerformanceData;
  exams?: ExamSessionRow[];
  insight?: GradeInsight | null;
  /** Ревью r2: инсайт упал — проверяем деградацию, а не ErrorState экрана. */
  insightReject?: boolean;
  reject?: boolean;
  searchParams?: Record<string, string>;
}): Promise<string> {
  const dataModule = await import('@/server/data');
  const ctx = overrides.ctx ?? studentCtx;
  vi.mocked(dataModule.requireDataCtx).mockResolvedValueOnce(ctx);
  const getPerformance = vi.mocked(dataModule.getPerformance);
  const listExams = vi.mocked(dataModule.listExams);
  const getGradeInsight = vi.mocked(dataModule.getGradeInsight);
  const searchProps = overrides.searchParams
    ? { searchParams: Promise.resolve(overrides.searchParams) }
    : undefined;
  if (ctx.role === 'STAFF') {
    // Сотрудник получает заглушку до обращения к данным — очереди Once
    // не наполняются «лишними» значениями, которые могли бы протечь
    // в следующий тест.
    return renderPage(GradesPage);
  }
  // Ревью r2: очередь Once наполняется РОВНО тем, что тест сам проверяет.
  // В сценарии ошибки БД моки listExams/getGradeInsight не ставятся вовсе —
  // несъеденное значение больше не может остаться в очереди и «зеленить»
  // следующий тест случайно.
  if (overrides.reject) {
    getPerformance.mockRejectedValueOnce(new Error('db down'));
    return renderPage(GradesPage, searchProps);
  }
  getPerformance.mockResolvedValueOnce(overrides.performance ?? richPerformance);
  listExams.mockResolvedValueOnce(overrides.exams ?? examSessions);
  if (overrides.insightReject) {
    getGradeInsight.mockRejectedValueOnce(new Error('insight down'));
  } else {
    getGradeInsight.mockResolvedValueOnce(
      overrides.insight !== undefined ? overrides.insight : demoInsight,
    );
  }
  return renderPage(GradesPage, searchProps);
}

describe('/grades (DIG-26) — «Успеваемость: сводка»', () => {
  it('заголовок и пилюли семестров: по умолчанию открыт семестр с оценками', async () => {
    const html = await renderWith({});
    expect(html).toContain('Успеваемость');
    expect(html).toContain('Осень 26/27');
    expect(html).toContain('Весна 25/26');
    // дефолт — ближайший семестр с оценками (осень, у неё есть накопленные)
    expect(html).toContain('href="/grades?semester=2026-FALL"');
    expect(html).toContain('aria-current="page"');
  });

  it('сводка: кольцо среднего балла с дельтой, кредиты полосой, место в группе', async () => {
    const html = await renderWith({});
    // Кольцо GPA семестра: осень 27,14 → «27,1»; дельта к весне −54,08 → «−54,1»
    expect(html).toMatch(/aria-label="Средний балл семестра"/);
    expect(html).toContain('27,1');
    expect(html).toContain('−54,1');
    expect(html).toContain('Весна 25/26');
    // Кредиты 9 из 240 + полоса
    expect(html).toContain('из 240');
    expect(html).toMatch(/aria-label="Кредиты"/);
    expect(html).toMatch(/aria-valuenow="9"/);
    // Рейтинг в группе и формулировка «в N% лучших»
    expect(html).toContain('2 из 5');
    expect(html).toContain('Вы входите в 40% лучших в группе');
    expect(html).toContain('Как считается');
  });

  it('сокращения (GPA, кредит, перцентиль) объясняются тултипами (aria-label триггера)', async () => {
    const html = await renderWith({});
    expect(html).toMatch(/aria-label="[^"]*GPA[^"]*"/);
    expect(html).toMatch(/aria-label="[^"]*240[^"]*"/);
    expect(html).toMatch(/aria-label="[^"]*среднему баллу[^"]*"/);
  });

  it('светофор: активные долги → «Есть долги» с фразой и действием к блоку долгов', async () => {
    const html = await renderWith({});
    expect(html).toMatch(/data-testid="traffic-light" data-tone="debts"/);
    expect(html).toContain('Есть долги');
    expect(html).toContain('Активных долгов: 2');
    expect(html).toContain('Информатика');
    expect(html).toContain('href="#debts"');
  });

  it('карточки дисциплин: преподаватель, кредиты, накопленная крупно, «из возможных», бейдж допуска', async () => {
    const html = await renderWith({});
    // Осень по умолчанию: три карточки
    expect(html).toContain('Информатика');
    expect(html).toContain('Петров Пётр Петрович');
    expect(html).toContain('4 кр.');
    expect(html).toContain('48,9');
    expect(html).toContain('из возможных 88,9');
    expect(html).toContain('Допуск к экзамену есть');
    expect(html).toContain('Допуска к экзамену нет');
    expect(html).toMatch(/data-level="medium"/);
    expect(html).toMatch(/data-level="risk"/);
    // Клик по карточке ведёт в зачётную книжку с кодом дисциплины
    expect(html).toContain('href="/grades/gradebook?discipline=PI21-INFO"');
    // Словесные подписи уровней (цвет — не единственный носитель смысла)
    expect(html).toContain('Порог ещё не гарантирован');
    expect(html).toContain('Не дотянуть до порога');
    // В плане «Программирования» экзамена нет — бейджа допуска у карточки нет
    const progCard = html.slice(html.indexOf('PI21-PROG'));
    expect(progCard.slice(0, progCard.indexOf('</a>'))).not.toContain('Допуск');
  });

  it('блок «Долги»: статус, дата пересдачи и кнопка записи через деканат', async () => {
    const html = await renderWith({});
    expect(html).toMatch(/id="debts"/);
    expect(html).toContain('Просрочена');
    expect(html).toContain('Назначена');
    expect(html).toContain('Пересдача была 8 ноября — долг не закрыт');
    expect(html).toContain('Пересдача назначена на 19 ноября (осталось 7 дней)');
    expect(html.match(/Записаться на пересдачу/g)?.length).toBe(2);
    expect(html).toContain('href="/deanery"');
  });

  it('нижние ссылки: «Сессия» и «Нашли ошибку в оценке? Написать в деканат»', async () => {
    const html = await renderWith({});
    expect(html).toContain('href="/grades/session"');
    expect(html).toContain('Сессия');
    expect(html).toContain('Нашли ошибку в оценке?');
    expect(html).toContain('Написать в деканат');
  });

  it('?semester=2025-SPRING — завершённый семестр: итоги, «Экзамен сдан», дельты нет', async () => {
    const html = await renderWith({ searchParams: { semester: '2025-SPRING' } });
    expect(html).toContain('81,2');
    expect(html).toContain('87');
    expect(html).toContain('74');
    expect(html).toContain('Экзамен сдан');
    expect(html).toContain('Отлично');
    expect(html).toContain('Хорошо');
    expect(html).not.toMatch(/data-testid="gpa-delta"/);
    // DIG-26: осенние КАРТОЧКИ не показаны. Проверяем по «из возможных 88,9» —
    // маркеру карточки осени: голое «48,9» с DIG-66 легитимно встречается в
    // подписи точки AI-графика (тренд идущего семестра не зависит от ?semester).
    expect(html).not.toContain('из возможных 88,9');
  });

  it('мусорный ?semester= откатывается к дефолту', async () => {
    const html = await renderWith({ searchParams: { semester: 'h4x' } });
    expect(html).toContain('48,9'); // осень (дефолт) отрисована
  });

  it('семестр без оценок: пустое состояние с подсказкой о первой контрольной', async () => {
    // Дата-бомба: подсказка называет первую контрольную В БУДУЩЕМ относительно
    // реального «сегодня» (grades page читает new Date() при рендере). Без пина
    // тест детерминированно красный с 14.11.2026 (зачёт по «Базам данных»
    // становится прошлым и подсказка перескакивает на «Информатику»).
    // Пиним Date на день до fixture-ного зачёта; фейкуются только Date,
    // таймеры не трогаем — prerenderToNodeStream остаётся асинхронно живым.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 13, 9, 0) });
    try {
      const html = await renderWith({
        performance: freshSemesterPerformance,
        searchParams: { semester: '2026-FALL' },
      });
      expect(html).toContain('Оценок пока нет');
      expect(html).toContain('Первая контрольная');
      expect(html).toContain('Базы данных');
      expect(html).toContain('14 ноября');
      // карточек дисциплин нет — только пустое состояние
      expect(html).not.toContain('data-testid="discipline-card"');
      // светофор честно нейтрален: долгов нет, оценок нет
      expect(html).toMatch(/data-testid="traffic-light" data-tone="idle"/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('дефолт при пустом текущем семестре — семестр с последними оценками (весна)', async () => {
    const html = await renderWith({ performance: freshSemesterPerformance });
    expect(html).toContain('81,2'); // кольцо весны 2025/26
    expect(html).toContain('Экзамен сдан');
  });

  it('ошибка агрегата → ErrorState с кнопкой «Повторить»', async () => {
    const html = await renderWith({ reject: true });
    expect(html).toMatch(/role="alert"/);
    expect(html).toContain('Успеваемость не загрузилась');
    expect(html).toContain('Повторить');
  });

  it('STAFF — явная заглушка вместо студенческих данных', async () => {
    const html = await renderWith({ ctx: staffCtx });
    expect(html).toContain('Экран доступен студентам');
    expect(html).not.toContain('data-testid="discipline-card"');
    // DIG-66: инсайт динамики — студенческий блок, сотруднику не рендерится.
    expect(html).not.toContain('data-testid="grade-insight"');
  });

  it('DIG-66 — карточка «Что изменилось»: объяснение месяца и разбор работ', async () => {
    const html = await renderWith({});
    expect(html).toContain('data-testid="grade-insight"');
    expect(html).toContain('Что изменилось');
    expect(html).toContain('AI-анализ');
    expect(html).toContain('без внешних сервисов');
    expect(html).toContain('data-testid="grade-insight-headline"');
    expect(html).toContain('За месяц появились 3 новые работы');
    // Разбор активной (последней) точки: работы, повлиявшие на средний.
    expect(html).toContain('data-testid="insight-point"');
    expect(html).toContain('Лабораторная 2');
    expect(html).toContain('92 из 100');
    expect(html).toContain('aria-pressed="true"');
    // Три работы идущего семестра фикстуры — три строки разбора последней точки
    // (зеркало e2e: столько же, сколько точек графика).
    expect(html.match(/data-testid="insight-work"/g)?.length).toBe(3);
    // «Данные совпадают с успеваемостью» на уровне контракта рендера:
    // current карточки — то же число, что у GPA-кольца сводки (27,1).
    const current = html.slice(html.indexOf('data-testid="grade-insight-current"'));
    expect(current.slice(0, 200)).toContain('27,1');
    // Текущий средний карточки имеет testid для сверки с кольцом (e2e).
    expect(html).toContain('data-testid="grade-insight-current"');
  });

  it('DIG-66 — без инсайта (нет оценок) карточка не рендерится', async () => {
    const html = await renderWith({ insight: null });
    expect(html).not.toContain('data-testid="grade-insight"');
  });

  it('DIG-66 (ревью r2) — сбой инсайта не роняет экран: сводка жива, карточки нет', async () => {
    // Карточка вспомогательная: падение её агрегата (временная ошибка
    // хранилища) не должно превращать весь экран в ErrorState.
    const html = await renderWith({ insightReject: true });
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('data-testid="grade-insight"');
    // Остальной экран отрисован как обычно: кольцо среднего на месте.
    expect(html).toMatch(/aria-label="Средний балл семестра"/);
    expect(html).toContain('27,1');
  });

  it('страница живёт в main-регионе Shell и не заводит собственный <main>', async () => {
    const html = await renderWith({});
    expect(html).toContain('<section');
    expect(html).not.toContain('<main');
  });

  it('загрузка — скелетон: loading.tsx подключает GradesSkeleton', () => {
    const loading = readFileSync(
      resolve(import.meta.dirname, '../src/app/(cabinet)/grades/(summary)/loading.tsx'),
      'utf8',
    );
    expect(loading).toContain('GradesSkeleton');
    const skeleton = readFileSync(
      resolve(import.meta.dirname, '../src/components/performance/grades-skeleton.tsx'),
      'utf8',
    );
    expect(skeleton).toContain('aria-busy="true"');
  });
});
