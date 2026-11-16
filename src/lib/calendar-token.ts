// DIG-63 — подписанные ссылки ICS-подписки (личный календарь студента).
//
// Ссылка подписки выглядит как `v1.<tokenId>.<hmac>` и работает без кук:
// Google/Apple Calendar не умеют отправлять session-cookie, поэтому доступ
// держится на bearer-токене. Механика:
//  - tokenId — неугадываемый случайный nonce (128 бит), он же ключ строки
//    подписки в хранилище; сам по себе секрета не содержит;
//  - hmac — HMAC-SHA256(tokenId) с секретом ICS_TOKEN_SECRET (.env.example,
//    только сервер): подделка ссылки и ссылки с чужим секретом отсекаются
//    парсером ДО обращения к хранилищу (timingSafeEqual);
//  - отзыв — удаление строки tokenId из хранилища (выход из кабинета):
//    ссылка умирает навсегда, новый вход получает новый tokenId.
// Модуль чистый (node:crypto, без серверных импортов) — покрыт юнит-тестами.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const VERSION = 'v1';
const TOKEN_ID_BYTES = 16; // 128 бит энтропии → base64url 22 символа

export interface CalendarTokenPayload {
  tokenId: string;
}

/** Неугадываемый nonce подписки (128 бит, base64url, 22 символа). */
export function newCalendarTokenId(random: (size: number) => Buffer = randomBytes): string {
  return random(TOKEN_ID_BYTES).toString('base64url');
}

/** Подписанная ссылка: v1.<tokenId>.<hmac>; hmac — base64url (43 символа). */
export function mintCalendarToken(secret: string, tokenId: string): string {
  const hmac = createHmac('sha256', secret).update(tokenId).digest('base64url');
  return `${VERSION}.${tokenId}.${hmac}`;
}

/**
 * Разбор и проверка ссылки. Любое отклонение (формат, версия, подпись,
 * чужой секрет) → null — единообразно, без причины наружу (нет оракула).
 */
export function parseCalendarToken(secret: string, rawToken: string): CalendarTokenPayload | null {
  const parts = rawToken.split('.');
  if (parts.length !== 3) return null;
  const [version, tokenId, hmac] = parts;
  if (version !== VERSION || !tokenId || !hmac) return null;
  const expected = createHmac('sha256', secret).update(tokenId).digest();
  const actual = Buffer.from(hmac, 'base64url');
  if (actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;
  return { tokenId };
}
