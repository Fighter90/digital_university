// DIG-50 — выбор auth-store по окружению.
//
// Контракт прода: при заданном DATABASE_URL приложение ОБЯЗАНО работать на
// prisma-store (PostgreSQL, generated client), а не молча откатываться на
// in-memory (именно такой молчаливый откат сломал вход на ostrovok.store).
// Без DATABASE_URL допустим memory-store, но только с явным WARN-логом при
// старте. Дополнительно /api/health публикует активный kind, чтобы security
// и ops могли проверить: на проде memory-store не активен.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectAuthStoreKind } from '@/server/auth/store';

const ROOT = resolve(__dirname, '..');

describe('selectAuthStoreKind (pure, DIG-50)', () => {
  it('DATABASE_URL задан → prisma-store, без WARN и без молчаливого отката', () => {
    const selection = selectAuthStoreKind('postgresql://u:p@db:5432/university');
    expect(selection.kind).toBe('prisma');
    expect(selection.warning).toBeUndefined();
  });

  it('DATABASE_URL не задан → memory-store с явным WARN-сообщением', () => {
    for (const url of [undefined, '', '   ']) {
      const selection = selectAuthStoreKind(url);
      expect(selection.kind, `empty=${JSON.stringify(url)} must fall back to memory`).toBe(
        'memory',
      );
      expect(selection.warning, 'WARN обязателен при memory-store').toBeTruthy();
      expect(selection.warning).toContain('DATABASE_URL');
      // WARN объясняет последствие (сессии в памяти) — не просто «fallback».
      expect(selection.warning).toMatch(/памят|memory/i);
    }
  });
});

describe('active app store matches the environment', () => {
  it('authStoreKind equals selectAuthStoreKind(process.env.DATABASE_URL).kind', async () => {
    const expected = selectAuthStoreKind(process.env.DATABASE_URL).kind;
    const { authStoreKind } = await import('@/server/auth/store');
    expect(authStoreKind).toBe(expected);
  });

  it('memory-store is never selected silently: the module logs the WARN at boot', () => {
    const source = readFileSync(resolve(ROOT, 'src/server/auth/store.ts'), 'utf8');
    expect(source).toMatch(/console\.warn/);
    // Откат на memory при заданном DATABASE_URL запрещён: выбор — только по env.
    expect(source).toMatch(/selectAuthStoreKind/);
  });
});

describe('/api/health publishes the active store kind (security acceptance DIG-50)', () => {
  it('health route exposes authStore (prisma | memory) so prod can be verified', () => {
    const health = readFileSync(resolve(ROOT, 'src/app/api/health/route.ts'), 'utf8');
    expect(health).toMatch(/authStore/);
    expect(health).toMatch(/@\/server\/auth\/store/);
  });
});
