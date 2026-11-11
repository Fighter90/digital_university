// DIG-50 — requireUser() читает реальную сессию (DIG-11), заглушка удалена.
//
// До этой задачи src/server/auth.ts возвращал детерминированный стаб
// «Анна Студентова»: прод показывал вымышленного пользователя независимо от
// входа. Контракт теперь: (cabinet)-layout обязан идти через
// requireUser() из @/server/auth/session, а личные данные шапки Shell —
// через fail-soft резолвер профиля (без redirect: БД-пользователь без строки
// в demo-наборе не должен вылетать на /login).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
  });

describe('stub requireUser is gone (DIG-50)', () => {
  it('src/server/auth.ts (stub module) does not exist', () => {
    expect(existsSync(resolve(ROOT, 'src/server/auth.ts'))).toBe(false);
  });

  it('no source file imports the bare stub path "@/server/auth" anymore', () => {
    const offenders = walk(resolve(ROOT, 'src')).filter((file) =>
      /from ['"]@\/server\/auth['"]/.test(read(file)),
    );
    expect(offenders, `files still importing the removed stub: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });

  it('no hardcoded «Анна Студентова» identity remains in the sources', () => {
    const offenders = walk(resolve(ROOT, 'src')).filter((file) =>
      read(file).includes('Студентова'),
    );
    expect(offenders, `stub identity still present in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('(cabinet) layout guards through the real session requireUser', () => {
    const layout = read('src/app/(cabinet)/layout.tsx');
    expect(layout).toContain("from '@/server/auth/session'");
    expect(layout).toMatch(/requireUser/);
  });
});
