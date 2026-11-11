// DIG-11 (review round 2) — trusted client-IP extraction for rate limiting.
//
// A client fully controls the FIRST `x-forwarded-for` entry, so keying the
// brute-force limiter on it lets an attacker rotate IPs and bypass the limit.
// Deployment contract (documented in docs/security.md): the reverse proxy
// (Caddy, deploy/) stamps the real socket address into `x-real-ip`
// (`header_up X-Real-IP {remote_host}`); it is preferred when present.
// Fallback: the LAST `x-forwarded-for` hop — the one appended by our own edge
// proxy — never the client-supplied first entry.
//
// Pure and context-free so tests/request-ip.test.ts can pin the behaviour.

type HeaderGetter = (name: string) => string | null;

export function clientIpFromHeaders(getHeader: HeaderGetter): string | null {
  const realIp = (getHeader('x-real-ip') ?? '').trim();
  if (realIp) return realIp;

  const forwarded = getHeader('x-forwarded-for');
  if (!forwarded) return null;
  const hops = forwarded
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops.length > 0 ? (hops[hops.length - 1] ?? null) : null;
}
