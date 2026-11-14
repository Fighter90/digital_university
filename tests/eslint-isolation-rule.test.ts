// DIG-12 — ESLint guard: Prisma must never be imported outside src/server/.
// Pages, components and lib code read data exclusively through
// src/server/data/*; the rule is pinned here so a regression fails lint
// (acceptance criterion: «правило ESLint падает при импорте @prisma/client
// вне src/server/»).
import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';

/** Minimal shape we rely on — the full type is not exported by this ESLint version. */
interface LintMessage {
  ruleId: string | null;
  message: string;
}

const ROOT = resolve(__dirname, '..');

// Общий инстанс: холодная компиляция конфига (compat + jiti + плагины Next)
// недетерминированно падает в первом вызове воркера — прогрев в beforeAll +
// синглтон лечат это.
let _eslint: ESLint | null = null;
const getESLint = () => (_eslint ??= new ESLint({ cwd: ROOT }));
const lint = async (code: string, filePath: string) => {
  try {
    return await getESLint().lintText(code, { filePath: resolve(ROOT, filePath) });
  } catch {
    _eslint = null;
    return await getESLint().lintText(code, { filePath: resolve(ROOT, filePath) });
  }
};

// Урок раунда 3 (гейт): на машине роя воркеры Vitest гоняются параллельно с
// другими executor'ами — холодная компиляция конфига ESLint превышает
// глобальный hookTimeout 30s и beforeAll падает по таймауту до первого
// assertions. Поэтому: у прогрева и у каждого теста — собственный щедрый
// таймаут (значение последним аргументом перекрывает глобальный кап).
const WARMUP_TIMEOUT_MS = 120_000;
const LINT_TIMEOUT_MS = 90_000;

const restrictedHits = (messages: LintMessage[]) =>
  messages.filter((m) => m.ruleId === 'no-restricted-imports' && /prisma/i.test(m.message));

const PRISMA_CODE = [
  "import { PrismaClient } from '@prisma/client';",
  'export const makeClient = () => new PrismaClient();',
].join('\n');

describe('eslint no-restricted-imports: prisma is server-only (DIG-12)', () => {
  beforeAll(async () => {
    // прогрев конфига: первый lintText в воркере может отработать вхолостую;
    // таймаут прогрева — явно, глобальные 30s на насыщенной машине не хватает
    try {
      await lint('const warm = 1;', 'src/warmup.ts');
    } catch {
      /* прогрев не обязан успехом — важен кэш компиляции */
    }
  }, WARMUP_TIMEOUT_MS);

  it(
    'a page-level import of @prisma/client FAILS lint',
    async () => {
      const [result] = await lint(PRISMA_CODE, 'src/app/virtual-dashboard-page.tsx');
      expect(restrictedHits(result.messages).length).toBeGreaterThan(0);
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'a component-level import of @prisma/client FAILS lint',
    async () => {
      const [result] = await lint(PRISMA_CODE, 'src/components/request-card.tsx');
      expect(restrictedHits(result.messages).length).toBeGreaterThan(0);
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'a relative import of the generated client from src/components FAILS lint',
    async () => {
      const code = [
        "import { PrismaClient } from '../generated/prisma';",
        'export const makeClient = () => new PrismaClient();',
      ].join('\n');
      const [result] = await lint(code, 'src/components/virtual.tsx');
      expect(restrictedHits(result.messages).length).toBeGreaterThan(0);
    },
    LINT_TIMEOUT_MS,
  );

  it(
    "an aliased import '@/generated/prisma' from src/lib FAILS lint",
    async () => {
      const code = [
        "import { PrismaClient } from '@/generated/prisma';",
        'export const makeClient = () => new PrismaClient();',
      ].join('\n');
      const [result] = await lint(code, 'src/lib/virtual.ts');
      expect(restrictedHits(result.messages).length).toBeGreaterThan(0);
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'an import of @prisma/adapter-pg from src/app FAILS lint',
    async () => {
      const code = [
        "import { PrismaPg } from '@prisma/adapter-pg';",
        'export const makeAdapter = () => new PrismaPg({ connectionString: "" });',
      ].join('\n');
      const [result] = await lint(code, 'src/app/api/virtual/route.ts');
      expect(restrictedHits(result.messages).length).toBeGreaterThan(0);
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'the same import inside src/server/ is allowed',
    async () => {
      const [result] = await lint(PRISMA_CODE, 'src/server/data/prisma-adapter.ts');
      expect(result.errorCount).toBe(0);
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'regular data-layer imports from a page stay allowed',
    async () => {
      const code = [
        "import { listRequests } from '@/server/data/requests';",
        'export const load = () => listRequests;',
      ].join('\n');
      const [result] = await lint(code, 'src/app/(cabinet)/requests/virtual-page.tsx');
      expect(result.errorCount).toBe(0);
    },
    LINT_TIMEOUT_MS,
  );
});
