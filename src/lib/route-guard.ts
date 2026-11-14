// DIG-11 — pure access-control decisions shared by src/middleware.ts.
// Kept free of next/* imports so unit tests (tests/access-control.test.ts)
// can pin the behaviour without a request context.

export type Role = 'STUDENT' | 'STAFF';

export type AccessDecision =
  { kind: 'allow' } | { kind: 'redirect'; location: string } | { kind: 'forbidden' };

/** Landing and login (+ its «Забыли пароль?» stub) are open; health API must stay reachable for monitoring. */
const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/login',
  '/forgot-password',
  '/api/health',
  '/favicon.ico',
]);
// DIG-47: /verify/<код> — публичная проверка подлинности справок (без входа);
// ключ — неугадываемый код проверки, перебор ограничен rate limit'ом страницы.
const PUBLIC_PREFIXES = ['/_next/', '/assets/', '/verify/'];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

const STAFF_PREFIX = '/staff';

/**
 * `?next=` can only point inside the app: a single leading slash, no protocol
 * and no `//` scheme trick (open-redirect guard, see DIG-18).
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

/**
 * Review round 3: should the middleware re-issue the auth cookies (same
 * values, fresh full Max-Age)? Sliding renewal previously extended only the
 * store row (resolveSession → touchSession), while the cookies expired a
 * fixed 7 days after sign-in — an active user was still hard-logged-out,
 * and an active STAFF member lost the /staff middleware gate when the role
 * hint expired. True sliding therefore needs BOTH sides: the store row
 * (session-policy.ts) and the browser cookies (middleware re-issue).
 * Only a plain `allow` for a cookie-bearing browser qualifies: redirects
 * and CSRF rejections end the exchange, and without a session cookie there
 * is nothing to renew.
 */
export function shouldSlideAuthCookies(
  decision: AccessDecision,
  hasSessionCookie: boolean,
): boolean {
  return decision.kind === 'allow' && hasSessionCookie;
}

export interface AccessInput {
  pathname: string;
  search?: string;
  method?: string;
  originHeader?: string | null;
  hostHeader?: string | null;
  hasSessionCookie: boolean;
  roleHint: { role: Role; userId: string } | null;
}

/**
 * Order of checks:
 *  1. mutating API calls must be same-origin (CSRF defence for API routes);
 *  2. public paths stay open;
 *  3. everything else requires the session cookie → /login?next=…;
 *  4. /staff additionally requires the STAFF role (signed hint; the page
 *     re-verifies the role against the DB via requireStaff()).
 */
export function decideAccess(input: AccessInput): AccessDecision {
  const { pathname, search = '' } = input;

  // 1) CSRF for API routes: any non-GET API call must be same-origin — the
  //    Origin header is required and must match Host (fail closed: a mutating
  //    API request without Origin is rejected, browsers always send it on
  //    cross-origin and fetch/form POSTs; see docs/security.md).
  const method = input.method ?? 'GET';
  if (pathname.startsWith('/api/') && method !== 'GET' && method !== 'HEAD') {
    const origin = input.originHeader;
    if (!origin || !isTrustedOrigin(origin, input.hostHeader ?? null)) {
      return { kind: 'forbidden' };
    }
  }

  if (isPublicPath(pathname)) return { kind: 'allow' };

  if (!input.hasSessionCookie) {
    const next = encodeURIComponent(`${pathname}${search}`);
    return { kind: 'redirect', location: `/login?next=${next}` };
  }

  if (pathname === STAFF_PREFIX || pathname.startsWith(`${STAFF_PREFIX}/`)) {
    if (input.roleHint?.role !== 'STAFF') return { kind: 'redirect', location: '/dashboard' };
  }

  return { kind: 'allow' };
}

function isTrustedOrigin(origin: string, hostHeader: string | null): boolean {
  try {
    const url = new URL(origin);
    const localHttp =
      url.protocol === 'http:' && ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
    const httpsOrigin = url.protocol === 'https:';
    if (!httpsOrigin && !localHttp) return false;
    return hostHeader !== null && url.host === hostHeader;
  } catch {
    return false;
  }
}
