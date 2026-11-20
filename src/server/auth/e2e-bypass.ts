// Round 3 DIG-48 — явный e2e-обход IP-лимитера входа.
//
// Проблема: полный e2e-прогон делает ~189 логинов с одного IP (127.0.0.1 —
// единый bucket 'unknown') за ~18 минут. Лимитер входа DIG-11 — 30 попыток /
// 15 минут, состояние в памяти процесса сервера — режет хвост прогона:
// после 30-й попытки каждый вход получает RATE_LIMITED и тест падает по
// таймауту навигации (в упавшем прогоне — 10/10 staff-cabinet, 2/2 auth,
// ICS, i18n).
//
// Решение: webServer'а playwright стартует с E2E_RATE_LIMIT_BYPASS=1
// (см. env в playwright.config.ts). Прод и обычный запуск флаг не выставляют
// — brute-force guard работает без изменений (правило «не ослаблять
// rate-limit входа» соблюдено: значения 30/15 в проде не тронуты).
//
// Чистые функции — без side effects, чтобы контракт покрывал unit-тест
// tests/auth-e2e-bypass.test.ts.
import type { IpRateLimiter } from './types';

export interface RateLimitDecision {
  limited: boolean;
  retryAfterMs: number;
}

type Env = Record<string, string | undefined>;

/** Флаг включён ровно значением '1' (пустое/'0'/отсутствие — выключено). */
export function e2eRateLimitBypassEnabled(env: Env = process.env): boolean {
  return env.E2E_RATE_LIMIT_BYPASS === '1';
}

/** Обёртка: с флагом лимитер не вызывается вовсе, без флага — как раньше. */
export function wrapIpRateLimiter(real: IpRateLimiter, env: Env = process.env): IpRateLimiter {
  return {
    hit(key: string, now: Date): RateLimitDecision {
      if (e2eRateLimitBypassEnabled(env)) {
        return { limited: false, retryAfterMs: 0 };
      }
      return real.hit(key, now);
    },
  };
}
