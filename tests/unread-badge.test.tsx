// DIG-54 — баг позиционирования счётчика непрочитанных: на проде красный
// бейдж «3» висел НАД пунктом «Главная» сайдбара. Причина: UnreadBadge
// абсолютный (absolute -top-0.5 -right-0.5), а в SideNav его обёртка и все
// предки до <aside sticky> были static — бейдж позиционировался относительно
// сайдбара. Контракт после фикса:
//   * колокольчик top-bar — контейнер data-testid="unread-badge", бейдж
//     absolute внутри него (виден на 1440 и 360);
//   * бейдж в строке сайдбара — inline-вариант, никакого absolute
//     (не может «убежать» из строки при любом positioned-предке);
//   * при 0 непрочитанных бейдж не рендерится нигде.
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// SideNav читает активный раздел через usePathname (next/navigation) —
// вне App Router мокаем на «Главную».
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}));

import { UnreadBadge } from '@/components/shell/unread-badge';
import { TopBar } from '@/components/shell/top-bar';
import { SideNav } from '@/components/shell/side-nav';

const USER = {
  id: 'u_test',
  name: 'Анна Ковалёва',
  group: 'ПИ-21',
  email: 'anna@example.edu',
  role: 'STUDENT' as const,
  voiceAssistant: true,
};

/** HTML элемента с data-testid="unread-count" (открывающий тег). */
function badgeTag(html: string): string | null {
  return html.match(/<span[^>]*data-testid="unread-count"[^>]*>/)?.[0] ?? null;
}

describe('UnreadBadge (счётчик непрочитанных)', () => {
  it('скрывается при нуле непрочитанных', () => {
    expect(renderToStaticMarkup(<UnreadBadge count={0} />)).toBe('');
  });

  it('показывает число при положительном счётчике', () => {
    const html = renderToStaticMarkup(<UnreadBadge count={3} />);
    expect(html).toContain('data-testid="unread-count"');
    expect(html).toContain('>3<');
  });

  it('ограничивает отображение «99+»', () => {
    expect(renderToStaticMarkup(<UnreadBadge count={150} />)).toContain('99+');
  });

  it('вариант по умолчанию (колокольчик) — absolute внутри relative-контейнера', () => {
    const tag = badgeTag(renderToStaticMarkup(<UnreadBadge count={3} />));
    expect(tag, 'badge tag').toBeTruthy();
    expect(tag!).toContain('absolute');
  });

  it('inline-вариант (сайдбар) — без absolute: бейдж не покидает строку меню', () => {
    const tag = badgeTag(renderToStaticMarkup(<UnreadBadge count={3} variant="inline" />));
    expect(tag, 'badge tag').toBeTruthy();
    expect(tag!).not.toContain('absolute');
  });
});

describe('TopBar — бейдж внутри контейнера колокольчика (unread-badge)', () => {
  it('кнопка колокольчика — контейнер data-testid="unread-badge" с бейджем внутри', () => {
    const html = renderToStaticMarkup(
      <TopBar user={USER} unreadCount={3} recentNotifications={[]} onOpenSearch={() => {}} />,
    );
    const containerAt = html.indexOf('data-testid="unread-badge"');
    expect(containerAt, 'bell container testid').toBeGreaterThanOrEqual(0);
    const badgeAt = html.indexOf('data-testid="unread-count"');
    expect(badgeAt, 'badge present').toBeGreaterThanOrEqual(0);
    // Бейдж внутри контейнера: после его открытия и до закрывающего </a>.
    expect(badgeAt).toBeGreaterThan(containerAt);
    expect(html.slice(containerAt, badgeAt)).not.toContain('</a>');
  });

  it('при нуле непрочитанных в шапке бейджа нет', () => {
    const html = renderToStaticMarkup(
      <TopBar user={USER} unreadCount={0} recentNotifications={[]} onOpenSearch={() => {}} />,
    );
    expect(html).not.toContain('data-testid="unread-count"');
  });
});

describe('SideNav — бейдж не перекрывает сайдбар (регрессия DIG-54)', () => {
  it('бейдж в строке «Уведомления» — inline, без абсолютного позиционирования', () => {
    const html = renderToStaticMarkup(<SideNav unreadCount={3} />);
    const tag = badgeTag(html);
    expect(tag, 'side-nav badge is rendered').toBeTruthy();
    expect(tag!, 'badge must not be absolutely positioned in the sidebar').not.toContain(
      'absolute',
    );
  });

  it('при нуле непрочитанных в сайдбаре бейджа нет', () => {
    expect(renderToStaticMarkup(<SideNav unreadCount={0} />)).not.toContain(
      'data-testid="unread-count"',
    );
  });
});
