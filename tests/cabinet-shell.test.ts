// DIG-14 — каркас кабинета: верхняя панель, боковое меню, мобильная навигация.
// Пиним контракты приёмки: состав меню и таб-бара, подсветка активного раздела
// (единая логика для меню и таб-бара) и поведение страниц (композишн внутри
// main-региона Shell).
import { describe, expect, it } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CABINET_SECTIONS,
  MORE_SECTIONS,
  TAB_SECTIONS,
  resolveActiveSection,
  resolveActiveTab,
} from '@/components/shell/nav-items';
import DashboardPage from '@/app/(cabinet)/dashboard/page';
import SchedulePage from '@/app/(cabinet)/schedule/page';
import GradesPage from '@/app/(cabinet)/grades/page';
import RequestsPage from '@/app/(cabinet)/requests/page';
import NotificationsPage from '@/app/(cabinet)/notifications/page';
import DeaneryPage from '@/app/(cabinet)/deanery/page';
import AiAssistantPage from '@/app/(cabinet)/ai-assistant/page';
import ProfilePage from '@/app/(cabinet)/profile/page';
import SettingsPage from '@/app/(cabinet)/settings/page';
import MorePage from '@/app/(cabinet)/more/page';

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

// Поведенческий рендер всех страниц (cabinet): единственный main-регион
// принадлежит Shell (#main-content), страницы не должны заводить свой <main>,
// иначе получится невалидный вложенный landmark (ревью DIG-14, раунд 1).
describe('cabinet pages render inside the shell main region', () => {
  const PAGES: Array<[string, ComponentType]> = [
    ['/dashboard', DashboardPage],
    ['/schedule', SchedulePage],
    ['/grades', GradesPage],
    ['/requests', RequestsPage],
    ['/notifications', NotificationsPage],
    ['/deanery', DeaneryPage],
    ['/ai-assistant', AiAssistantPage],
    ['/profile', ProfilePage],
    ['/settings', SettingsPage],
    ['/more', MorePage],
  ];

  it('no cabinet page renders its own <main> landmark', () => {
    for (const [href, Page] of PAGES) {
      const html = renderToStaticMarkup(createElement(Page));
      expect(html, `${href} must not nest <main> inside the shell main region`).not.toContain(
        '<main',
      );
    }
  });

  it('dashboard keeps its content on a section wrapper', () => {
    const html = renderToStaticMarkup(createElement(DashboardPage));
    expect(html).toContain('<section');
    expect(html).toContain('Кабинет студента');
  });
});
