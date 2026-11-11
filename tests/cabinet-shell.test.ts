// DIG-14 — каркас кабинета: верхняя панель, боковое меню, мобильная навигация.
// Пиним контракты приёмки: состав меню и таб-бара, подсветка активного раздела
// (единая логика для меню и таб-бара), серверная проверка сессии в layout,
// skip-link, safe-area таб-бара и обновление счётчика уведомлений без перезагрузки.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CABINET_SECTIONS,
  MORE_SECTIONS,
  TAB_SECTIONS,
  resolveActiveSection,
  resolveActiveTab,
} from '@/components/shell/nav-items';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('nav config (cabinet shell)', () => {
  it('exposes the 8 mandated cabinet sections with unique hrefs', () => {
    const expected = [
      ['/dashboard', 'Главная'],
      ['/schedule', 'Расписание'],
      ['/grades', 'Успеваемость'],
      ['/requests', 'Заявки и справки'],
      ['/notifications', 'Уведомления'],
      ['/deanery', 'Связь с деканатом'],
      ['/ai-assistant', 'AI-ассистент'],
      ['/profile', 'Профиль'],
    ] as const;
    for (const [href, label] of expected) {
      const section = CABINET_SECTIONS.find((s) => s.href === href);
      expect(section, `section ${href} missing`).toBeTruthy();
      expect(section?.label, `label of ${href}`).toBe(label);
    }
    const hrefs = CABINET_SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('mobile tab bar is exactly: Главная, Расписание, Оценки, Заявки, Ещё', () => {
    expect(TAB_SECTIONS.map((t) => t.label)).toEqual([
      'Главная',
      'Расписание',
      'Оценки',
      'Заявки',
      'Ещё',
    ]);
  });

  it('«Ещё» covers Уведомления, Связь с деканатом, AI-ассистент, Профиль, Настройки', () => {
    expect(MORE_SECTIONS.map((s) => s.href)).toEqual([
      '/notifications',
      '/deanery',
      '/ai-assistant',
      '/profile',
      '/settings',
    ]);
  });
});

describe('resolveActiveSection (shared active-state logic)', () => {
  it('matches exact href and nested paths', () => {
    expect(resolveActiveSection('/dashboard', CABINET_SECTIONS)).toBe('/dashboard');
    expect(resolveActiveSection('/schedule/week', CABINET_SECTIONS)).toBe('/schedule');
    expect(resolveActiveSection('/requests/42', CABINET_SECTIONS)).toBe('/requests');
    expect(resolveActiveSection('/notifications', CABINET_SECTIONS)).toBe('/notifications');
  });

  it('does not false-positive on prefixes of other routes', () => {
    expect(resolveActiveSection('/schedule-extra', CABINET_SECTIONS)).toBeNull();
    expect(resolveActiveSection('/grades-mock', CABINET_SECTIONS)).toBeNull();
    expect(resolveActiveSection('/totally/unknown', CABINET_SECTIONS)).toBeNull();
  });
});

describe('resolveActiveTab (menu and tab bar stay in sync)', () => {
  it('highlights primary tabs for their own routes', () => {
    expect(resolveActiveTab('/dashboard')).toBe('/dashboard');
    expect(resolveActiveTab('/schedule')).toBe('/schedule');
    expect(resolveActiveTab('/grades')).toBe('/grades');
    expect(resolveActiveTab('/requests')).toBe('/requests');
    expect(resolveActiveTab('/grades/semester/3')).toBe('/grades');
  });

  it('routes the extra sections through the «Ещё» tab', () => {
    for (const href of MORE_SECTIONS.map((s) => s.href)) {
      expect(resolveActiveTab(href), `${href} must highlight «Ещё»`).toBe('/more');
    }
    expect(resolveActiveTab('/more')).toBe('/more');
    expect(resolveActiveTab('/unknown')).toBeNull();
  });
});

describe('source invariants (acceptance criteria pinned in code)', () => {
  it('cabinet layout guards the session server-side before rendering the shell', () => {
    const layout = read('src/app/(cabinet)/layout.tsx');
    expect(layout).toMatch(/requireUser/);
    expect(layout).toMatch(/<Shell/);
    expect(layout).toMatch(/await/);
  });

  it('tab bar respects the iPhone safe area', () => {
    const tabBar = read('src/components/shell/tab-bar.tsx');
    expect(tabBar).toContain('env(safe-area-inset-bottom)');
  });

  it('shell renders a skip link «К содержимому» targeting the main region', () => {
    const shell = read('src/components/shell/shell.tsx');
    expect(shell).toContain('К содержимому');
    expect(shell).toContain('#main-content');
    expect(shell).toMatch(/id="main-content"/);
  });

  it('unread counter refreshes without reload (interval ≤ 60 s)', () => {
    const badge = read('src/components/shell/unread-badge.tsx');
    expect(badge).toMatch(/60_000|60000|POLL_MS/);
    expect(badge).toMatch(/setInterval|setTimeout/);
  });
});
