// DIG-11 — route protection middleware.
// - unauthenticated visitors cannot enter the cabinet screens → /login?next=…;
// - students cannot enter /staff (cheap HMAC-signed role hint; every staff
//   page re-verifies the role server-side via requireStaff());
// - mutating API calls must be same-origin (Origin check, CSRF defence).
// The pure decision logic lives in src/lib/route-guard.ts and is unit-tested.
import { NextResponse, type NextRequest } from 'next/server';
import { decideAccess } from '@/lib/route-guard';
import { SESSION_COOKIE_NAME } from '@/server/auth/cookies';
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

  if (decision.kind === 'allow') return NextResponse.next();
  if (decision.kind === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.redirect(new URL(decision.location, request.url));
}

export const config = {
  // Static assets are handled by the public-path rules as well; the matcher
  // just keeps them out of the middleware entirely.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
