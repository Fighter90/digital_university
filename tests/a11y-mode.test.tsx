// DIG-86 — режим доступности «Крупный текст и без эффектов» (для слабовидящих).
// Контракт: cookie du-a11y → классы a11y-large-text / a11y-no-effects на <html>
// (root layout, server-side до первой отрисовки), CSS в globals.css (крупный
// текст 125%+, без анимаций/теней/переходов), тумблеры на новой вкладке
// «Настройки → Доступность» (клавиатурные, RU/EN), независимость от
// prefers-reduced-motion и html.reduce-motion (DIG-44).
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import {
  A11Y_COOKIE,
  A11Y_PREFS,
  a11yClasses,
  a11yPrefsFromCookie,
  a11yPrefsToCookie,
  isA11yPref,
  withA11yPref,
  DEFAULT_A11Y_PREFS,
} from '@/lib/a11y';
import { ru } from '@/lib/i18n/ru';
import { en } from '@/lib/i18n/en';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// ── cookie-контракт du-a11y ─────────────────────────────────────────────────

describe('DIG-86: cookie du-a11y — контракт', () => {
  it('имя cookie — du-a11y, значения — large-text / no-effects', () => {
    expect(A11Y_COOKIE).toBe('du-a11y');
    expect(A11Y_PREFS).toEqual(['large-text', 'no-effects']);
    expect(isA11yPref('large-text')).toBe(true);
    expect(isA11yPref('no-effects')).toBe(true);
    expect(isA11yPref('everything')).toBe(false);
    expect(isA11yPref(null)).toBe(false);
  });

  it.each([
    ['large-text', true, false],
    ['no-effects', false, true],
    ['large-text,no-effects', true, true],
    ['no-effects,large-text', true, true], // порядок не важен
    [undefined, false, false],
    [null, false, false],
    ['', false, false],
    ['junk,large-text', true, false], // мусор отбрасывается, валидное живёт
  ])('a11yPrefsFromCookie(%j) → { largeText: %s, noEffects: %s }', (raw, largeText, noEffects) => {
    expect(a11yPrefsFromCookie(raw as string | undefined | null)).toEqual({
      largeText,
      noEffects,
    });
  });

  it('a11yPrefsToCookie — канонический порядок значений', () => {
    expect(a11yPrefsToCookie({ largeText: true, noEffects: false })).toBe('large-text');
    expect(a11yPrefsToCookie({ largeText: false, noEffects: true })).toBe('no-effects');
    expect(a11yPrefsToCookie({ largeText: true, noEffects: true })).toBe('large-text,no-effects');
    expect(a11yPrefsToCookie(DEFAULT_A11Y_PREFS)).toBe('');
  });

  it('round-trip: serialize → parse → serialize стабилен', () => {
    for (const prefs of [
      DEFAULT_A11Y_PREFS,
      { largeText: true, noEffects: false },
      { largeText: false, noEffects: true },
      { largeText: true, noEffects: true },
    ] as const) {
      expect(a11yPrefsFromCookie(a11yPrefsToCookie(prefs))).toEqual(prefs);
    }
  });

  it('withA11yPref — тумблеры независимы друг от друга', () => {
    expect(withA11yPref(DEFAULT_A11Y_PREFS, 'large-text', true)).toEqual({
      largeText: true,
      noEffects: false,
    });
    expect(
      withA11yPref(withA11yPref(DEFAULT_A11Y_PREFS, 'large-text', true), 'no-effects', true),
    ).toEqual({ largeText: true, noEffects: true });
    // выключение одного не сбрасывает второй
    expect(withA11yPref({ largeText: true, noEffects: true }, 'large-text', false)).toEqual({
      largeText: false,
      noEffects: true,
    });
    // повторное включение — идемпотентно
    expect(withA11yPref({ largeText: true, noEffects: true }, 'large-text', true)).toEqual({
      largeText: true,
      noEffects: true,
    });
  });
});

// ── общие моки модулей (одни на файл; состояние cookie — в каждом тесте) ───
// Layout-тесты: appearance — дефолт (без обращения к data-слою), Inter — стаб,
// глобальные CSS — стабы (vitest не прогоняет их через postcss/tailwind).
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
// Настройки: та же схема моков, что tests/settings-page.test.tsx.
const studentCtx = {
  userId: 'auth-anna',
  login: 'anna',
  role: 'STUDENT' as const,
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const annaSettings = {
  studentId: 'st-anna',
  phone: '+7 900 010-20-30',
  emailVisibleToStaff: true,
  phoneVisibleToStaff: false,
  notificationChannels: {
    SCHEDULE: { PUSH: true, EMAIL: true, TELEGRAM: false },
    GRADE: { PUSH: true, EMAIL: true, TELEGRAM: false },
    REQUEST: { PUSH: true, EMAIL: true, TELEGRAM: false },
    NEWS: { PUSH: true, EMAIL: true, TELEGRAM: false },
    DEADLINE: { PUSH: false, EMAIL: true, TELEGRAM: false },
    SYSTEM: { PUSH: true, EMAIL: true, TELEGRAM: false },
  },
  theme: 'SYSTEM' as const,
  widgets: [
    { id: 'today', enabled: true },
    { id: 'deadlines', enabled: true },
    { id: 'performance', enabled: true },
    { id: 'requests', enabled: true },
    { id: 'news', enabled: true },
    { id: 'events', enabled: true },
  ],
  quietHours: { enabled: true, from: '22:00', to: '08:00' },
  language: 'RU' as const,
  fontSize: 'NORMAL' as const,
  reduceMotion: false,
  voiceAssistant: true,
  updatedAt: new Date('2026-11-11T10:00:00.000Z'),
};

vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => ({
    user: { id: 'auth-anna', login: 'anna', role: 'STUDENT' as const },
    session: { id: 'sess-current' },
  })),
  requireUser: vi.fn(async () => ({ id: 'auth-anna', login: 'anna', role: 'STUDENT' as const })),
  requireStaff: vi.fn(async () => ({ id: 'x', login: 'x', role: 'STAFF' as const })),
  listActiveUserSessions: vi.fn(async () => []),
}));
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ host: 'localhost:3000' })),
  cookies: vi.fn(async () => new Map()),
}));
vi.mock('@/server/data/mcp', () => ({
  getOwnMcpTokenView: vi.fn(async () => null),
}));
vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => studentCtx),
  getOwnProfile: vi.fn(async () => null),
  getOwnSettings: vi.fn(async () => annaSettings),
}));
vi.mock('@/server/data/db', () => ({ dataDb: {} }));

/** Cookie-хранилище для теста: замена реализации vi.fn-мока cookies(). */
async function setCookieJar(jar: Record<string, string>): Promise<void> {
  const { cookies } = await import('next/headers');
  vi.mocked(cookies).mockResolvedValue(
    new Map(Object.entries(jar).map(([name, value]) => [name, { name, value }])) as never,
  );
}

// ── классы на <html> ────────────────────────────────────────────────────────

describe('DIG-86: классы на <html> по кукам', () => {
  it('a11yClasses: пусто → классов нет, вкл. → a11y-large-text / a11y-no-effects', () => {
    expect(a11yClasses(DEFAULT_A11Y_PREFS)).toEqual([]);
    expect(a11yClasses({ largeText: true, noEffects: false })).toEqual(['a11y-large-text']);
    expect(a11yClasses({ largeText: false, noEffects: true })).toEqual(['a11y-no-effects']);
    expect(a11yClasses({ largeText: true, noEffects: true })).toEqual([
      'a11y-large-text',
      'a11y-no-effects',
    ]);
  });

  it('root layout читает cookie и ставит оба класса на <html> (server-side)', async () => {
    await setCookieJar({ 'du-a11y': 'large-text,no-effects' });
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

    expect(html).toMatch(/<html lang="ru" class="[^"]*a11y-large-text[^"]*"/);
    expect(html).toMatch(/<html lang="ru" class="[^"]*a11y-no-effects[^"]*"/);
    // базовые классы каркаса не потеряны
    expect(html).toMatch(/<html lang="ru" class="[^"]*--font-inter[^"]*"/);
  });

  it('root layout без cookie не ставит a11y-классы', async () => {
    await setCookieJar({});
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
    expect(html).not.toContain('a11y-large-text');
    expect(html).not.toContain('a11y-no-effects');
  });
});

// ── CSS-контракт globals.css ────────────────────────────────────────────────

describe('DIG-86: CSS-контракт a11y-режима (globals.css)', () => {
  const css = read('src/app/globals.css');

  it('html.a11y-large-text увеличивает базовый размер шрифта ≥ 112,5% (rem-масштаб)', () => {
    const rule = css.match(/html\.a11y-large-text[^{]*\{[^}]*\}/);
    expect(rule, 'правило html.a11y-large-text найдено в globals.css').toBeTruthy();
    const size = rule?.[0].match(/font-size:\s*([\d.]+)%/);
    expect(size, 'font-size задан в %').toBeTruthy();
    expect(Number(size?.[1])).toBeGreaterThanOrEqual(112.5);
  });

  it('a11y-режим приоритетнее «Вид → размер шрифта» (font-lg / font-xl из dark.css)', () => {
    // селекторы с двумя классами: специфичность выше html.font-lg / html.font-xl
    expect(css).toContain('html.a11y-large-text.font-lg');
    expect(css).toContain('html.a11y-large-text.font-xl');
    // сам источник 18px/20px не тронут
    expect(read('src/app/themes/dark.css')).toContain('html.font-lg');
  });

  it('усиленные веса и крупные отступы: body 500+, line-height > 1.5, list padding', () => {
    expect(css).toMatch(/html\.a11y-large-text\s+body\s*\{[^}]*font-weight:\s*(?:5\d\d|[6-9]\d\d)/);
    const line = css.match(/html\.a11y-large-text[^{]*(?:p|li)[^{]*\{[^}]*line-height:\s*([\d.]+)/);
    expect(line, 'line-height усилен').toBeTruthy();
    expect(Number(line?.[1])).toBeGreaterThan(1.5);
    expect(css).toMatch(/html\.a11y-large-text\s+(?:ul|ol)[^{]*\{[^}]*padding-left/);
  });

  it('html.a11y-no-effects: transition-duration: 0 и animation: none на всех элементах', () => {
    expect(css).toMatch(/html\.a11y-no-effects[^{]*\{[^}]*transition-duration:\s*0(?:ms|s)/);
    expect(css).toMatch(/html\.a11y-no-effects[^{]*\{[^}]*animation:\s*none/);
  });

  it('html.a11y-no-effects: тени отключены', () => {
    expect(css).toMatch(/html\.a11y-no-effects[^{]*\{[^}]*box-shadow:\s*none/);
  });

  it('контент никогда не скрыт: reveal-секции видимы в режиме без эффектов', () => {
    expect(css).toMatch(/html\.a11y-no-effects\s+\.reveal\s*\{[^}]*opacity:\s*1/);
  });

  it('режим НЕ спрятан за prefers-reduced-motion — независим от системной настройки', () => {
    // DIG-100: после блока DIG-86 в конец файла добавлен слой plain-версии
    // (свой media-блок 360px) — контракт DIG-86 проверяем по его блоку
    // (от маркера DIG-86 до маркера DIG-100), требование не ослаблено.
    const dig100 = css.indexOf('DIG-100');
    const a11yBlock = css.slice(css.indexOf('DIG-86'), dig100 === -1 ? undefined : dig100);
    expect(a11yBlock.length).toBeGreaterThan(100);
    expect(a11yBlock).not.toContain('@media');
    // системные механизмы не тронуты и продолжают работать сами
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    expect(read('src/app/themes/dark.css')).toContain('html.reduce-motion');
  });
});

// ── вкладка «Доступность» на /settings ──────────────────────────────────────

describe('DIG-86: вкладка «Настройки → Доступность»', () => {
  it('добавлена в реестр вкладок (?tab=accessibility открывается)', () => {
    const registry = read('src/lib/settings-tabs.ts');
    expect(registry).toContain("'accessibility'");
  });

  it('рендерит блок «Крупный текст и без эффектов» с двумя клавиатурными тумблерами', async () => {
    await setCookieJar({});
    const { default: SettingsPage } = await import('@/app/(cabinet)/settings/page');
    const { prelude } = await prerenderToNodeStream(
      createElement(
        SettingsPage as ComponentType<{ searchParams?: Promise<Record<string, string>> }>,
        {
          searchParams: Promise.resolve({ tab: 'accessibility' }),
        },
      ),
    );
    let html = '';
    for await (const chunk of prelude) html += String(chunk);

    // вкладка в навигации с корректным href
    expect(html).toContain('href="/settings?tab=accessibility"');
    expect(html).toContain('Доступность');
    // заголовок блока = название режима
    expect(html).toContain('Крупный текст и без эффектов');
    // оба тумблера: role="switch", подписи RU
    expect(html).toContain('Крупный текст');
    expect(html).toContain('Без эффектов');
    const large = html.match(/<button[^>]*aria-label="Крупный текст"[^>]*>/)?.[0] ?? '';
    const flat = html.match(/<button[^>]*aria-label="Без эффектов"[^>]*>/)?.[0] ?? '';
    expect(large).toContain('role="switch"');
    expect(flat).toContain('role="switch"');
    // состояние из cookie (по умолчанию — выключены)
    expect(large).toContain('aria-checked="false"');
    expect(flat).toContain('aria-checked="false"');
  });

  it('состояние тумблеров приходит из cookie du-a11y', async () => {
    await setCookieJar({ 'du-a11y': 'large-text,no-effects' });
    const { default: SettingsPage } = await import('@/app/(cabinet)/settings/page');
    const { prelude } = await prerenderToNodeStream(
      createElement(
        SettingsPage as ComponentType<{ searchParams?: Promise<Record<string, string>> }>,
        {
          searchParams: Promise.resolve({ tab: 'accessibility' }),
        },
      ),
    );
    let html = '';
    for await (const chunk of prelude) html += String(chunk);

    const large = html.match(/<button[^>]*aria-label="Крупный текст"[^>]*>/)?.[0] ?? '';
    const flat = html.match(/<button[^>]*aria-label="Без эффектов"[^>]*>/)?.[0] ?? '';
    expect(large).toContain('aria-checked="true"');
    expect(flat).toContain('aria-checked="true"');
  });
});

// ── i18n-паритет RU/EN ──────────────────────────────────────────────────────

describe('DIG-86: i18n RU/EN', () => {
  const A11Y_KEYS = [
    'settings.tab.accessibility',
    'settings.a11yTitle',
    'settings.a11yHint',
    'settings.a11yLargeText',
    'settings.a11yLargeTextHint',
    'settings.a11yNoEffects',
    'settings.a11yNoEffectsHint',
    'settings.a11ySaved',
    'settings.a11yIdle',
  ] as const;

  it('все ключи a11y-режима есть в RU и EN, непустые', () => {
    for (const key of A11Y_KEYS) {
      expect(ru[key], `RU: ${key}`).toBeTruthy();
      expect((ru[key] as string).length).toBeGreaterThan(0);
      expect(en[key], `EN: ${key}`).toBeTruthy();
      expect((en[key] as string).length).toBeGreaterThan(0);
    }
    // наборы ключей словарей по-прежнему идентичны (паритет не сломан)
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });

  it('RU-подписи канонические', () => {
    expect(ru['settings.tab.accessibility']).toBe('Доступность');
    expect(ru['settings.a11yTitle']).toBe('Крупный текст и без эффектов');
    expect(ru['settings.a11yLargeText']).toBe('Крупный текст');
    expect(ru['settings.a11yNoEffects']).toBe('Без эффектов');
  });

  it('EN-подписи переведены', () => {
    expect(en['settings.tab.accessibility']).toBe('Accessibility');
    expect(en['settings.a11yTitle']).toBe('Large text and no effects');
    expect(en['settings.a11yLargeText']).toBe('Large text');
    expect(en['settings.a11yNoEffects']).toBe('No effects');
  });
});
