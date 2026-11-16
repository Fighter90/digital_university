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
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

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
  it('build — сериализация через build-lock, сама сборка — прежний чистый webpack `next build`', () => {
    // DIG-55 (раунд 2): несколько swarm-сессий строят один checkout
    // одновременно → два `next build` гоняются за общий `.next` и падают с
    // ENOENT copyfile edge-runtime-webpack.js на «Collecting build traces».
    // Обёртка берёт mkdir-lock и запускает ту же команду. Инвариант DIG-12
    // сохранён: никакой чистящей прелюдии — единственный payload обёртки —
    // чистый `next build` (репозиторный бинарник из node_modules/.bin).
    const build = pkg().scripts.build;
    expect(build).toBe('node scripts/build-lock.mjs');
    const wrapper = read('scripts/build-lock.mjs');
    expect(wrapper).toMatch(/cmd\.push\(repoBin\('next'\), 'build'\)/);
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

// DIG-48, раунд 2 (ревью): два замечания про общую сборку на shared checkout.
//   • build-lock.mjs — `finally` мёртв: process.exit() внутри try пропускает
//     releaseBuildLock, каждая следующая сборка «ворует» lock как stale.
//   • `npm run typecheck` (clean-next-types → next typegen → tsc) не берёт
//     build-lock и может удалить .next/types у параллельной `next build`.
describe('build-lock: release при выходе и сериализация typecheck (DIG-48 р2)', () => {
  it('build-lock.mjs: lock захвачен по BUILD_LOCK_PATH на время команды и освобождён после выхода', () => {
    // Поведенческий прогон обёртки в песочнице: BUILD_LOCK_PATH уводит lock
    // из репозитория во временный каталог. Payload-команда выходит 3, если
    // lock уже захвачен (обёртка обязана его взять), иначе 7.
    const dir = mkdtempSync(resolve(tmpdir(), 'build-lock-release-'));
    const lock = resolve(dir, 'lock');
    const cli = resolve(ROOT, 'scripts/build-lock.mjs');
    const probe = `process.exit(require('node:fs').existsSync(${JSON.stringify(lock)}) ? 3 : 7)`;
    const r = spawnSync(process.execPath, [cli, 'node', '-e', probe], {
      encoding: 'utf8',
      env: { ...process.env, BUILD_LOCK_PATH: lock },
    });
    expect(r.status, `stderr: ${r.stderr?.slice(-400)}`).toBe(3);
    expect(existsSync(lock), 'lock-каталог остался после выхода — release не выполнен').toBe(false);
  });

  it('typecheck идёт под тем же build-lock (не рвёт .next/types параллельной сборке)', () => {
    expect(pkg().scripts.typecheck).toBe('node scripts/typecheck-locked.mjs');
    const runner = read('scripts/typecheck-locked.mjs');
    expect(runner).toMatch(/acquireBuildLock/);
    expect(runner).toMatch(/releaseBuildLock/);
    // те же шаги, что были в старом скрипте typecheck, но внутри lock
    expect(runner).toContain('clean-next-types.mjs');
    expect(runner).toContain("'typegen'");
    expect(runner).toContain("'--noEmit'");
  });

  it('typecheck-locked: lock освобождён и код выхода payload проброшен', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'typecheck-locked-'));
    const lock = resolve(dir, 'lock');
    const cli = resolve(ROOT, 'scripts/typecheck-locked.mjs');
    const r = spawnSync(process.execPath, [cli, 'node', '-e', 'process.exit(5)'], {
      encoding: 'utf8',
      env: { ...process.env, BUILD_LOCK_PATH: lock },
    });
    expect(r.status, `stderr: ${r.stderr?.slice(-400)}`).toBe(5);
    expect(existsSync(lock), 'lock-каталог остался после выхода typecheck').toBe(false);
  });
});
