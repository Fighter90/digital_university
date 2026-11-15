// DIG-58 — «Настройка MCP»: чистый каталог серверов + mutator data-слоя.
//
// Контракт: каталог содержит три демо-сервера (Product Hunt, Календарь,
// Деканат-API) с ВЫМЫШЛЕННЫМИ токенами/deep-ссылками; normalize заполняет
// полный список по каталогу (старые строки без поля читаются без падения);
// updateOwnMcpConnection пишет ТОЛЬКО владельцу ctx (staff — ROLE_MISMATCH
// в аудит), неизвестный id отклоняется без записи.
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import {
  DEFAULT_MCP_CONNECTIONS,
  MCP_SERVERS,
  normalizeMcpConnections,
  setMcpConnected,
  isMcpServerId,
  findMcpServer,
} from '@/lib/mcp-servers';
import {
  defaultSettingsFor,
  getOwnSettings,
  normalizeSettings,
  updateOwnMcpConnection,
} from '@/server/data/profile';
import type { DataCtx, StoredStudentSettingsRow } from '@/server/data/types';

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx; // staff

beforeAll(async () => {
  db = createMemoryDataDb();
  db.seed({
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
  });
  anna = (await toDataCtx({ id: 'auth-anna', login: 'anna', role: 'STUDENT' }, db))!;
  ilya = (await toDataCtx({ id: 'auth-ilya', login: 'ilya', role: 'STUDENT' }, db))!;
  maria = (await toDataCtx({ id: 'auth-maria', login: 'maria', role: 'STAFF' }, db))!;
});

const lastAudit = () => db.auditEvents().at(-1);
async function mustSettings(ctx: DataCtx) {
  const settings = await getOwnSettings(db, ctx);
  expect(settings).not.toBeNull();
  return settings!;
}

describe('lib/mcp-servers — демо-каталог (DIG-58)', () => {
  it('каталог содержит ровно три демо-сервера с обязательными полями', () => {
    expect(MCP_SERVERS.map((s) => s.id)).toEqual(['producthunt', 'calendar', 'deanery-api']);
    for (const server of MCP_SERVERS) {
      expect(server.name.length).toBeGreaterThan(0);
      // Карточка-пример: что даёт сервер, минимум одно преимущество.
      expect(server.benefits.length).toBeGreaterThan(0);
      // Токен вымышленный: префикс demo-, реальных ключей нет.
      expect(server.demoToken).toMatch(/^demo-/);
      // Deep-ссылка — фиктивная схема демо-прототипа, не реальный домен.
      expect(server.deepLink).toMatch(/^unidemo:\/\//);
    }
  });

  it('токены фиктивны и не похожи на настоящие секреты (длинных случайных строк нет)', () => {
    for (const server of MCP_SERVERS) {
      expect(server.demoToken.length).toBeLessThan(48);
      expect(server.demoToken).toContain('demo');
    }
  });

  it('isMcpServerId / findMcpServer — whitelist по каталогу', () => {
    expect(isMcpServerId('calendar')).toBe(true);
    expect(isMcpServerId('slack')).toBe(false);
    expect(isMcpServerId(undefined)).toBe(false);
    expect(findMcpServer('deanery-api')?.name.length).toBeGreaterThan(0);
    expect(findMcpServer('nope')).toBeNull();
  });

  it('DEFAULT_MCP_CONNECTIONS — все отключены; setMcpConnected иммутабелен', () => {
    expect(DEFAULT_MCP_CONNECTIONS.every((s) => !s.connected)).toBe(true);
    const next = setMcpConnected(DEFAULT_MCP_CONNECTIONS, 'producthunt', true);
    expect(next.find((s) => s.id === 'producthunt')?.connected).toBe(true);
    expect(DEFAULT_MCP_CONNECTIONS.find((s) => s.id === 'producthunt')?.connected).toBe(false);
    // Неизвестный id не создаёт строку.
    expect(setMcpConnected(DEFAULT_MCP_CONNECTIONS, 'slack' as 'calendar', true)).toHaveLength(3);
  });

  it('normalizeMcpConnections восстанавливает полный список и отбрасывает мусор', () => {
    const normalized = normalizeMcpConnections([
      { id: 'calendar', connected: true },
      { id: 'slack', connected: true },
      { id: 'producthunt' },
    ]);
    expect(normalized.map((s) => s.id)).toEqual(['producthunt', 'calendar', 'deanery-api']);
    expect(normalized.find((s) => s.id === 'calendar')?.connected).toBe(true);
    expect(normalized.find((s) => s.id === 'producthunt')?.connected).toBe(false);
    expect(normalized.find((s) => s.id === 'deanery-api')?.connected).toBe(false);
    // undefined / мусор → дефолт (всё отключено).
    expect(normalizeMcpConnections(undefined)).toEqual(DEFAULT_MCP_CONNECTIONS);
    expect(normalizeMcpConnections('hack')).toEqual(DEFAULT_MCP_CONNECTIONS);
  });

  it('defaultSettingsFor выдаёт свежие объекты без общих ссылок (mcpConnections в том числе)', () => {
    const a = defaultSettingsFor('st-x');
    const b = defaultSettingsFor('st-x');
    expect(a.mcpConnections).toEqual(b.mcpConnections);
    expect(a.mcpConnections).not.toBe(b.mcpConnections);
  });
});

describe('updateOwnMcpConnection — демо-хранилище и IDOR', () => {
  it('подключение сохраняется в настройках владельца и переживает перечитывание', async () => {
    const saved = await updateOwnMcpConnection(db, anna, 'producthunt', true);
    expect(saved?.mcpConnections.find((s) => s.id === 'producthunt')?.connected).toBe(true);
    expect((await mustSettings(anna)).mcpConnections).toEqual(saved!.mcpConnections);
  });

  it('мутация скоуплена студентом: настройки другого студента не тронуты', async () => {
    await updateOwnMcpConnection(db, anna, 'calendar', true);
    expect((await mustSettings(ilya)).mcpConnections.every((s) => !s.connected)).toBe(true);
  });

  it('отключение снимает статус', async () => {
    await updateOwnMcpConnection(db, anna, 'calendar', false);
    expect(
      (await mustSettings(anna)).mcpConnections.find((s) => s.id === 'calendar')?.connected,
    ).toBe(false);
  });

  it('неизвестный id отклоняется (мутатор возвращает null, ничего не пишется)', async () => {
    const before = (await mustSettings(anna)).mcpConnections;
    expect(await updateOwnMcpConnection(db, anna, 'slack', true)).toBeNull();
    expect((await mustSettings(anna)).mcpConnections).toEqual(before);
  });

  it('staff ctx получает null и ROLE_MISMATCH в аудит', async () => {
    db.auditEvents().length = 0;
    expect(await updateOwnMcpConnection(db, maria, 'producthunt', true)).toBeNull();
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
    expect(
      (await mustSettings(anna)).mcpConnections.find((s) => s.id === 'producthunt')?.connected,
    ).toBe(true);
  });
});

describe('нормализация строк без mcpConnections (легаси до DIG-58)', () => {
  it('строка до DIG-58 читается без падения: поле дозаполняется дефолтом', () => {
    const legacy: StoredStudentSettingsRow = {
      studentId: 'st-legacy',
      phone: null,
      emailVisibleToStaff: true,
      phoneVisibleToStaff: true,
      notificationChannels: defaultSettingsFor('st-legacy').notificationChannels,
      theme: 'SYSTEM',
      updatedAt: new Date(),
    };
    const normalized = normalizeSettings(legacy)!;
    expect(normalized.mcpConnections).toEqual(DEFAULT_MCP_CONNECTIONS);
    expect(normalizeSettings(undefined)).toBeNull();
  });

  it('строка с частичным списком дозаполняется по каталогу', () => {
    const partial = defaultSettingsFor('st-x');
    // Симулируем хранение неполного списка.
    const stored = { ...partial, mcpConnections: [{ id: 'calendar', connected: true }] } as never;
    const normalized = normalizeSettings(stored)!;
    expect(normalized.mcpConnections.map((s) => s.id)).toEqual([
      'producthunt',
      'calendar',
      'deanery-api',
    ]);
    expect(normalized.mcpConnections.find((s) => s.id === 'calendar')?.connected).toBe(true);
  });
});
