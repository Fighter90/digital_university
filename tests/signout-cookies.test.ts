// DIG-55 (раунд 3) — server-side контракт выхода, который браузерный e2e
// не видит напрямую: signOutCurrentSession / signOutAllDevices обязаны
//  1) удалить строку сессии из БД (по tokenHash — текущее устройство,
//     по userId — «со всех устройств»),
//  2) выставить ОБЕ куки в сбрасывающее состояние (value '', maxAge 0):
//     __Host-session и __Host-role — иначе на проде «Выйти» оставляет
//     живую сессию или role-подсказку для middleware.
// Границы (next/headers, auth store) замоканы; слой session.ts и
// конструкторы кук — реальные.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_COOKIE_NAME, type CookieSpec } from '@/server/auth/cookies';
import { ROLE_COOKIE_NAME } from '@/server/auth/role-cookie';
import { hashToken } from '@/server/auth/tokens';
import { signOutAllDevices, signOutCurrentSession } from '@/server/auth/session';

const TOKEN = 'dig55-live-session-token';

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  sets: [] as Array<Record<string, unknown>>,
  deleteSession: vi.fn(async () => 1),
  deleteAllUserSessions: vi.fn(async () => 2),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name) } : undefined),
    set: (spec: Record<string, unknown>) => {
      state.sets.push(spec);
    },
  }),
}));

vi.mock('@/server/auth/store', async () => {
  const { hashToken } = await import('@/server/auth/tokens');
  return {
    authStore: {
      findSessionByTokenHash: async (tokenHash: string) => {
        const cookieToken = state.jar.get('__Host-session');
        if (!cookieToken || tokenHash !== hashToken(cookieToken)) return null;
        return {
          user: {
            id: 'u-anna',
            login: 'anna.smirnova',
            passwordHash: 'argon2-hash',
            role: 'STUDENT',
            failedLogins: 0,
            lockedUntil: null,
          },
          // Свежая сессия (полный TTL впереди) — sliding-renewal не сработает.
          session: {
            id: 's-1',
            userId: 'u-anna',
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ip: null,
            userAgent: null,
            createdAt: null,
          },
        };
      },
      deleteSession: state.deleteSession,
      deleteAllUserSessions: state.deleteAllUserSessions,
    },
  };
});

const setCookies = (): CookieSpec[] => state.sets as unknown as CookieSpec[];

beforeEach(() => {
  state.jar.clear();
  // Живое состояние ДО выхода: обе куки присутствуют.
  state.jar.set('__Host-session', TOKEN);
  state.jar.set(ROLE_COOKIE_NAME, 'student-hint');
  state.sets.length = 0;
  state.deleteSession.mockClear();
  state.deleteAllUserSessions.mockClear();
});

describe('signOutCurrentSession («Выйти» на текущем устройстве)', () => {
  it('удаляет строку сессии из БД по tokenHash', async () => {
    await signOutCurrentSession();
    expect(state.deleteSession).toHaveBeenCalledTimes(1);
    expect(state.deleteSession).toHaveBeenCalledWith(hashToken(TOKEN), expect.any(Date));
  });

  it("сбрасывает обе куки: __Host-session и __Host-role (value '', maxAge 0)", async () => {
    await signOutCurrentSession();
    const specs = setCookies();

    const session = specs.find((spec) => spec.name === SESSION_COOKIE_NAME);
    expect(
      session,
      '__Host-session обязана быть выставлена в сбрасывающее состояние',
    ).toBeDefined();
    expect(session).toMatchObject({ value: '', maxAge: 0 });

    const role = specs.find((spec) => spec.name === ROLE_COOKIE_NAME);
    expect(role, '__Host-role обязана быть выставлена в сбрасывающее состояние').toBeDefined();
    expect(role).toMatchObject({ value: '', maxAge: 0 });
  });

  it('без куки сессии БД-удаления нет, но куки всё равно сбрасываются', async () => {
    state.jar.delete(SESSION_COOKIE_NAME);
    await signOutCurrentSession();
    expect(state.deleteSession).not.toHaveBeenCalled();
    const specs = setCookies();
    expect(specs.find((spec) => spec.name === SESSION_COOKIE_NAME)?.maxAge).toBe(0);
    expect(specs.find((spec) => spec.name === ROLE_COOKIE_NAME)?.maxAge).toBe(0);
  });
});

describe('signOutAllDevices («Выйти со всех устройств»)', () => {
  it('отзывает все сессии пользователя и сбрасывает обе куки', async () => {
    const revoked = await signOutAllDevices();
    expect(revoked).toBe(2);
    expect(state.deleteAllUserSessions).toHaveBeenCalledWith('u-anna', expect.any(Date));

    const specs = setCookies();
    expect(specs.find((spec) => spec.name === SESSION_COOKIE_NAME)?.maxAge).toBe(0);
    expect(specs.find((spec) => spec.name === ROLE_COOKIE_NAME)?.maxAge).toBe(0);
  });
});
