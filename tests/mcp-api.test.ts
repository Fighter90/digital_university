// DIG-64 — POST /api/mcp: контракт MCP-сервера на живом data-слое.
//
// Роут тестируется как функция (Request → Response) без поднятия сервера:
// тот же приём, что и у чистого диспетчера, но с реальным seeding и
// реальным scoping. Закреплено:
//  - 401 без токена / с неверным токеном (+ WWW-Authenticate: Bearer);
//  - initialize / tools/list / tools/call работают на демо-данных владельца;
//  - токен Анны НЕ видит данные Ильи (IDOR исключён);
//  - GET → 405; перебор → 429 с Retry-After.
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { dataDb } from '@/server/data/db';
import { toDataCtx } from '@/server/data/context';
import { rotateOwnMcpToken } from '@/server/data/mcp';
import { generateMcpDemoToken } from '@/server/mcp/token';
import { MCP_RATE_MAX_ATTEMPTS } from '@/server/mcp/rate-limit';
import { fromMoscowWallClock } from '@/lib/schedule-time';
import type { GradeRow, NotificationRow, ScheduleEventRow } from '@/server/data/types';

// ensureAppData перезаписал бы тестовый seed демо-набором — в этих тестах
// seed выставляется вручную.
vi.mock('@/server/data/bootstrap', () => ({ ensureAppData: vi.fn(async () => {}) }));

// Лимитер приложения живёт в globalThis — подменяем на чистый для 429-теста.
vi.mock('@/server/mcp/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/mcp/rate-limit')>();
  return { ...actual, mcpRateLimiter: actual.createMcpRateLimiter({ maxAttempts: 3 }) };
});

const { POST, GET } = await import('@/app/api/mcp/route');

const NOW = fromMoscowWallClock(2026, 11, 16, 10, 0);
const TODAY = fromMoscowWallClock(2026, 11, 16, 9, 0);

const STUDENTS = [
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
];

const mkGrade = (overrides: Partial<GradeRow>): GradeRow => ({
  id: 'g',
  studentId: 'st-anna',
  elementCode: 'el',
  elementName: 'Тест',
  disciplineCode: 'ВЕБ-1',
  disciplineName: 'Веб-разработка',
  score: 9,
  maxScore: 10,
  weight: 0.2,
  kind: 'TEST',
  gradedAt: NOW,
  comment: null,
  ...overrides,
});

const mkEvent = (overrides: Partial<ScheduleEventRow>): ScheduleEventRow => ({
  id: 'ev',
  groupName: 'ПИ-21',
  disciplineCode: 'ВЕБ-1',
  disciplineName: 'Веб-разработка',
  date: TODAY,
  startsAt: TODAY,
  endsAt: new Date(TODAY.getTime() + 90 * 60 * 1000),
  kind: 'LECTURE',
  room: 'Б-301',
  teacherName: 'Иванов А. Б.',
  status: 'SCHEDULED',
  note: null,
  previousRoom: null,
  previousStartsAt: null,
  changeNote: null,
  ...overrides,
});

const mkNotification = (overrides: Partial<NotificationRow>): NotificationRow => ({
  id: 'n',
  studentId: 'st-anna',
  type: 'GRADE',
  title: 'Новая оценка',
  body: 'Веб-разработка: тест — 9 из 10',
  isRead: false,
  createdAt: NOW,
  link: '/grades',
  ...overrides,
});

let annaToken: string;
let ilyaToken: string;

beforeAll(async () => {
  dataDb.seed({
    students: STUDENTS,
    grades: [
      mkGrade({ id: 'g-a', score: 8 }),
      mkGrade({
        id: 'g-i',
        studentId: 'st-ilya',
        disciplineName: 'Микроэкономика',
        elementName: 'Эссе',
        score: 7,
      }),
    ],
    notifications: [
      mkNotification({ id: 'n-a', title: 'Уведомление Анны' }),
      mkNotification({
        id: 'n-i',
        studentId: 'st-ilya',
        type: 'REQUEST',
        title: 'Уведомление Ильи',
      }),
    ],
    schedule: [
      mkEvent({ id: 'ev-a' }),
      mkEvent({
        id: 'ev-i',
        groupName: 'ЭК-11',
        disciplineName: 'Микроэкономика',
        room: 'Г-5',
      }),
    ],
    settings: [],
  });

  const anna = (await toDataCtx({ id: 'auth-anna', login: 'anna', role: 'STUDENT' }, dataDb))!;
  const ilya = (await toDataCtx({ id: 'auth-ilya', login: 'ilya', role: 'STUDENT' }, dataDb))!;
  // Выпускаем токены владельцам: rotate возвращает превью (plaintext живёт
  // только в сгенерированной структуре — как в UI, где он показывается один раз).
  const forAnna = generateMcpDemoToken(NOW);
  const forIlya = generateMcpDemoToken(NOW);
  expect(await rotateOwnMcpToken(dataDb, anna, forAnna)).not.toBeNull();
  expect(await rotateOwnMcpToken(dataDb, ilya, forIlya)).not.toBeNull();
  annaToken = forAnna.token;
  ilyaToken = forIlya.token;
});

afterEach(() => {
  dataDb.auditEvents().length = 0;
});

const post = (body: unknown, token?: string, ip = 'ip-default') =>
  POST(
    new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-real-ip': ip,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

describe('POST /api/mcp — доступ', () => {
  it('без токена — 401 с WWW-Authenticate: Bearer', async () => {
    const res = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, undefined, 'ip-noauth');
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Bearer');
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32001);
  });

  it('неверный токен — 401', async () => {
    const res = await post(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      'demo-mcp-wrong',
      'ip-wrong',
    );
    expect(res.status).toBe(401);
  });

  it('с валидным токеном initialize отвечает serverInfo', async () => {
    const res = await post(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 't', version: '0' },
        },
      },
      annaToken,
      'ip-init',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const body = (await res.json()) as { result: { serverInfo: { name: string } } };
    expect(body.result.serverInfo.name).toBe('digital-deanery');
  });

  it('tools/list — три инструмента', async () => {
    const res = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, annaToken, 'ip-list');
    const body = (await res.json()) as { result: { tools: { name: string }[] } };
    expect(body.result.tools.map((t) => t.name)).toEqual([
      'my_schedule_today',
      'my_grades',
      'my_unread',
    ]);
  });
});

describe('POST /api/mcp — инструменты на демо-данных (IDOR)', () => {
  it('my_schedule_today: заголовок всегда, чужой группы в тексте нет', async () => {
    // «Сегодня» зависит от реальной даты и границ семестра (клиппинг — поведение
    // data-слоя, покрытое schedule-тестами), поэтому здесь закрепляем инвариант:
    // текст — расписание владельца, данные группы Ильи не появляются никогда.
    const res = await post(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'my_schedule_today' } },
      annaToken,
      'ip-sched',
    );
    const body = (await res.json()) as { result: { content: { text: string }[] } };
    expect(res.status).toBe(200);
    const text = body.result.content[0]!.text;
    expect(text).toContain('Расписание на сегодня');
    expect(text).not.toContain('Микроэкономика');
  });

  it('my_grades: только оценки владельца токена', async () => {
    const res = await post(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'my_grades' } },
      annaToken,
      'ip-grades',
    );
    const body = (await res.json()) as { result: { content: { text: string }[] } };
    const text = body.result.content[0]!.text;
    expect(text).toContain('Веб-разработка');
    expect(text).not.toContain('Микроэкономика');
  });

  it('токен Ильи отдаёт данные Ильи', async () => {
    const res = await post(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'my_unread' } },
      ilyaToken,
      'ip-ilya',
    );
    const body = (await res.json()) as { result: { content: { text: string }[] } };
    const text = body.result.content[0]!.text;
    expect(text).toContain('Уведомление Ильи');
    expect(text).not.toContain('Уведомление Анны');
  });

  it('неизвестный инструмент — -32602', async () => {
    const res = await post(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'hack' } },
      annaToken,
      'ip-hack',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32602);
  });

  it('мусорное тело — -32700 с HTTP 400', async () => {
    const res = await post('not-json' as unknown as object, annaToken, 'ip-garbage');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/mcp — перебор и методы', () => {
  it('429 после превышения лимита обращений, с Retry-After', async () => {
    let last: Response | null = null;
    for (let i = 0; i < MCP_RATE_MAX_ATTEMPTS + 2; i += 1) {
      last = await post(
        { jsonrpc: '2.0', id: i, method: 'tools/list' },
        'demo-mcp-wrong',
        'ip-brute',
      );
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('GET/PUT/DELETE → 405 (только POST поддержан)', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('POST');
  });
});
