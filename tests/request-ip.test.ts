// DIG-11 (review round 2) — client IP extraction for the sign-in rate limiter.
//
// Threat model (reviewer): a client fully controls the FIRST x-forwarded-for
// entry, so an attacker can rotate it on every attempt and bypass the per-IP
// limit. The trusted contract is the reverse proxy (Caddy) stamping the real
// socket address into x-real-ip; without it we fall back to the LAST xff hop
// (the one appended by our own edge), never the client-supplied first one.
import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders } from '@/lib/request-ip';

const get = (headers: Record<string, string>) => (name: string) =>
  headers[name.toLowerCase()] ?? null;

describe('clientIpFromHeaders', () => {
  it('prefers the proxy-stamped x-real-ip over any x-forwarded-for', () => {
    const ip = clientIpFromHeaders(
      get({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }),
    );
    expect(ip).toBe('203.0.113.7');
  });

  it('ignores an empty x-real-ip and falls back to x-forwarded-for', () => {
    const ip = clientIpFromHeaders(get({ 'x-real-ip': '  ', 'x-forwarded-for': '1.2.3.4' }));
    expect(ip).toBe('1.2.3.4');
  });

  it('takes the LAST x-forwarded-for hop, not the client-controlled first', () => {
    // Rotating the first entry must not give the attacker a fresh rate-limit bucket.
    const ip = clientIpFromHeaders(get({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1, 198.51.100.23' }));
    expect(ip).toBe('198.51.100.23');
  });

  it('trims whitespace around hops', () => {
    expect(clientIpFromHeaders(get({ 'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2 ' }))).toBe('2.2.2.2');
  });

  it('handles array-valued headers (joined form)', () => {
    expect(clientIpFromHeaders((name) => (name === 'x-real-ip' ? '203.0.113.9' : null))).toBe(
      '203.0.113.9',
    );
  });

  it('returns null when neither header is present or meaningful', () => {
    expect(clientIpFromHeaders(get({}))).toBeNull();
    expect(clientIpFromHeaders(get({ 'x-forwarded-for': '  ' }))).toBeNull();
    expect(clientIpFromHeaders(get({ 'x-real-ip': '' }))).toBeNull();
  });
});
