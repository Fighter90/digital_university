// DIG-100 — «Версия для слабовидящих» (plain-режим, отдельная ссылка).
// Контракт: cookie du-a11y-version ('plain' | 'off') → класс a11y-plain на
// <html> (root layout, server-side до первой отрисовки), server action
// toggleA11yVersion (DIG-128: без сессии, как setLocale — ссылка стоит
// в футере публичного лендинга и /login), CSS-слой в самом
// конце globals.css (белый фон, чёрный текст, синие подчёркнутые ссылки,
// serif ≥20px, линейная колонка, без анимаций/теней/градиентов, мобайл 360px),
// plain перекрывает режимы DIG-86 и prefers-reduced-motion (включает их),
// словарь a11y.version.* парой RU/EN.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import {
  A11Y_PLAIN_CLASS,
  A11Y_VERSION_COOKIE,
  A11Y_VERSION_COOKIE_MAX_AGE,
  isA11yVersion,
  isPlainVersionFromCookie,
} from '@/lib/a11y/version';
import { ru } from '@/lib/i18n/ru';
import { en } from '@/lib/i18n/en';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// ── cookie-контракт du-a11y-version ─────────────────────────────────────────

describe('DIG-100: cookie du-a11y-version — контракт', () => {
  it('имя cookie — du-a11y-version, значения — plain / off, класс — a11y-plain', () => {
    expect(A11Y_VERSION_COOKIE).toBe('du-a11y-version');
    expect(A11Y_PLAIN_CLASS).toBe('a11y-plain');
    expect(isA11yVersion('plain')).toBe(true);
    expect(isA11yVersion('off')).toBe(true);
    expect(isA11yVersion('junk')).toBe(false);
    expect(isA11yVersion(null)).toBe(false);
    expect(isA11yVersion(undefined)).toBe(false);
    // срок жизни — как у du-a11y / du-locale (год, прототип)
    expect(A11Y_VERSION_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });

  it.each([
    ['plain', true],
    ['off', false],
    [undefined, false],
    [null, false],
    ['', false],
    ['PLAIN', false], // чувствительно к регистру: битое значение — обычная версия
  ])('isPlainVersionFromCookie(%j) → %s', (raw, plain) => {
    expect(isPlainVersionFromCookie(raw as string | undefined | null)).toBe(plain);
  });
});

// ── server action toggleA11yVersion ────────────────────────────────────────

// Action: DIG-128 — БЕЗ сессии (как setLocale, DIG-106): версия интерфейса —
// предпочтение самого браузера; ссылка стоит в футере публичного лендинга
// и /login. Cookie пишет сам action; next/headers и next/cache — моки.
const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  sets: [] as Array<{ name: string; value: string }>,
  deletes: [] as Array<string>,
  requireDataCtx: vi.fn(async () => ({
    userId: 'auth-anna',
    studentId: 'st-anna',
    role: 'STUDENT' as const,
    login: 'anna',
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      state.jar.set(name, value);
      state.sets.push({ name, value });
    },
    delete: (name: string) => {
      state.jar.delete(name);
      state.deletes.push(name);
    },
  })),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/server/data', () => ({
  requireDataCtx: state.requireDataCtx,
}));

describe('DIG-100: server action toggleA11yVersion', () => {
  it('включает plain-версию: cookie du-a11y-version=plain + revalidate каркаса', async () => {
    state.jar.clear();
    state.sets.length = 0;
    const { toggleA11yVersion } = await import('@/server/actions/a11y');
    const { revalidatePath } = await import('next/cache');

    const fd = new FormData();
    fd.set('version', 'plain');
    await toggleA11yVersion(fd);

    expect(state.sets).toContainEqual({ name: 'du-a11y-version', value: 'plain' });
    // DIG-128: action работает БЕЗ сессии — слабовидящий аноним включает
    // версию с лендинга и /login; guard не вызывается (иначе редирект).
    expect(state.requireDataCtx).not.toHaveBeenCalled();
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/', 'layout');
  });

  it('выключает plain-версию: cookie du-a11y-version=off', async () => {
    state.jar.clear();
    state.sets.length = 0;
    const { toggleA11yVersion } = await import('@/server/actions/a11y');

    const fd = new FormData();
    fd.set('version', 'off');
    await toggleA11yVersion(fd);

    expect(state.sets).toContainEqual({ name: 'du-a11y-version', value: 'off' });
  });

  it('битое значение отклоняется: cookie не пишется, вызов не падает', async () => {
    state.jar.clear();
    state.sets.length = 0;
    const { toggleA11yVersion } = await import('@/server/actions/a11y');

    const fd = new FormData();
    fd.set('version', 'everything');
    await expect(toggleA11yVersion(fd)).resolves.toBeUndefined();
    expect(state.sets).toEqual([]);
  });

  it('next — только внутренний путь: внешний/схемный отбрасывается (open redirect)', async () => {
    state.jar.clear();
    state.sets.length = 0;
    state.requireDataCtx.mockClear();
    const { toggleA11yVersion } = await import('@/server/actions/a11y');

    const fd = new FormData();
    fd.set('version', 'plain');
    fd.set('next', 'https://evil.example');
    await toggleA11yVersion(fd);
    // внешний URL не доходит до requireDataCtx: возврат на дефолт (без next)
    expect(state.requireDataCtx).not.toHaveBeenCalledWith('https://evil.example');
    // cookie при этом всё равно записана
    expect(state.sets).toContainEqual({ name: 'du-a11y-version', value: 'plain' });
  });
});

// ── класс a11y-plain на <html> (root layout, server-side) ───────────────────

// Layout-тесты: appearance — дефолт, Inter — стаб, глобальные CSS — стабы
// (та же схема, что tests/a11y-mode.test.tsx).
vi.mock('next/font/google', () => ({
  Inter: vi.fn(() => ({ variable: '--font-inter' })),
}));
vi.mock('@/app/globals.css', () => ({}));
vi.mock('@/app/themes/dark.css', () => ({}));
vi.mock('@/server/data/appearance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/data/appearance')>();
  return {
    ...actual,
    getAppliedAppearance: vi.fn(async () => actual.DEFAULT_APPEARANCE),
  };
});
vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => null),
  requireUser: vi.fn(async () => ({ id: 'x', login: 'x', role: 'STUDENT' as const })),
}));
vi.mock('@/server/data/mcp', () => ({
  getOwnMcpTokenView: vi.fn(async () => null),
}));
vi.mock('@/server/data/db', () => ({ dataDb: {} }));

/** Cookie-хранилище для layout-теста: замена реализации vi.fn-мока cookies(). */
async function setCookieJar(jar: Record<string, string>): Promise<void> {
  const { cookies } = await import('next/headers');
  vi.mocked(cookies).mockResolvedValue(
    new Map(Object.entries(jar).map(([name, value]) => [name, { name, value }])) as never,
  );
}

async function renderRootLayout(): Promise<string> {
  const { default: RootLayout } = await import('@/app/layout');
  const { prelude } = await prerenderToNodeStream(
    createElement(
      RootLayout as unknown as ComponentType<{ children: ReactNode }>,
      null,
      createElement('main', null, 'content'),
    ),
  );
  let html = '';
  for await (const chunk of prelude) html += String(chunk);
  return html;
}

describe('DIG-100: класс a11y-plain на <html> по кукам', () => {
  it('root layout с cookie du-a11y-version=plain ставит a11y-plain на <html>', async () => {
    await setCookieJar({ 'du-a11y-version': 'plain' });
    const html = await renderRootLayout();
    expect(html).toMatch(/<html lang="ru" class="[^"]*a11y-plain[^"]*"/);
    // базовые классы каркаса не потеряны
    expect(html).toMatch(/<html lang="ru" class="[^"]*--font-inter[^"]*"/);
  });

  it('root layout с cookie du-a11y-version=off НЕ ставит a11y-plain', async () => {
    await setCookieJar({ 'du-a11y-version': 'off' });
    const html = await renderRootLayout();
    expect(html).not.toContain('a11y-plain');
  });

  it('root layout без cookie и с битой cookie — без a11y-plain', async () => {
    await setCookieJar({});
    expect(await renderRootLayout()).not.toContain('a11y-plain');
    await setCookieJar({ 'du-a11y-version': 'junk' });
    expect(await renderRootLayout()).not.toContain('a11y-plain');
  });

  it('plain сосуществует с DIG-86: классы a11y-large-text / a11y-no-effects не теряются', async () => {
    await setCookieJar({ 'du-a11y': 'large-text,no-effects', 'du-a11y-version': 'plain' });
    const html = await renderRootLayout();
    const classes = (html.match(/<html lang="ru" class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    expect(classes).toContain('a11y-plain');
    expect(classes).toContain('a11y-large-text');
    expect(classes).toContain('a11y-no-effects');
  });
});

// ── словарь RU/EN ───────────────────────────────────────────────────────────

describe('DIG-100: словарь a11y.version.* (паритет RU/EN)', () => {
  it('RU: «Версия для слабовидящих» и «Обычная версия»', () => {
    expect(ru['a11y.version.plain']).toBe('Версия для слабовидящих');
    expect(ru['a11y.version.standard']).toBe('Обычная версия');
  });

  it('EN: «Accessibility version» и «Standard version»', () => {
    expect(en['a11y.version.plain']).toBe('Accessibility version');
    expect(en['a11y.version.standard']).toBe('Standard version');
  });

  it('ключи есть в обоих словарях (паритет не нарушен)', () => {
    for (const key of ['a11y.version.plain', 'a11y.version.standard']) {
      expect(key in ru, `ключ ${key} в ru`).toBe(true);
      expect(key in en, `ключ ${key} в en`).toBe(true);
    }
  });
});

// ── CSS-контракт globals.css ────────────────────────────────────────────────

describe('DIG-100: CSS-контракт a11y-plain (globals.css)', () => {
  const css = read('src/app/globals.css');

  it('слой a11y-plain — в самом конце файла, после блока DIG-86', () => {
    const dig86 = css.indexOf('DIG-86');
    const dig100 = css.indexOf('DIG-100');
    expect(dig86).toBeGreaterThan(-1);
    expect(dig100).toBeGreaterThan(dig86);
  });

  it('базовый шрифт с засечками и размер корня 20px (≥20px базово)', () => {
    const root = css.match(/html\.a11y-plain[^{]*\{[^}]*\}/);
    expect(root, 'правило html.a11y-plain найдено').toBeTruthy();
    expect(root?.[0]).toMatch(/font-size:\s*20px/);
    const body = css.match(/html\.a11y-plain\s+body\s*\{[^}]*\}/);
    expect(body, 'правило html.a11y-plain body найдено').toBeTruthy();
    expect(body?.[0]).toMatch(/font-family:[^;]*serif/);
  });

  it('белый фон и чёрный текст', () => {
    const root = css.match(/html\.a11y-plain[^{]*\{[^}]*\}/);
    expect(root?.[0]).toMatch(/background:\s*#fff/);
    expect(root?.[0]).toMatch(/color:\s*#000/);
  });

  it('ссылки — синие подчёркнутые', () => {
    const link = css.match(/html\.a11y-plain a[^{]*\{[^}]*\}/);
    expect(link, 'правило ссылки найдено').toBeTruthy();
    expect(link?.[0]).toMatch(/text-decoration:\s*underline/);
    expect(link?.[0]).toMatch(/color:\s*#/);
  });

  it('без анимаций, теней и градиентных фонов (plain включает поведение DIG-86)', () => {
    const wildcard = css.match(/html\.a11y-plain \*[^{]*\{[^}]*\}/);
    expect(wildcard, 'wildcard-правило найдено').toBeTruthy();
    expect(wildcard?.[0]).toMatch(/animation:\s*none/);
    expect(wildcard?.[0]).toMatch(/box-shadow:\s*none/);
    expect(wildcard?.[0]).toMatch(/background-image:\s*none/);
    // reveal-секции лендинга видимы сразу (контент никогда не скрыт)
    const reveal = css.match(/html\.a11y-plain \.reveal[^{]*\{[^}]*\}/);
    expect(reveal, 'reveal видим без анимации').toBeTruthy();
    expect(reveal?.[0]).toMatch(/opacity:\s*1/);
  });

  it('линейная колонка: grid → вертикальный стек, flex → колонка', () => {
    const grid = css.match(/html\.a11y-plain [^{]*\.grid[^{]*\{[^}]*\}/);
    expect(grid, 'правило .grid найдено').toBeTruthy();
    expect(grid?.[0]).toMatch(/display:\s*(block|flex)/);
    const flex = css.match(/html\.a11y-plain \.flex[^{]*\{[^}]*flex-direction:\s*column/);
    expect(flex, 'flex → column найдено').toBeTruthy();
  });

  it('мобайл 360px тоже переопределён (media-блок с a11y-plain)', () => {
    const media = css.match(/@media \(max-width:\s*360px\)[^@]*a11y-plain[^@]*\}/);
    expect(media, 'media-блок 360px с a11y-plain найден').toBeTruthy();
  });
});
