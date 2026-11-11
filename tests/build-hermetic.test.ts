// DIG-12 (раунд 3) — гейт build падал: `next build --turbopack` умирал с
// ENOENT `.next/server/pages-manifest.json` на этапе «Collecting page data».
// Причина — смешанное состояние общего distDir: `next dev` (тоже Turbopack)
// пишет в тот же `.next` и перезаписывает манифесты под живой сборкой.
// Фиксируем два инварианта, закрывающие все варианты:
//   1) `next dev` пишет в отдельный `.next-dev` — dev и build физически не
//      могут перезаписать состояние друг друга;
//   2) `npm run build` начинает с чистого `.next` (кроме сгенерированных
//      route-types, на которые ссылается next-env.d.ts — их удаление роняет
//      следующий typecheck ошибкой TS6053).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import nextConfig, { resolveDistDir } from '../next.config';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const pkg = () => JSON.parse(read('package.json')) as { scripts: Record<string, string> };

describe('dev и build не делят distDir (корень ENOENT pages-manifest.json)', () => {
  it('next dev пишет в .next-dev, всё остальное — в .next', () => {
    expect(resolveDistDir('development')).toBe('.next-dev');
    expect(resolveDistDir('production')).toBe('.next');
    // не-dev окружения (test, undefined, CI-оболочки) ведут себя как build:
    // scattered state между инструментами недопустим.
    expect(resolveDistDir(undefined)).toBe('.next');
    expect(resolveDistDir('test')).toBe('.next');
  });

  it('next.config.ts использует resolveDistDir (единая точка правды)', () => {
    expect(nextConfig.distDir).toBe(resolveDistDir(process.env.NODE_ENV));
  });

  it('typecheck видит route-types обоих режимов (next-env.d.ts не висит)', () => {
    const tsconfig = JSON.parse(read('tsconfig.json')) as {
      include: string[];
    };
    expect(tsconfig.include).toContain('.next/types/**/*.ts');
    expect(tsconfig.include).toContain('.next-dev/types/**/*.ts');
    // next-env.d.ts, который Next перегенерирует под активный distDir, в include.
    expect(tsconfig.include).toContain('next-env.d.ts');
  });
});

describe('npm run build — герметичный прогон (без переиспользования состояния)', () => {
  it('build чистит .next перед сборкой и сохраняет route-types', () => {
    const build = pkg().scripts.build;
    expect(build).toMatch(/readdirSync\('\.next'\)/);
    expect(build).toMatch(/'types'/); // route-types не удалять: TS6053 в typecheck
    expect(build).toContain('next build --turbopack');
  });

  it('.next-dev игнорируется git и eslint (артефакты, не исходники)', () => {
    expect(read('.gitignore')).toMatch(/\.next-dev\//);
    expect(read('eslint.config.mjs')).toMatch(/\.next-dev/);
  });

  it('санити: ссылка из next-env.d.ts сейчас не висит (см. TS6053)', () => {
    const ref = read('next-env.d.ts').match(/reference path="\.\/([^"]+routes\.d\.ts)"/)?.[1];
    expect(ref, 'next-env.d.ts не содержит ссылки на routes.d.ts').toBeTruthy();
    expect(
      existsSync(resolve(ROOT, ref as string)),
      `файл из next-env.d.ts отсутствует: ${ref} — прогони build или dev`,
    ).toBe(true);
  });
});
