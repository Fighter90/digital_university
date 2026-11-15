// DIG-64 — демо-MCP-сервер деканата: чистый протокол, персональный токен,
// форматирование ответов инструментов.
//
// Red-first: контракт закреплён до реализации. Ключевые гарантии:
//  - JSON-RPC-диспетчер: initialize / tools/list / tools/call / ping,
//    уведомления → 202, ошибки -32601/-32602/-32700;
//  - токен: в хранилище ТОЛЬКО SHA-256-хэш (plaintext не сохраняется),
//    перевыпуск отзывает прежний токен, staff → ROLE_MISMATCH в аудит;
//  - resolveMcpDemoToken строит скоупленный ctx владельца — данные другого
//    студента через чужой токен недостижимы (IDOR исключён);
//  - форматирование: переносы/отмены пар, лимиты и счётчики оценок/уведомлений.
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import { defaultSettingsFor, getOwnSettings, normalizeSettings } from '@/server/data/profile';
import { getOwnMcpTokenView, resolveMcpDemoToken, rotateOwnMcpToken } from '@/server/data/mcp';
import { generateMcpDemoToken } from '@/server/mcp/token';
import {
  DEANERY_MCP_TOOLS,
  MCP_DEFAULT_PROTOCOL_VERSION,
  buildMcpServerUrl,
  dispatchMcpJsonRpc,
  isDeaneryMcpToolName,
  negotiateProtocolVersion,
} from '@/lib/mcp-protocol';
import { formatGrades, formatScheduleToday, formatUnread } from '@/lib/mcp-format';
import { formatMoscowTime, fromMoscowWallClock } from '@/lib/schedule-time';
import type {
  DataCtx,
  GradeRow,
  NotificationRow,
  ScheduleEventRow,
  StoredStudentSettingsRow,
} from '@/server/data/types';

// ── Фикстуры (вымышленные, как весь демо-набор) ─────────────────────────────

const NOW = fromMoscowWallClock(2026, 11, 16, 10, 0); // понедельник, внутри семестра
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

const STAFF = [
  {
    id: 'stf-maria',
    login: 'maria',
    fullName: 'Мария Петрова',
    position: 'Специалист деканата',
    email: 'maria@example.edu',
    faculty: 'ИТ',
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

const pairAt = (hour: number) => {
  const startsAt = fromMoscowWallClock(2026, 11, 16, hour, 0);
  return { startsAt, endsAt: new Date(startsAt.getTime() + 90 * 60 * 1000) };
};

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx;

beforeAll(async () => {
  db = createMemoryDataDb();
  db.seed({
    students: STUDENTS,
    staff: STAFF,
    grades: [
      mkGrade({ id: 'g-a1', score: 8, gradedAt: fromMoscowWallClock(2026, 10, 1, 12, 0) }),
      mkGrade({ id: 'g-a2', elementName: 'Коллоквиум', score: 10, weight: 0.3 }),
      mkGrade({
        id: 'g-i1',
        studentId: 'st-ilya',
        disciplineName: 'Микроэкономика',
        score: 7,
      }),
    ],
    notifications: [
      mkNotification({ id: 'n-a1', title: 'Новая оценка по Веб-разработке' }),
      mkNotification({ id: 'n-a2', title: 'Заявка готова', type: 'REQUEST' }),
      mkNotification({ id: 'n-a3', title: 'Прочитанное', isRead: true }),
      mkNotification({
        id: 'n-i1',
        studentId: 'st-ilya',
        title: 'Уведомление Ильи',
      }),
    ],
    schedule: [
      mkEvent({ id: 'ev-a1', ...pairAt(9) }),
      mkEvent({
        id: 'ev-a2',
        ...pairAt(11),
        disciplineName: 'Базы данных',
        kind: 'LAB',
        room: 'А-12',
      }),
      mkEvent({
        id: 'ev-i1',
        groupName: 'ЭК-11',
        disciplineName: 'Микроэкономика',
        ...pairAt(9),
      }),
    ],
    settings: [
      { ...defaultSettingsFor('st-anna'), updatedAt: NOW },
      { ...defaultSettingsFor('st-ilya'), updatedAt: NOW },
    ],
  });
  anna = (await toDataCtx({ id: 'auth-anna', login: 'anna', role: 'STUDENT' }, db))!;
  ilya = (await toDataCtx({ id: 'auth-ilya', login: 'ilya', role: 'STUDENT' }, db))!;
  maria = (await toDataCtx({ id: 'auth-maria', login: 'maria', role: 'STAFF' }, db))!;
});

const lastAudit = () => db.auditEvents().at(-1);

// ── Каталог инструментов и переговоры версии ────────────────────────────────

describe('lib/mcp-protocol — каталог инструментов', () => {
  it('ровно три инструмента с понятными названиями и JSON-Schema', () => {
    expect(DEANERY_MCP_TOOLS.map((t) => t.name)).toEqual([
      'my_schedule_today',
      'my_grades',
      'my_unread',
    ]);
    for (const tool of DEANERY_MCP_TOOLS) {
      expect(tool.title.length).toBeGreaterThan(3);
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
    }
  });

  it('isDeaneryMcpToolName — whitelist по каталогу', () => {
    expect(isDeaneryMcpToolName('my_grades')).toBe(true);
    expect(isDeaneryMcpToolName('delete_everything')).toBe(false);
    expect(isDeaneryMcpToolName(undefined)).toBe(false);
  });

  it('negotiateProtocolVersion: поддержанная версия клиента возвращается, чужая — дефолт', () => {
    expect(negotiateProtocolVersion('2025-06-18')).toBe('2025-06-18');
    expect(negotiateProtocolVersion('2025-03-26')).toBe('2025-03-26');
    expect(negotiateProtocolVersion('1999-01-01')).toBe(MCP_DEFAULT_PROTOCOL_VERSION);
    expect(negotiateProtocolVersion(undefined)).toBe(MCP_DEFAULT_PROTOCOL_VERSION);
    expect(negotiateProtocolVersion({ hack: true })).toBe(MCP_DEFAULT_PROTOCOL_VERSION);
  });

  it('buildMcpServerUrl собирает абсолютный URL эндпоинта', () => {
    expect(buildMcpServerUrl('ostrovok.store', 'https')).toBe('https://ostrovok.store/api/mcp');
    expect(buildMcpServerUrl('localhost:3000', null)).toBe('http://localhost:3000/api/mcp');
    expect(buildMcpServerUrl('https://demo.example/', 'https')).toBe(
      'https://demo.example/api/mcp',
    );
  });
});

// ── JSON-RPC-диспетчер ──────────────────────────────────────────────────────

const dispatch = async (body: unknown) => dispatchMcpJsonRpc(body, { runTool: async () => 'ok' });

describe('lib/mcp-protocol — JSON-RPC', () => {
  it('initialize: serverInfo, capabilities и согласованная protocolVersion', async () => {
    const res = await dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      },
    });
    expect(res.status).toBe(200);
    const body = res.body as {
      id: number;
      result: { protocolVersion: string; serverInfo: { name: string }; capabilities: object };
    };
    expect(body.id).toBe(1);
    expect(body.result.protocolVersion).toBe('2025-06-18');
    expect(body.result.serverInfo.name).toBe('digital-deanery');
    expect(body.result.capabilities).toHaveProperty('tools');
  });

  it('initialize с неподдержанной версией отвечает дефолтной', async () => {
    const res = await dispatch({
      jsonrpc: '2.0',
      id: 'x',
      method: 'initialize',
      params: { protocolVersion: '1970-01-01' },
    });
    expect((res.body as { result: { protocolVersion: string } }).result.protocolVersion).toBe(
      MCP_DEFAULT_PROTOCOL_VERSION,
    );
  });

  it('tools/list возвращает каталог', async () => {
    const res = await dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = (res.body as { result: { tools: { name: string }[] } }).result.tools;
    expect(tools.map((t) => t.name)).toEqual(['my_schedule_today', 'my_grades', 'my_unread']);
  });

  it('tools/call запускает инструмент и возвращает текстовый content', async () => {
    const res = await dispatchMcpJsonRpc(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'my_grades', arguments: {} } },
      { runTool: async (name) => `ran:${name}` },
    );
    const body = res.body as {
      result: { isError: boolean; content: { type: string; text: string }[] };
    };
    expect(body.result.isError).toBe(false);
    expect(body.result.content[0]?.type).toBe('text');
    expect(body.result.content[0]?.text).toBe('ran:my_grades');
  });

  it('tools/call неизвестного инструмента — ошибка -32602', async () => {
    const res = await dispatch({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'drop_tables' },
    });
    expect((res.body as { error: { code: number } }).error.code).toBe(-32602);
  });

  it('ошибка внутри инструмента не ломает протокол (isError: true)', async () => {
    const res = await dispatchMcpJsonRpc(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'my_unread' } },
      {
        runTool: async () => {
          throw new Error('boom');
        },
      },
    );
    const body = res.body as { result: { isError: boolean; content: { text: string }[] } };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0]?.text).toContain('Ошибка');
  });

  it('неизвестный метод с id — ошибка -32601, без id — уведомление 202', async () => {
    const withId = await dispatch({ jsonrpc: '2.0', id: 6, method: 'nope/method' });
    expect(withId.status).toBe(200);
    expect((withId.body as { error: { code: number } }).error.code).toBe(-32601);

    const notification = await dispatch({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(notification.status).toBe(202);
    expect(notification.body).toBeNull();
  });

  it('ping отвечает пустым результатом', async () => {
    const res = await dispatch({ jsonrpc: '2.0', id: 7, method: 'ping' });
    expect((res.body as { result: object }).result).toEqual({});
  });

  it('мусор вместо JSON-RPC — parse error -32700 с HTTP 400', async () => {
    for (const garbage of [undefined, null, 'hello', 42, [], {}]) {
      const res = await dispatch(garbage);
      expect(res.status, `garbage: ${String(garbage)}`).toBe(400);
      expect((res.body as { error: { code: number } }).error.code).toBe(-32700);
    }
  });

  it('ответы всегда jsonrpc 2.0 с эхом id', async () => {
    const res = await dispatch({ jsonrpc: '2.0', id: 'abc', method: 'tools/list' });
    expect((res.body as { jsonrpc: string; id: string }).jsonrpc).toBe('2.0');
    expect((res.body as { id: string }).id).toBe('abc');
  });
});

// ── Токен: генерация, хранение, ротация, resolve ────────────────────────────

describe('server/mcp/token — генерация', () => {
  it('токен вымышленный (demo-), длинный, хэш не раскрывает plaintext', () => {
    const generated = generateMcpDemoToken(NOW);
    expect(generated.token).toMatch(/^demo-mcp-/);
    expect(generated.token.length).toBeGreaterThanOrEqual(40);
    expect(generated.tokenHash).not.toContain(generated.token);
    expect(generated.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // Превью — префикс + последние 4 символа настоящего токена.
    const [prefix, suffix] = generated.tokenPreview.split('…');
    expect(generated.token.startsWith(prefix)).toBe(true);
    expect(generated.token.endsWith(suffix)).toBe(true);
    expect(generated.createdAt.getTime()).toBe(NOW.getTime());
  });

  it('два вызова дают разные токены (случайность)', () => {
    const a = generateMcpDemoToken(NOW);
    const b = generateMcpDemoToken(NOW);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe('data/mcp — выпуск и resolve токена (IDOR)', () => {
  it('rotate сохраняет в настройках ТОЛЬКО хэш, plaintext не попадает в хранилище', async () => {
    const generated = generateMcpDemoToken(NOW);
    const view = await rotateOwnMcpToken(db, anna, generated);
    expect(view).toEqual({ tokenPreview: generated.tokenPreview, createdAt: generated.createdAt });

    const row = await db.findSettingsByStudent('st-anna');
    expect(row?.mcpToken?.tokenHash).toBe(generated.tokenHash);
    expect(JSON.stringify(row)).not.toContain(generated.token);
    expect(await getOwnMcpTokenView(db, anna)).toEqual({
      tokenPreview: generated.tokenPreview,
      createdAt: generated.createdAt,
    });
  });

  it('resolve по валидному токенту даёт ctx владельца', async () => {
    const generated = generateMcpDemoToken(NOW);
    await rotateOwnMcpToken(db, anna, generated);
    const ctx = await resolveMcpDemoToken(db, generated.token);
    expect(ctx).not.toBeNull();
    expect(ctx!.studentId).toBe('st-anna');
    expect(ctx!.groupName).toBe('ПИ-21');
    expect(ctx!.role).toBe('STUDENT');
  });

  it('неверный/чужой/мусорный токен — null', async () => {
    const generated = generateMcpDemoToken(NOW);
    await rotateOwnMcpToken(db, anna, generated);

    expect(await resolveMcpDemoToken(db, 'demo-mcp-never-issued')).toBeNull();
    expect(await resolveMcpDemoToken(db, '')).toBeNull();
    expect(await resolveMcpDemoToken(db, `${generated.token} `)).toBeNull();
    expect(await resolveMcpDemoToken(db, 'x'.repeat(500))).toBeNull();
  });

  it('перевыпуск отзывает прежний токен', async () => {
    const first = generateMcpDemoToken(NOW);
    await rotateOwnMcpToken(db, anna, first);
    const second = generateMcpDemoToken(NOW);
    await rotateOwnMcpToken(db, anna, second);

    expect(await resolveMcpDemoToken(db, first.token)).toBeNull();
    expect((await resolveMcpDemoToken(db, second.token))?.studentId).toBe('st-anna');
  });

  it('токены разных студентов независимы: токен Анны не открывает данные Ильи', async () => {
    const forIlya = generateMcpDemoToken(NOW);
    await rotateOwnMcpToken(db, ilya, forIlya);
    const ctx = await resolveMcpDemoToken(db, forIlya.token);
    expect(ctx?.role).toBe('STUDENT');
    expect(ctx?.studentId ?? null).toBe('st-ilya');
    // Расписание и оценки под этим ctx — только Ильи.
    const studentId = ctx?.studentId;
    expect(studentId).not.toBeNull();
    const rows = await db.listGradesByStudent(studentId!);
    expect(rows.every((g) => g.studentId === 'st-ilya')).toBe(true);
  });

  it('staff не может выпустить токен: null + ROLE_MISMATCH в аудит', async () => {
    db.auditEvents().length = 0;
    const generated = generateMcpDemoToken(NOW);
    expect(await rotateOwnMcpToken(db, maria, generated)).toBeNull();
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
    expect(await getOwnMcpTokenView(db, maria)).toBeNull();
  });
});

// ── Нормализация настройки mcpToken ─────────────────────────────────────────

describe('нормализация mcpToken в настройках', () => {
  it('легаси-строка без поля читается: mcpToken = null', () => {
    const legacy: StoredStudentSettingsRow = {
      studentId: 'st-legacy',
      phone: null,
      emailVisibleToStaff: true,
      phoneVisibleToStaff: true,
      notificationChannels: defaultSettingsFor('st-legacy').notificationChannels,
      theme: 'SYSTEM',
      updatedAt: NOW,
    };
    expect(normalizeSettings(legacy)?.mcpToken).toBeNull();
  });

  it('мусор в поле отбрасывается, валидная запись сохраняется', () => {
    const valid = {
      tokenHash: 'a'.repeat(64),
      tokenPreview: 'demo-mcp…ab12',
      userId: 'auth-anna',
      createdAt: NOW,
    };
    const normalized = normalizeSettings({
      ...defaultSettingsFor('st-x'),
      mcpToken: valid,
    });
    expect(normalized?.mcpToken).toEqual(valid);

    for (const garbage of ['hack', {}, { tokenHash: 'short' }, null]) {
      const row = normalizeSettings({ ...defaultSettingsFor('st-x'), mcpToken: garbage as never });
      expect(row?.mcpToken).toBeNull();
    }
  });

  it('getOwnSettings выдаёт строку с mcpToken: null по умолчанию', async () => {
    const fresh = defaultSettingsFor('st-fresh');
    expect(fresh.mcpToken).toBeNull();
    expect((await getOwnSettings(db, anna))?.mcpToken).not.toBeNull();
  });
});

// ── Форматирование ответов инструментов ─────────────────────────────────────

describe('lib/mcp-format — расписание на сегодня', () => {
  it('заголовок с датой, пары по времени, счётчик', () => {
    const events = [
      mkEvent({
        id: 'e1',
        ...pairAt(11),
        disciplineName: 'Базы данных',
        kind: 'LAB',
        room: 'А-12',
      }),
      mkEvent({ id: 'e2', ...pairAt(9) }),
    ];
    const text = formatScheduleToday(events, NOW);
    expect(text).toContain('Расписание на сегодня');
    expect(text).toContain('Москва');
    expect(text.indexOf(formatMoscowTime(fromMoscowWallClock(2026, 11, 16, 9, 0)))).toBeLessThan(
      text.indexOf(formatMoscowTime(fromMoscowWallClock(2026, 11, 16, 11, 0))),
    );
    expect(text).toContain('Веб-разработка');
    expect(text).toContain('лекция');
    expect(text).toContain('Б-301');
    expect(text).toContain('Иванов А. Б.');
    expect(text).toContain('Базы данных');
    expect(text).toContain('лабораторная');
    expect(text).toContain('Пар сегодня: 2');
  });

  it('переносы и отмены помечены, причина попадает в текст', () => {
    const events = [
      mkEvent({
        id: 'moved',
        status: 'ROOM_CHANGED',
        previousRoom: 'Б-301',
        changeNote: 'Ремонт в аудитории',
        room: 'В-2',
        ...pairAt(9),
      }),
      mkEvent({
        id: 'moved-time',
        status: 'TIME_CHANGED',
        previousStartsAt: pairAt(11).startsAt,
        ...pairAt(13),
      }),
      mkEvent({ id: 'cancelled', status: 'CANCELLED', ...pairAt(15) }),
    ];
    const text = formatScheduleToday(events, NOW);
    expect(text).toContain('ОТМЕНЕНА');
    expect(text).toContain('В-2');
    expect(text).toContain('было: Б-301');
    expect(text).toContain('Ремонт в аудитории');
    expect(text).toContain('перенос времени');
    expect(text).toContain(formatMoscowTime(fromMoscowWallClock(2026, 11, 16, 11, 0)));
  });

  it('пустой день — честное «пар нет»', () => {
    const text = formatScheduleToday([], NOW);
    expect(text).toContain('Расписание на сегодня');
    expect(text).toContain('пар нет');
  });
});

describe('lib/mcp-format — оценки', () => {
  it('свежие оценки первыми, вес и дата, счётчик из общего числа', () => {
    const grades = [
      mkGrade({
        id: 'g-old',
        elementName: 'Реферат',
        gradedAt: fromMoscowWallClock(2026, 9, 20, 12, 0),
      }),
      mkGrade({
        id: 'g-new',
        elementName: 'Коллоквиум',
        score: 10,
        gradedAt: fromMoscowWallClock(2026, 11, 15, 18, 30),
      }),
    ];
    const text = formatGrades(grades);
    expect(text).toContain('оценки');
    expect(text.indexOf('Коллоквиум')).toBeLessThan(text.indexOf('Реферат'));
    expect(text).toContain('10 из 10');
    expect(text).toContain('20%');
    expect(text).toContain('15.11.2026');
    expect(text).toContain('2');
  });

  it('лимит 20 строк: показаны первые 20 из 25', () => {
    const grades = Array.from({ length: 25 }, (_, i) =>
      mkGrade({
        id: `g-${i}`,
        elementName: `Элемент ${i + 1}`,
        gradedAt: new Date(NOW.getTime() - i * 60_000),
      }),
    );
    const text = formatGrades(grades);
    expect(text).toContain('20 из 25');
    expect(text).toContain('Элемент 20');
    expect(text).not.toContain('Элемент 21');
  });

  it('без оценок — честный ответ', () => {
    expect(formatGrades([])).toContain('Оценок пока нет');
  });
});

describe('lib/mcp-format — непрочитанные', () => {
  it('только непрочитанные, свежие первыми, тип и время', () => {
    const rows = [
      mkNotification({
        id: 'r1',
        title: 'Старое',
        type: 'REQUEST',
        createdAt: fromMoscowWallClock(2026, 11, 10, 9, 0),
      }),
      mkNotification({
        id: 'r2',
        title: 'Свежее',
        type: 'SCHEDULE',
        createdAt: fromMoscowWallClock(2026, 11, 15, 21, 5),
      }),
      mkNotification({ id: 'r3', title: 'Прочитано', isRead: true }),
    ];
    const text = formatUnread(rows);
    expect(text).toContain('Непрочитанные');
    expect(text.indexOf('Свежее')).toBeLessThan(text.indexOf('Старое'));
    expect(text).toContain('Расписание');
    expect(text).toContain('Заявки');
    expect(text).not.toContain('Прочитано');
    expect(text).toContain('15.11 21:05');
    expect(text).toContain('2');
  });

  it('лимит 10 строк: 12 непрочитанных → показаны 10 из 12', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      mkNotification({
        id: `n-${i}`,
        title: `Уведомление ${i + 1}`,
        createdAt: new Date(NOW.getTime() - i * 60_000),
      }),
    );
    const text = formatUnread(rows);
    expect(text).toContain('10 из 12');
    expect(text).toContain('Уведомление 10');
    expect(text).not.toContain('Уведомление 11');
  });

  it('всё прочитано — честный ответ', () => {
    expect(formatUnread([])).toContain('Непрочитанных уведомлений нет');
  });
});
