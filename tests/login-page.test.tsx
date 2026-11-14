// DIG-55 — контракт страницы /login после выхода:
// - ?signedOut=1 → role="status"-сообщение «Вы вышли из кабинета…»;
// - без параметра сообщения нет;
// - залогиненный посетитель по-прежнему уходит на /dashboard (guard DIG-11).
// Рендер через prerenderToNodeStream: страница — async server component
// (паттерн cabinet-shell.test.ts).
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => null),
}));
vi.mock('@/server/data', () => ({
  ensureAppData: vi.fn(async () => {}),
}));
vi.mock('@/server/actions/auth', () => ({
  signInAction: vi.fn(async () => null),
}));
const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import LoginPage from '@/app/(auth)/login/page';

// LoginPage — async server component (RSC): в клиентских React-типах
// createElement её пропсы не выводит, поэтому приводим к обычному ComponentType.
const LoginPageAsComponent = LoginPage as unknown as React.ComponentType<{
  searchParams: Promise<Record<string, string>>;
}>;

async function renderPage(searchParams: Record<string, string>): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(LoginPageAsComponent, { searchParams: Promise.resolve(searchParams) }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html;
}

describe('LoginPage — сообщение об успешном выходе (DIG-55)', () => {
  it('?signedOut=1 показывает role="status" сообщение об успешном выходе', async () => {
    const html = await renderPage({ signedOut: '1' });
    expect(html).toContain('Вы вышли из кабинета');
    expect(html).toContain('role="status"');
  });

  it('без параметра сообщение не показывается', async () => {
    const html = await renderPage({});
    expect(html).not.toContain('Вы вышли из кабинета');
    expect(html).not.toContain('role="status"');
  });

  it('не подменяет guard: залогиненного продолжает уводить на /dashboard', async () => {
    const { getAuthSession } = await import('@/server/auth/session');
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      session: { tokenHash: 'h', createdAt: null, lastSeenAt: null, userAgent: 'vitest' },
      user: { id: 'u1', login: 'anna', role: 'STUDENT' as const, passwordHash: 'x' },
    } as never);
    await renderPage({ signedOut: '1' });
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });
});
