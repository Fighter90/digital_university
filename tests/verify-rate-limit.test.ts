// DIG-47 — rate limit публичной страницы проверки справок (перебор кодов).
// Скользящее окно по ключу (IP), контракт как у входа в систему (DIG-11).
import { describe, expect, it } from 'vitest';

import {
  VERIFY_RATE_MAX_ATTEMPTS,
  VERIFY_RATE_WINDOW_MS,
  createVerifyRateLimiter,
} from '@/server/verify/rate-limit';

describe('verify rate limit: константы', () => {
  it('окно и предел разумны для публичной страницы', () => {
    expect(VERIFY_RATE_WINDOW_MS).toBeGreaterThanOrEqual(60_000);
    expect(VERIFY_RATE_MAX_ATTEMPTS).toBeGreaterThanOrEqual(5);
    expect(VERIFY_RATE_MAX_ATTEMPTS).toBeLessThanOrEqual(100);
  });
});

describe('verify rate limit: скользящее окно', () => {
  const T0 = new Date('2026-11-14T12:00:00.000Z');

  it('разрешает ровно VERIFY_RATE_MAX_ATTEMPTS попыток, следующую ограничивает', () => {
    const limiter = createVerifyRateLimiter();
    let now = T0.getTime();
    for (let i = 0; i < VERIFY_RATE_MAX_ATTEMPTS; i += 1) {
      const result = limiter.hit('ip-1', new Date(now));
      expect(result.limited, `attempt ${i + 1}`).toBe(false);
      now += 1000;
    }
    const blocked = limiter.hit('ip-1', new Date(now));
    expect(blocked.limited).toBe(true);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(VERIFY_RATE_WINDOW_MS);
  });

  it('окно освобождается: после VERIFY_RATE_WINDOW_MS без обращений — снова можно', () => {
    const limiter = createVerifyRateLimiter();
    let now = T0.getTime();
    for (let i = 0; i < VERIFY_RATE_MAX_ATTEMPTS + 1; i += 1) {
      limiter.hit('ip-2', new Date(now));
      now += 1000;
    }
    now += VERIFY_RATE_WINDOW_MS;
    expect(limiter.hit('ip-2', new Date(now)).limited).toBe(false);
  });

  it('ключи независимы: один IP заблокирован, другой нет', () => {
    const limiter = createVerifyRateLimiter();
    let now = T0.getTime();
    for (let i = 0; i < VERIFY_RATE_MAX_ATTEMPTS + 1; i += 1) {
      limiter.hit('ip-3', new Date(now));
      now += 1000;
    }
    expect(limiter.hit('ip-3', new Date(now)).limited).toBe(true);
    expect(limiter.hit('ip-4', new Date(now)).limited).toBe(false);
  });

  it('старые попытки выбывают из окна (скользящее, не фиксированное)', () => {
    const limiter = createVerifyRateLimiter();
    let now = T0.getTime();
    for (let i = 0; i < VERIFY_RATE_MAX_ATTEMPTS; i += 1) {
      limiter.hit('ip-5', new Date(now));
      now += 1000;
    }
    // Первая попытка вышла из окна — новая помещается.
    now = T0.getTime() + VERIFY_RATE_WINDOW_MS + 1000;
    expect(limiter.hit('ip-5', new Date(now)).limited).toBe(false);
  });

  it('retryAfterMs указывает на момент выхода старейшей попытки из окна', () => {
    const limiter = createVerifyRateLimiter();
    let now = T0.getTime();
    for (let i = 0; i < VERIFY_RATE_MAX_ATTEMPTS; i += 1) {
      limiter.hit('ip-6', new Date(now));
      now += 1000;
    }
    const blocked = limiter.hit('ip-6', new Date(now));
    expect(blocked.limited).toBe(true);
    // Старейшая попытка была в T0, окно истечёт в T0 + WINDOW.
    expect(blocked.retryAfterMs).toBe(T0.getTime() + VERIFY_RATE_WINDOW_MS - now);
  });

  it('форма ответа ограниченного вызова стабильна', () => {
    const limiter = createVerifyRateLimiter();
    let now = T0.getTime();
    for (let i = 0; i < VERIFY_RATE_MAX_ATTEMPTS + 1; i += 1) {
      limiter.hit('ip-7', new Date(now));
      now += 1000;
    }
    const blocked = limiter.hit('ip-7', new Date(now));
    expect(Object.keys(blocked).sort()).toEqual(['limited', 'retryAfterMs']);
  });
});
