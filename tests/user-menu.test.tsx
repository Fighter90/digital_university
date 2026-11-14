// DIG-55 — «Выйти» в меню аватара обязан завершать сессию, а не просто вести
// ссылкой на /login (регрессия DIG-14 → «не разлогинивает на проде»):
// - пункт «Выйти» — кнопка submit внутри формы с server action signOutAction
//   (action удаляет сессию в БД и обе куки, затем редирект на /login?signedOut=1);
// - остальные пункты остаются ссылками (Профиль, Настройки);
// - в меню нет ссылки «Выйти» (former <Link href="/login"> placeholder).
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { signOutActionMock } = vi.hoisted(() => ({
  signOutActionMock: vi.fn(async () => {}),
}));

vi.mock('@/server/actions/auth', () => ({
  // jsdom has no server runtime: the action is only ever called through the
  // form submit; the test pins exactly that wiring.
  signOutAction: signOutActionMock,
}));

import { UserMenu } from '@/components/shell/user-menu';

const USER = {
  name: 'Анна Ковалёва',
  group: 'ПИ-21',
  email: 'anna@example.edu',
  role: 'STUDENT' as const,
};

afterEach(cleanup);
beforeEach(() => {
  signOutActionMock.mockClear();
});

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Меню пользователя' }));
}

describe('UserMenu — «Выйти» завершает сессию через server action (DIG-55)', () => {
  it('«Выйти» — кнопка submit в форме с signOutAction, а не ссылка на /login', () => {
    render(<UserMenu user={USER} />);
    openMenu();

    const item = screen.getByRole('menuitem', { name: 'Выйти' });
    expect(item.tagName).toBe('BUTTON');
    expect(item).toHaveAttribute('type', 'submit');
    // Кнопка обязана жить внутри формы с server action (RSF postback).
    expect(item.closest('form'), '«Выйти» должен находиться внутри <form action>').not.toBeNull();
    // Регрессия DIG-14: ссылкой на /login сессию не завершить.
    expect(screen.queryByRole('link', { name: 'Выйти' })).toBeNull();
  });

  it('клик по «Выйти» вызывает signOutAction (удаление сессии + кук на сервере)', () => {
    render(<UserMenu user={USER} />);
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Выйти' }));
    expect(signOutActionMock).toHaveBeenCalledTimes(1);
  });

  it('остальные пункты меню остаются ссылками и не трогают сессию', () => {
    render(<UserMenu user={USER} />);
    openMenu();

    expect(screen.getByRole('menuitem', { name: 'Профиль' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('menuitem', { name: 'Настройки' })).toHaveAttribute('href', '/settings');
    expect(signOutActionMock).not.toHaveBeenCalled();
  });
});
