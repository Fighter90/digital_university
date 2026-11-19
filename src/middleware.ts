// DIG-11 — route protection middleware.
// - unauthenticated visitors cannot enter the cabinet screens → /login?next=…;
// - students cannot enter /staff: DIG-48 answers HTTP 403 (cheap HMAC-signed
//   role hint; every staff page re-verifies the role server-side);
// - mutating API calls must be same-origin (Origin check, CSRF defence).
// The pure decision logic lives in src/lib/route-guard.ts and is unit-tested.
import { NextResponse, type NextRequest } from 'next/server';
import { cacheControlFor, decideAccess, shouldSlideAuthCookies } from '@/lib/route-guard';
import {
  SESSION_COOKIE_NAME,
  buildRoleHintCookie,
  buildSessionCookie,
} from '@/server/auth/cookies';
import { ROLE_COOKIE_NAME, verifyRoleHint } from '@/server/auth/role-cookie';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;

  // Without a secret we cannot validate the hint → fail closed (treated as student).
  const roleHint =
    sessionToken && secret
      ? await verifyRoleHint(request.cookies.get(ROLE_COOKIE_NAME)?.value, secret)
      : null;

  const decision = decideAccess({
    pathname,
    search,
    method: request.method,
    originHeader: request.headers.get('origin'),
    hostHeader: request.headers.get('host'),
    hasSessionCookie: Boolean(sessionToken),
    roleHint,
  });

  if (decision.kind === 'allow') {
    const response = NextResponse.next();

    // DIG-55: protected screens must never come from a cache. Without an
    // explicit no-store the browser could restore the cabinet from the
    // back/forward cache even after sign-out, so «Back» revealed stale
    // personal data. Public paths keep the framework defaults.
    const cacheControl = cacheControlFor(pathname);
    if (cacheControl) response.headers.set('Cache-Control', cacheControl);

    // Review round 3: sliding renewal must reach the browser. While the user
    // stays active, both cookies are re-issued on every allowed request with
    // the SAME values and a fresh full Max-Age; the store-side half of the
    // sliding policy lives in resolveSession (session-policy.ts). Without
    // this, the browser deleted the cookies 7 days after sign-in no matter
    // how active the user was — and staff lost the /staff gate with them.
    // The values are never changed here (no new tokens, no new authority):
    // a cookie that just failed verification is never extended.
    //
    // DIG-55: the request method is forwarded so mutating requests (server
    // actions — including sign-out) never re-issue the cookies: the action's
    // cleared cookies must be the only word on that response.
    //
    // DIG-77: router prefetches (`Next-Router-Prefetch: 1`) are excluded from
    // the renewal as well. A prefetch fired a moment BEFORE «Выйти» can have
    // its response applied AFTER the action's cleared Set-Cookie — the slide
    // would then resurrect a live-looking `__Host-session` in the jar (e2e
    // auth.spec flake: cookie survived sign-out with a fresh 7-day Max-Age).
    // A speculative response landing at an arbitrary time must not write the
    // auth cookies; real document/RSC navigations keep renewing as before.
    const isRouterPrefetch = Boolean(request.headers.get('next-router-prefetch'));
    if (sessionToken && shouldSlideAuthCookies(decision, true, request.method, isRouterPrefetch)) {
      response.cookies.set(buildSessionCookie(sessionToken));
      const hintValue = request.cookies.get(ROLE_COOKIE_NAME)?.value;
      if (roleHint && hintValue) response.cookies.set(buildRoleHintCookie(hintValue));
    }

    return response;
  }
  if (decision.kind === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.redirect(new URL(decision.location, request.url));
}

export const config = {
  // Static assets are handled by the public-path rules as well; the matcher
  // just keeps them out of the middleware entirely (DIG-16: бренд-ассеты,
  // OG-превью и файловые конвенции иконок/манифеста — публичные, см.
  // PUBLIC_PREFIXES/PUBLIC_EXACT_PATHS в route-guard).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|illustrations/|icons/|brand/|og.jpg|icon.png|apple-icon.png|manifest.webmanifest).*)',
  ],
};
