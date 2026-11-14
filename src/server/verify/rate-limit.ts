// DIG-47 — rate limit публичной страницы проверки справок.
//
// Перебор кодов теоретически возможен, поэтому страница /verify/<код>
// считает обращения по IP в скользящем окне (тот же контракт, что у
// входа в систему, DIG-11). При превышении — нейтральное состояние
// «Слишком много попыток»: ответ не раскрывает, существует ли документ.
//
// Лимитер — чистая структура с инъекцией времени для тестов; экземпляр
// приложения держится в globalThis по той же причине, что и сторы
// (в dev страницы и API-роуты — разные бандлы).

export const VERIFY_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 минут
/** Как у входа в систему (DIG-11): 30 попыток с одного IP на окно. */
export const VERIFY_RATE_MAX_ATTEMPTS = 30;

export interface RateHitResult {
  limited: boolean;
  /** >0 только при limited: сколько мс до выхода старейшей попытки из окна. */
  retryAfterMs: number;
}

export interface VerifyRateLimiter {
  hit(key: string, now: Date): RateHitResult;
}

export function createVerifyRateLimiter(options?: {
  windowMs?: number;
  maxAttempts?: number;
}): VerifyRateLimiter {
  const windowMs = options?.windowMs ?? VERIFY_RATE_WINDOW_MS;
  const maxAttempts = options?.maxAttempts ?? VERIFY_RATE_MAX_ATTEMPTS;
  const hits = new Map<string, number[]>();

  return {
    hit(key: string, now: Date): RateHitResult {
      const floor = now.getTime() - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > floor);
      recent.push(now.getTime());
      hits.set(key, recent);
      if (recent.length > maxAttempts) {
        return { limited: true, retryAfterMs: recent[0]! + windowMs - now.getTime() };
      }
      return { limited: false, retryAfterMs: 0 };
    },
  };
}

const globals = globalThis as unknown as { __verifyRateLimiter?: VerifyRateLimiter };

/** Экземпляр приложения (создаётся один раз на процесс). */
export const verifyRateLimiter: VerifyRateLimiter = (globals.__verifyRateLimiter ??=
  createVerifyRateLimiter());
