// Round 3 DIG-48 — e2e-обход IP-лимитера входа.
//
// Контракт: полный e2e-прогон делает ~189 логинов с одного IP (127.0.0.1 —
// единый bucket 'unknown') за ~18 минут. Лимитер входа — 30 попыток / 15 мин
// (DIG-11, brute-force guard, состояние в памяти процесса сервера) — режет
// хвост прогона: после 30-й попытки каждый вход получает RATE_LIMITED,
// тесты падают по таймауту навигации (10/10 staff-cabinet и др.).
//
// Решение — ЯВНЫЙ флаг E2E_RATE_LIMIT_BYPASS=1, который ставится ТОЛЬКО в
// webServer'е playwright (см. env конфига). Прод и обычный запуск флаг не
// выставляют → brute-force guard работает как раньше (правило «не ослаблять
// rate-limit входа» соблюдено: менять 30/15 в проде нельзя и не нужно).
import { describe, expect, it } from 'vitest';

import { createMemoryIpRateLimiter } from '@/server/auth/memory-store';
import { e2eRateLimitBypassEnabled, wrapIpRateLimiter } from '@/server/auth/e2e-bypass';

const NOW = new Date('2026-11-20T12:00:00Z');

describe('e2eRateLimitBypassEnabled (DIG-48 round 3)', () => {
  it('флаг выключен по умолчанию — прод ведёт себя как раньше', () => {
    expect(e2eRateLimitBypassEnabled({})).toBe(false);
    expect(e2eRateLimitBypassEnabled({ E2E_RATE_LIMIT_BYPASS: '' })).toBe(false);
    expect(e2eRateLimitBypassEnabled({ E2E_RATE_LIMIT_BYPASS: '0' })).toBe(false);
  });

  it('флаг включается ровно значением 1', () => {
    expect(e2eRateLimitBypassEnabled({ E2E_RATE_LIMIT_BYPASS: '1' })).toBe(true);
  });
});

describe('wrapIpRateLimiter: bypass только по флагу', () => {
  it('без флага лимитер работает как раньше: 31-я попытка за окно ограничена', () => {
    const real = createMemoryIpRateLimiter({ now: () => NOW });
    const wrapped = wrapIpRateLimiter(real, {});
    for (let i = 0; i < 30; i += 1) {
      expect(wrapped.hit('127.0.0.1', NOW).limited).toBe(false);
    }
    expect(wrapped.hit('127.0.0.1', NOW).limited).toBe(true);
  });

  it('с флагом E2E_RATE_LIMIT_BYPASS=1 лимитер не ограничивает даже после 100 попыток', () => {
    const real = createMemoryIpRateLimiter({ now: () => NOW });
    const wrapped = wrapIpRateLimiter(real, { E2E_RATE_LIMIT_BYPASS: '1' });
    for (let i = 0; i < 100; i += 1) {
      const decision = wrapped.hit('127.0.0.1', NOW);
      expect(decision.limited).toBe(false);
      expect(decision.retryAfterMs).toBe(0);
    }
  });

  it('с флагом реальный лимитер вообще не вызывается (счётчик не растёт)', () => {
    let calls = 0;
    const spy = wrapIpRateLimiter(
      {
        hit: () => {
          calls += 1;
          return { limited: false, retryAfterMs: 0 };
        },
      },
      { E2E_RATE_LIMIT_BYPASS: '1' },
    );
    spy.hit('127.0.0.1', NOW);
    expect(calls).toBe(0);
  });
});
