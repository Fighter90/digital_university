// DIG-35 — серверные обёртки ленты (src/server/notifications.ts):
// getUnreadCount и getNotificationFeed обязаны быть fail-soft — без сессии,
// без строки профиля и у сотрудника возвращают 0/пусто вместо падения или
// редиректа (каркас кабинета вызывает их на КАЖДОЙ странице).
// Сотрудник не должен даже попадать в listNotifications (без аудит-шума).
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Хранители состояния вместо spyOn на ESM-namespace: doMock фиксирует
// замыкание на момент регистрации.
const authState: { user: unknown | null } = { user: null };
const dataState: {
  ctx: unknown | null;
  unread: number;
  rows: Array<{ id: string; isRead: boolean; createdAt: Date }>;
} = { ctx: null, unread: 0, rows: [] };

vi.doMock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => (authState.user ? { user: authState.user } : null)),
}));

vi.doMock('@/server/data', () => ({
  toDataCtx: vi.fn(async () => dataState.ctx),
  countUnreadNotifications: vi.fn(async () => dataState.unread),
  listNotifications: vi.fn(async () => dataState.rows.map((r) => ({ ...r }))),
}));

const { getUnreadCount, getNotificationFeed } = await import('@/server/notifications');
const dataModule = await import('@/server/data');

const studentCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};
const staffCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

describe('getUnreadCount — fail-soft и реальное значение', () => {
  it('аноним — 0', async () => {
    authState.user = null;
    await expect(getUnreadCount()).resolves.toBe(0);
  });

  it('сессия без строки профиля (toDataCtx → null) — 0, не падает', async () => {
    authState.user = { id: 'u-x', login: 'ghost', role: 'STUDENT' };
    dataState.ctx = null;
    await expect(getUnreadCount()).resolves.toBe(0);
    await expect(getNotificationFeed(5)).resolves.toEqual({ count: 0, items: [] });
  });

  it('сотрудник — 0 и лента не запрашивается вовсе (без аудит-шума)', async () => {
    authState.user = { id: 'auth-dean', login: 'dean.kovaleva', role: 'STAFF' };
    dataState.ctx = staffCtx;
    await expect(getUnreadCount()).resolves.toBe(0);
    await expect(getNotificationFeed(5)).resolves.toEqual({ count: 0, items: [] });
    expect(vi.mocked(dataModule.listNotifications)).not.toHaveBeenCalled();
  });

  it('студент — реальный счётчик из слоя данных (не демо-константа)', async () => {
    authState.user = { id: 'auth-anna', login: 'anna.smirnova', role: 'STUDENT' };
    dataState.ctx = studentCtx;
    dataState.unread = 3;
    await expect(getUnreadCount()).resolves.toBe(3);
  });
});

describe('getNotificationFeed — топ свежих для панели', () => {
  beforeEach(() => {
    authState.user = { id: 'auth-anna', login: 'anna.smirnova', role: 'STUDENT' };
    dataState.ctx = studentCtx;
    dataState.unread = 3;
    dataState.rows = [
      { id: 'n1', isRead: false, createdAt: new Date(2026, 10, 11, 8, 5) },
      { id: 'n2', isRead: false, createdAt: new Date(2026, 10, 11, 10, 40) },
      { id: 'n3', isRead: true, createdAt: new Date(2026, 10, 10, 18, 0) },
    ];
  });

  it('возвращает limit самых свежих и общий счётчик непрочитанных', async () => {
    const feed = await getNotificationFeed(2);
    expect(feed.count).toBe(2); // непрочитанных в ленте
    expect(feed.items.map((i: { id: string }) => i.id)).toEqual(['n2', 'n1']); // новые первыми
  });

  it('сериализует createdAt в ISO-строку (клиентские пропсы и JSON)', async () => {
    const feed = await getNotificationFeed(5);
    expect(feed.items[0].createdAt).toBe(new Date(2026, 10, 11, 10, 40).toISOString());
  });
});

afterAll(async () => {
  vi.doUnmock('@/server/data');
  vi.doUnmock('@/server/auth/session');
  vi.resetModules();
});
