// DIG-11 — access control contract: public/protected path routing,
// open-redirect-safe `next`, signed role hint cookie, and the pure
// middleware decision (cabinet gate, /staff role gate, API Origin check).
import { describe, expect, it } from 'vitest';
import {
  cacheControlFor,
  decideAccess,
  isPublicPath,
  NO_STORE_CACHE_CONTROL,
  safeNextPath,
  shouldSlideAuthCookies,
} from '@/lib/route-guard';
import { ROLE_COOKIE_NAME, signRoleHint, verifyRoleHint } from '@/server/auth/role-cookie';

const SECRET = 'test-secret-for-hmac';
const OK = { kind: 'allow' } as const;

describe('route guard: public vs protected paths', () => {
  it.each([
    ['/', true],
    ['/login', true],
    ['/forgot-password', true], // DIG-18: stub screen «Забыли пароль?» остаётся публичным
    ['/login?next=%2F', true],
    ['/api/health', true],
    ['/api/calendar/ics', true], // DIG-63: ICS-подписка по персональному токену (календарные клиенты без кук)
    ['/verify/ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777', true], // DIG-47: публичная проверка справок
    ['/verify/abc', true],
    ['/verify', true], // DIG-33: лендинг проверки (ввод кода вручную) без данных
    ['/api/mcp', true], // DIG-64: демо-MCP-сервер — Bearer-токен вместо cookie-сессии
    ['/dashboard', false],
    ['/dashboard/sub', false],
    ['/staff', false],
    ['/requests/42', false],
  ])('isPublicPath(%s) → %s', (path, expected) => {
    expect(isPublicPath(new URL(`http://x${path}`).pathname)).toBe(expected);
  });
});

describe('safeNextPath blocks open redirects', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/login?x=1', '/login?x=1'],
    ['//evil.com', null],
    ['/\\evil.com', null],
    ['https://evil.com', null],
    ['http://evil.com', null],
    ['dashboard', null],
    ['', null],
    [undefined, null],
    [null, null],
  ])('safeNextPath(%s) → %s', (input, expected) => {
    expect(safeNextPath(input as string | null | undefined)).toBe(expected);
  });
});

describe('signed role hint cookie', () => {
  it('round-trips role and userId', async () => {
    const value = await signRoleHint('STAFF', 'u1', SECRET);
    expect(await verifyRoleHint(value, SECRET)).toEqual({ role: 'STAFF', userId: 'u1' });
    expect(ROLE_COOKIE_NAME).toBe('__Host-role');
  });

  it('rejects tampering, wrong secret and missing cookie', async () => {
    const value = await signRoleHint('STAFF', 'u1', SECRET);
    const forged = value.replace('STAFF', 'STAFFx');
    expect(await verifyRoleHint(forged, SECRET)).toBeNull();
    expect(await verifyRoleHint(value, 'another-secret')).toBeNull();
    expect(await verifyRoleHint(undefined, SECRET)).toBeNull();
    expect(await verifyRoleHint('garbage', SECRET)).toBeNull();
  });
});

describe('middleware decision (decideAccess)', () => {
  const signed = (role: 'STUDENT' | 'STAFF', userId = 'u1') => ({
    hasSessionCookie: true,
    roleHint: { role, userId },
  });

  it('unauthenticated access to the cabinet redirects to /login with next', () => {
    const decision = decideAccess({
      pathname: '/dashboard',
      search: '',
      hasSessionCookie: false,
      roleHint: null,
    });
    expect(decision).toEqual({ kind: 'redirect', location: '/login?next=%2Fdashboard' });
  });

  it('keeps public paths open for everyone', () => {
    for (const pathname of ['/', '/login', '/api/health']) {
      expect(
        decideAccess({ pathname, search: '', hasSessionCookie: false, roleHint: null }),
      ).toEqual(OK);
      expect(decideAccess({ pathname, search: '', ...signed('STUDENT') })).toEqual(OK);
    }
  });

  it('authenticated user reaches the cabinet; student is barred from /staff', () => {
    expect(decideAccess({ pathname: '/dashboard', search: '', ...signed('STUDENT') })).toEqual(OK);
    const blocked = decideAccess({ pathname: '/staff', search: '', ...signed('STUDENT') });
    expect(blocked).toEqual({ kind: 'redirect', location: '/dashboard' });
    expect(
      decideAccess({ pathname: '/staff/requests', search: '?x=1', ...signed('STAFF') }),
    ).toEqual(OK);
    // Missing/invalid hint must fail closed: treated as student.
    const noHint = decideAccess({
      pathname: '/staff',
      search: '',
      hasSessionCookie: true,
      roleHint: null,
    });
    expect(noHint).toEqual({ kind: 'redirect', location: '/dashboard' });
  });

  it('API mutations require a same-origin header; GET is exempt', () => {
    const post = (originHeader?: string) =>
      decideAccess({
        pathname: '/api/requests',
        search: '',
        method: 'POST',
        hostHeader: 'ostrovok.store',
        originHeader,
        hasSessionCookie: true,
        roleHint: { role: 'STUDENT', userId: 'u1' },
      });

    expect(post('https://ostrovok.store')).toEqual(OK);
    // Fail closed (review round 2): a mutating API call without Origin (curl,
    // server-to-server) is rejected — browsers always send Origin on POSTs,
    // so legit usage is unaffected and spoofing the absence is impossible.
    expect(post()).toEqual({ kind: 'forbidden' });
    expect(post('https://evil.example')).toEqual({ kind: 'forbidden' });
    expect(post('http://ostrovok.store')).toEqual({ kind: 'forbidden' }); // scheme downgrade

    // DIG-64: /api/mcp — исключение из CSRF-правила (осознанное): эндпоинт
    // аутентифицируется Bearer-токеном, а не cookie, поэтому ambient-авторитет
    // отсутствует и CSRF невозможен; внешние MCP-клиенты (ChatGPT/Claude/curl)
    // — server-to-server без Origin. Перебор токенов ограничен rate limit'ом
    // самого роута, данные скоуплены владельцем токена.
    expect(
      decideAccess({
        pathname: '/api/mcp',
        search: '',
        method: 'POST',
        hostHeader: 'ostrovok.store',
        originHeader: null, // curl / MCP-клиент — без Origin
        hasSessionCookie: false,
        roleHint: null,
      }),
    ).toEqual(OK);
    expect(
      decideAccess({
        pathname: '/api/mcp',
        search: '',
        method: 'POST',
        hostHeader: 'ostrovok.store',
        originHeader: 'https://evil.example', // даже кросс-доменный — аутентификация по токену
        hasSessionCookie: false,
        roleHint: null,
      }),
    ).toEqual(OK);

    expect(
      decideAccess({
        pathname: '/api/health',
        search: '',
        method: 'GET',
        hostHeader: 'ostrovok.store',
        originHeader: 'https://evil.example',
        hasSessionCookie: false,
        roleHint: null,
      }),
    ).toEqual(OK);
  });

  it('redirect keeps the original query string in next', () => {
    const decision = decideAccess({
      pathname: '/schedule',
      search: '?week=next',
      hasSessionCookie: false,
      roleHint: null,
    });
    expect(decision).toEqual({
      kind: 'redirect',
      location: `/login?next=${encodeURIComponent('/schedule?week=next')}`,
    });
    expect(safeNextPath('/schedule?week=next')).toBe('/schedule?week=next');
  });
});

// Review round 3: «скользящее продление» must reach the browser. The DB row
// was renewed by resolveSession, but the cookies were issued once at login
// with a fixed 7-day Max-Age, so an active user was still hard-logged-out
// after 7 days — and an active STAFF member lost the /staff middleware gate
// when the role hint expired. The middleware now re-issues both cookies on
// every allowed request of a cookie-bearing browser; this pure helper pins
// WHEN that happens.
describe('sliding cookie renewal decision (review round 3)', () => {
  it('slides on an allowed request that carries the session cookie', () => {
    expect(shouldSlideAuthCookies({ kind: 'allow' }, true)).toBe(true);
  });

  it.each([
    [
      'anonymous redirect',
      { kind: 'redirect', location: '/login?next=%2Fdashboard' } as const,
      false,
    ],
    ['student bounced off /staff', { kind: 'redirect', location: '/dashboard' } as const, true],
    ['CSRF-forbidden API mutation', { kind: 'forbidden' } as const, true],
  ])('does not slide on %s', (_name, decision, hasSessionCookie) => {
    expect(shouldSlideAuthCookies(decision, hasSessionCookie)).toBe(false);
  });

  it('does not slide without a session cookie (nothing to renew)', () => {
    expect(shouldSlideAuthCookies({ kind: 'allow' }, false)).toBe(false);
  });

  // DIG-55: server actions (logout!) выставляют/очищают куки на ответе POST.
  // Слепое переиздание `__Host-session` в middleware на том же ответе
  // конкурирует с кукой-очисткой (побеждает последний Set-Cookie, порядок
  // между слоями не гарантирован). Мутирующие запросы не продлевают куки:
  // переходы страниц — GET/HEAD, они куки никогда не очищают.
  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])(
    'does not slide on a mutating %s request (server actions clear cookies — DIG-55)',
    (method) => {
      expect(shouldSlideAuthCookies({ kind: 'allow' }, true, method)).toBe(false);
    },
  );

  it.each(['GET', 'HEAD'])('still slides on plain %s navigations (DIG-55)', (method) => {
    expect(shouldSlideAuthCookies({ kind: 'allow' }, true, method)).toBe(true);
  });

  it('defaults to GET when the method is not provided (backwards compatible)', () => {
    expect(shouldSlideAuthCookies({ kind: 'allow' }, true)).toBe(true);
  });
});

// DIG-55: «Назад» после выхода не должен показывать кабинет из кэша
// (bfcache/дисковый кэш). Защищённые страницы отдаются с явным no-store,
// публичные пути сохраняют дефолты фреймворка (статику это не трогает).
describe('cache-control for protected screens (DIG-55)', () => {
  it.each([
    '/dashboard',
    '/schedule',
    '/requests/SR-2026-ABC12',
    '/grades/semester/3',
    '/profile',
    '/staff/requests',
  ])('protected %s → no-store', (pathname) => {
    expect(cacheControlFor(pathname)).toBe(NO_STORE_CACHE_CONTROL);
    expect(NO_STORE_CACHE_CONTROL).toContain('no-store');
  });

  it.each([
    '/',
    '/login',
    '/forgot-password',
    '/api/health',
    '/_next/static/chunk.js',
    '/verify/x',
  ])('public %s keeps the framework default (no explicit header)', (pathname) => {
    expect(cacheControlFor(pathname)).toBeNull();
  });
});
