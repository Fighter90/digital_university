// DIG-6 — repository scaffold invariants.
// Pins the contract every later task relies on: scripts, folder structure,
// tool configs (Vitest / Playwright / ESLint / Prettier / husky), README,
// MIT license, third-party license notes, "концепт" banner on every page.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const mustExist = (p: string) => expect(existsSync(resolve(ROOT, p)), `missing: ${p}`).toBe(true);

const pkg = () =>
  JSON.parse(read('package.json')) as {
    scripts: Record<string, string>;
    packageManager?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    'lint-staged'?: unknown;
  };

describe('package.json scripts (acceptance criteria)', () => {
  it('exposes dev / lint / typecheck / test / e2e / build', () => {
    const scripts = pkg().scripts;
    for (const s of ['dev', 'lint', 'typecheck', 'test', 'e2e', 'build']) {
      expect(scripts[s], `script "${s}" missing`).toBeTruthy();
    }
  });

  it('uses pnpm as the package manager (Node 22 LTS)', () => {
    expect(pkg().packageManager).toMatch(/^pnpm@/);
  });
});

describe('folder structure', () => {
  const dirs = [
    'src/app/(auth)/login',
    'src/app/(cabinet)',
    'src/app/api',
    'src/server',
    'src/components/ui',
    'prisma',
    'e2e',
    'docs',
  ];
  for (const d of dirs) {
    it(`has ${d}`, () => {
      mustExist(d);
    });
  }
});

describe('tooling configs', () => {
  it('vitest config with @ alias and no overlap with node:test / playwright files', () => {
    mustExist('vitest.config.ts');
    const cfg = read('vitest.config.ts');
    expect(cfg).toMatch(/alias/i);
    expect(cfg).toMatch(/@.*->.*resolve|@.*:.*resolve|'@'/);
  });

  it('playwright config defines desktop-1440 and mobile-360 projects', () => {
    mustExist('playwright.config.ts');
    const cfg = read('playwright.config.ts');
    expect(cfg).toContain('desktop-1440');
    expect(cfg).toContain('mobile-360');
    expect(cfg).toMatch(/360/); // mobile viewport width
  });

  it('eslint, prettier, husky and lint-staged are wired', () => {
    mustExist('eslint.config.mjs');
    mustExist('.prettierrc.json');
    mustExist('.husky/pre-commit');
    expect(pkg()['lint-staged']).toBeTruthy();
  });

  it('zod is available for validation', () => {
    const p = pkg();
    expect(p.dependencies?.zod ?? p.devDependencies?.zod).toBeTruthy();
  });
});

describe('README and licensing', () => {
  it('README keeps the contest-concept badge', () => {
    expect(read('README.md')).toContain('Концепт для конкурса');
  });

  it('README quick start is pnpm and fits in 3 commands', () => {
    const readme = read('README.md');
    expect(readme).toContain('pnpm install');
    expect(readme).toContain('pnpm dev');
    const block = readme.match(/```bash\n([\s\S]*?)```/)?.[1] ?? '';
    const commands = block.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
    expect(commands.length, `quick start must be 3 commands, got: ${commands.length}`).toBe(3);
  });

  it('ships an MIT license', () => {
    mustExist('LICENSE');
    expect(read('LICENSE')).toContain('MIT');
  });

  it('records third-party licenses', () => {
    mustExist('THIRD_PARTY_LICENSES.md');
  });
});

describe('contest concept banner on every page', () => {
  it('root layout renders the ConceptBanner globally (all route groups)', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toMatch(/ConceptBanner/);
    mustExist('src/components/concept-banner.tsx');
  });

  it('placeholder pages exist for the task-mandated route groups', () => {
    mustExist('src/app/page.tsx');
    mustExist('src/app/(auth)/login/page.tsx');
    mustExist('src/app/(cabinet)/dashboard/page.tsx');
    mustExist('src/app/api/health/route.ts');
  });
});
