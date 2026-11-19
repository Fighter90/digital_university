// DIG-101 — контракты роутов экспорта расписания (Request → Response):
// корректные Content-Type/Content-Disposition, owner-scope живой сессии
// (пары только своей группы; скоуп-параметров в URL нет), сотруднику —
// единый 404 (uniform not-found), аноним — редирект на /login.
// Роуты тестируются как функции на реальном in-memory слое данных
// (тот же приём, что tests/mcp-api.test.ts / data-isolation.test.ts).
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { dataDb } from '@/server/data/db';
import { fromMoscowWallClock } from '@/lib/schedule-time';
import type { ScheduleEventRow } from '@/server/data/types';

// ensureAppData перезаписал бы тестовый seed демо-набором — seed вручную.
vi.mock('@/server/data/bootstrap', () => ({ ensureAppData: vi.fn(async () => {}) }));

// Живая сессия подменяется тестом (аноним / анна / илья / мария).
const getAuthSession = vi.fn();
vi.mock('@/server/auth/session', () => ({ getAuthSession: () => getAuthSession() }));

beforeAll(async () => {
  const thursday = fromMoscowWallClock(2026, 11, 19, 10, 0); // Чт недели 16–22.11
  const tuesday = fromMoscowWallClock(2026, 11, 17, 12, 0);
  const mk = (
    id: string,
    groupName: string,
    disciplineName: string,
    startsAt: Date,
  ): ScheduleEventRow => ({
    id,
    groupName,
    disciplineCode: 'X-1',
    disciplineName,
    date: startsAt,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 90 * 60_000),
    kind: 'LECTURE',
    room: '305',
    teacherName: 'Тестовый Преподаватель',
    status: 'SCHEDULED',
    note: null,
  });
  dataDb.seed({
    students: [
      {
        id: 'st-anna',
        login: 'anna',
        fullName: 'Анна Ковалёва',
        email: 'anna@example.edu',
        groupName: 'ПИ-21',
        course: 2,
        faculty: 'ИТ',
        program: 'Прикладная информатика',
        programCode: '09.03.04',
        studyForm: 'очная',
        funding: 'бюджет',
        gradebookNumber: '20231234',
      },
      {
        id: 'st-ilya',
        login: 'ilya',
        fullName: 'Илья Смирнов',
        email: 'ilya@example.edu',
        groupName: 'ЭК-11',
        course: 1,
        faculty: 'ЭК',
        program: 'Экономика',
        programCode: '38.03.01',
        studyForm: 'очная',
        funding: 'контракт',
        gradebookNumber: '20254567',
      },
    ],
    staff: [
      {
        id: 'stf-maria',
        login: 'maria',
        fullName: 'Мария Петрова',
        position: 'Специалист деканата',
        email: 'maria@example.edu',
        faculty: 'ИТ',
      },
    ],
    schedule: [
      mk('exp-anna-thu', 'ПИ-21', 'Информатика группы Анны', thursday),
      mk('exp-anna-tue', 'ПИ-21', 'Физика группы Анны', tuesday),
      mk('exp-ilya-tue', 'ЭК-11', 'Экономика группы Ильи', tuesday),
    ],
  });
});

const sessionAs = (user: { id: string; login: string; role: 'STUDENT' | 'STAFF' } | null) =>
  getAuthSession.mockResolvedValue(user ? { user } : null);

const MD_URL = 'http://localhost:3000/api/export/schedule.md?view=week&date=2026-11-19';

describe('GET /api/export/schedule.md', () => {
  it('аноним — редирект на /login (данные не отдаются без сессии)', async () => {
    sessionAs(null);
    const { GET } = await import('@/app/api/export/schedule.md/route');
    await expect(GET(new Request(MD_URL))).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it('владелец: markdown недели, Content-Disposition с ASCII-именем файла', async () => {
    sessionAs({ id: 'auth-anna', login: 'anna', role: 'STUDENT' });
    const { GET } = await import('@/app/api/export/schedule.md/route');
    const response = await GET(new Request(MD_URL));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="schedule-2026-11-19-week.md"',
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await response.text();
    // Свои пары обоих дней недели — на месте.
    expect(body).toContain('Информатика группы Анны');
    expect(body).toContain('Физика группы Анны');
    // Чужая группа не попадает (owner-scope).
    expect(body).not.toContain('Экономика группы Ильи');
    // Колонки по постановке задачи.
    expect(body).toContain('| Время | Дисциплина | Тип | Аудитория | Преподаватель |');
  });

  it('другой студент: только своя группа (IDOR исключён скоупом сессии)', async () => {
    sessionAs({ id: 'auth-ilya', login: 'ilya', role: 'STUDENT' });
    const { GET } = await import('@/app/api/export/schedule.md/route');
    const body = await (
      await GET(new Request(MD_URL))
    ).text();
    expect(body).toContain('Экономика группы Ильи');
    expect(body).not.toContain('Информатика группы Анны');
    expect(body).not.toContain('Физика группы Анны');
  });

  it('view=day: только пары запрошенного дня, имя файла -day', async () => {
    sessionAs({ id: 'auth-anna', login: 'anna', role: 'STUDENT' });
    const { GET } = await import('@/app/api/export/schedule.md/route');
    const response = await GET(
      new Request('http://localhost:3000/api/export/schedule.md?view=day&date=2026-11-17'),
    );
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="schedule-2026-11-17-day.md"',
    );
    const body = await response.text();
    expect(body).toContain('Физика группы Анны');
    expect(body).not.toContain('Информатика группы Анны'); // четверг, не вторник
  });

  it('мусорные view/date — не падает, дефолт (сегодня) без скоуп-утечки', async () => {
    sessionAs({ id: 'auth-anna', login: 'anna', role: 'STUDENT' });
    const { GET } = await import('@/app/api/export/schedule.md/route');
    const response = await GET(
      new Request('http://localhost:3000/api/export/schedule.md?view=banana&date=banana'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="schedule-/);
  });

  it('сотрудник — единый 404 JSON (uniform not-found)', async () => {
    sessionAs({ id: 'auth-maria', login: 'maria', role: 'STAFF' });
    const { GET } = await import('@/app/api/export/schedule.md/route');
    const response = await GET(new Request(MD_URL));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });
});

describe('GET /api/export/schedule.xlsx', () => {
  it('владелец: OOXML-пакет с правильным content-type и именем файла', async () => {
    sessionAs({ id: 'auth-anna', login: 'anna', role: 'STUDENT' });
    const { GET } = await import('@/app/api/export/schedule.xlsx/route');
    const response = await GET(new Request(MD_URL.replace('.md', '.xlsx')));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="schedule-2026-11-19-week.xlsx"',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('сотрудник — единый 404', async () => {
    sessionAs({ id: 'auth-maria', login: 'maria', role: 'STAFF' });
    const { GET } = await import('@/app/api/export/schedule.xlsx/route');
    expect((await GET(new Request(MD_URL.replace('.md', '.xlsx')))).status).toBe(404);
  });
});

describe('GET /api/export/schedule.pdf', () => {
  it('владелец: application/pdf, %PDF-вывод, имя файла -week.pdf', async () => {
    sessionAs({ id: 'auth-anna', login: 'anna', role: 'STUDENT' });
    const { GET } = await import('@/app/api/export/schedule.pdf/route');
    const response = await GET(new Request(MD_URL.replace('.md', '.pdf')));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="schedule-2026-11-19-week.pdf"',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
  });

  it('сотрудник — единый 404', async () => {
    sessionAs({ id: 'auth-maria', login: 'maria', role: 'STAFF' });
    const { GET } = await import('@/app/api/export/schedule.pdf/route');
    expect((await GET(new Request(MD_URL.replace('.md', '.pdf')))).status).toBe(404);
  });
});
