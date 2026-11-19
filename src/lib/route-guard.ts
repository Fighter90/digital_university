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
  // DIG-33: лендинг проверки подлинности /verify (ввод кода вручную).
  // Сама страница данных не читает — только форма перехода на /verify/<код>;
  // уровень доверия тот же, что у публичной страницы проверки.
  '/verify',
  // DIG-64: демо-MCP-сервер — публичный эндпоинт с собственной
  // аутентификацией по персональному Bearer-токену (не cookie) и собственным
  // rate limit'ом. CSRF-правило (same-origin Origin) на него не действует:
  // у запроса нет ambient-авторитета (cookie), внешний MCP-клиент работает
  // server-to-server без Origin; перебор токенов бессмысленно дорог
  // (192 бита энтропии) и ограничен лимитером роута.
  '/api/mcp',
  // DIG-63: живая ICS-подписка расписания — Google/Apple Calendar ходят
  // без cookies; доступ держится на HMAC-подписанном bearer-токене ссылки.
  '/api/calendar/ics',
  '/favicon.ico',
  // DIG-16: OG-превью и файловые конвенции Next (favicon/apple-icon/manifest)
  // — корневые маршруты для анонимных посетителей и внешних краулеров.
  '/og.jpg',
  '/icon.png',
  '/apple-icon.png',
  '/manifest.webmanifest',
]);
// DIG-47: /verify/<код> — публичная проверка подлинности справок (без входа);
// ключ — неугадываемый код проверки, перебор ограничен rate limit'ом страницы.
// DIG-16: бренд-ассеты (иллюстрации, иконки, OG, favicon-файл-конвенции)
// публичны — анонимный экран входа показывает hero-иллюстрацию и favicon,
// а OG-превью запрашивают внешние краулеры без сессии.
const PUBLIC_PREFIXES = [
  '/_next/',
  '/assets/',
  '/verify/',
  '/illustrations/',
  '/icons/',
  '/brand/',
];

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
 *
 * DIG-55: mutating requests (server actions) are excluded. A sign-out action
 * sets the CLEARED cookies on its POST response; the middleware re-issue of
 * `__Host-session` on the same response would compete with that cleared
 * cookie for the same name — RFC 6265 makes the LAST Set-Cookie win and the
 * order between the middleware and handler layers is not guaranteed, so the
 * logout could end up re-issuing a live cookie behind the action's back.
 * Page navigations are GET/HEAD and never clear auth cookies, so renewal
 * stays safe there.
 */
export function shouldSlideAuthCookies(
  decision: AccessDecision,
  hasSessionCookie: boolean,
  method: string = 'GET',
  isRouterPrefetch = false,
): boolean {
  const isReadNavigation = method === 'GET' || method === 'HEAD';
  // DIG-77: prefetch-ответы роутера приходят в неуправляемый момент — запрос,
  // отправленный ДО «Выйти», может применить своё Set-Cookie ПОСЛЕ сброса кук
  // sign-out action'ом и «воскресить» живую куку в браузере. Спекулятивный
  // prefetch куку не продлевает; настоящая навигация (документ или RSC-переход)
  // — продлевает, как и раньше.
  return decision.kind === 'allow' && hasSessionCookie && isReadNavigation && !isRouterPrefetch;
}

/**
 * DIG-55: cache policy per request path. Protected screens must never be
 * served from any cache — without an explicit `no-store` the browser may
 * restore the cabinet from the back/forward cache even after sign-out
 * (cookies cleared), so «Back» would reveal stale personal data. Public
 * paths keep the framework defaults (static assets keep their immutable
 * caching untouched).
 */
export const NO_STORE_CACHE_CONTROL = 'no-store, max-age=0, must-revalidate';

export function cacheControlFor(pathname: string): string | null {
  return isPublicPath(pathname) ? null : NO_STORE_CACHE_CONTROL;
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
 *  1. mutating API calls must be same-origin (CSRF defence for API routes),
 *     EXCEPT the Bearer-token MCP endpoint (see below);
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
  //
  //    DIG-64 exception — /api/mcp: аутентификация персональным Bearer-токеном,
  //    а не cookie, поэтому ambient-авторитета нет и CSRF невозможен; внешние
  //    MCP-клиенты (ChatGPT/Claude/curl) работают server-to-server без Origin.
  //    Перебор токенов ограничен rate limit'ом роута, данные скоуплены
  //    владельцем токена (см. src/app/api/mcp/route.ts).
  const method = input.method ?? 'GET';
  const isMcpEndpoint = pathname === '/api/mcp';
  if (pathname.startsWith('/api/') && !isMcpEndpoint && method !== 'GET' && method !== 'HEAD') {
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
    // DIG-48 (критерий приёмки): студент не может открыть ни один экран
    // сотрудника — ответ 403 (не redirect, чтобы URL /staff* не «притворялся»
    // доступным). Fail closed: нет/невалиден подписанный hint → тоже 403.
    // Аноним отсечён раньше (redirect на /login). Страницы /staff* всё равно
    // перепроверяют роль серверно — hint лишь быстрый edge-фильтр.
    if (input.roleHint?.role !== 'STAFF') return { kind: 'forbidden' };
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
