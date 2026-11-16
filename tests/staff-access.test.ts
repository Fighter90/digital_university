// DIG-48 — 403 для студента на экранах сотрудника (критерий приёмки):
// middleware отвечает forbidden на любой /staff* путь, если подписанный
// role-hint не STAFF (студент ИЛИ отсутствующий/поддельный hint — fail
// closed). Страницы дополнительно перепроверяют роль серверно, API —
// единым 404 с аудитом (контракт DIG-12). Чистые решения — route-guard.
import { describe, expect, it } from 'vitest';
import { decideAccess } from '@/lib/route-guard';

const withSession = (role: 'STUDENT' | 'STAFF', userId = 'u1') => ({
  hasSessionCookie: true,
  roleHint: { role, userId },
});

describe('DIG-48: студент не может открыть ни один экран сотрудника', () => {
  it.each([
    ['/staff'],
    ['/staff/'],
    ['/staff/requests'],
    ['/staff/requests/SR-2026-A1B2C'],
    ['/staff/appeals/apl-anna-1'],
    ['/staff/announcements'],
  ])('GET %s со студенческим hint → 403 (forbidden), не redirect', (pathname) => {
    expect(decideAccess({ pathname, search: '', ...withSession('STUDENT') })).toEqual({
      kind: 'forbidden',
    });
  });

  it('поддельный/отсутствующий hint — fail closed: тоже 403', () => {
    expect(
      decideAccess({ pathname: '/staff', search: '', hasSessionCookie: true, roleHint: null }),
    ).toEqual({ kind: 'forbidden' });
  });

  it('аноним по-прежнему попадает на /login?next=… (кабинет закрыт, но вход возможен)', () => {
    expect(
      decideAccess({
        pathname: '/staff/requests',
        search: '',
        hasSessionCookie: false,
        roleHint: null,
      }),
    ).toEqual({ kind: 'redirect', location: '/login?next=%2Fstaff%2Frequests' });
  });

  it('сотрудник проходит на все экраны /staff*', () => {
    for (const pathname of [
      '/staff',
      '/staff/requests',
      '/staff/appeals',
      '/staff/announcements',
    ]) {
      expect(decideAccess({ pathname, search: '', ...withSession('STAFF') })).toEqual({
        kind: 'allow',
      });
    }
  });

  it('студентские пути не затронуты: /dashboard открыт студенту', () => {
    expect(decideAccess({ pathname: '/dashboard', search: '', ...withSession('STUDENT') })).toEqual(
      {
        kind: 'allow',
      },
    );
  });
});
