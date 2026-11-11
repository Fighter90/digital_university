// DIG-18 — contract of the login screen (Figma «02 · Вход»):
// - chips «Тестовые аккаунты» prefill the form with the canonical demo
//   credentials (anna / ilya / maria from src/server/data/demo-seed.ts);
// - the password field has a «показать/скрыть» toggle;
// - «Забыли пароль?» leads to the public /forgot-password stub that explains
//   the deanery-based recovery of the concept;
// - the a11y/server contract from DIG-11 is preserved: autocomplete attrs,
//   uniform error through role="alert", disabled demo Gosuslugi button,
//   safe `?next=` forwarding.
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { actionResult } = vi.hoisted(() => ({ actionResult: { current: null as unknown } }));

vi.mock('@/server/actions/auth', () => ({
  // jsdom has no server runtime: the action is only ever called through the
  // form; the test controls its result through the hoisted holder.
  signInAction: async () => actionResult.current,
}));

import { ConceptBanner } from '@/components/concept-banner';
import { LoginForm, TEST_ACCOUNTS } from '@/components/auth/login-form';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';

afterEach(cleanup);

function loginInput() {
  return screen.getByLabelText('Логин') as HTMLInputElement;
}
function passwordInput() {
  return screen.getByLabelText('Пароль') as HTMLInputElement;
}
function fillCredentials(login: string, password: string) {
  fireEvent.input(loginInput(), { target: { value: login } });
  fireEvent.input(passwordInput(), { target: { value: password } });
}

describe('LoginForm — test account chips (DIG-18)', () => {
  it('renders three canonical demo personas as chips', () => {
    render(<LoginForm />);
    expect(TEST_ACCOUNTS).toHaveLength(3);
    for (const account of TEST_ACCOUNTS) {
      expect(screen.getByRole('button', { name: account.label })).toBeVisible();
    }
  });

  it('clicking a student chip prefills login and password', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: TEST_ACCOUNTS[0]!.label }));
    expect(loginInput().value).toBe('anna');
    expect(passwordInput().value).toBe('demo-anna-2026');
  });

  it('the staff chip prefills the staff account', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /Сотрудник деканата/ }));
    expect(loginInput().value).toBe('maria');
    expect(passwordInput().value).toBe('demo-staff-2026');
  });

  it('chip logins match the seeded demo credentials by role', () => {
    const [anna, ilya, maria] = TEST_ACCOUNTS;
    expect(anna).toMatchObject({ login: 'anna', password: 'demo-anna-2026', role: 'STUDENT' });
    expect(ilya).toMatchObject({ login: 'ilya', password: 'demo-ilya-2026', role: 'STUDENT' });
    expect(maria).toMatchObject({ login: 'maria', password: 'demo-staff-2026', role: 'STAFF' });
  });
});

describe('LoginForm — password visibility toggle (DIG-18)', () => {
  it('switches the input type password ⇄ text and announces the state', () => {
    render(<LoginForm />);
    const toggle = screen.getByRole('button', { name: 'Показать пароль' });
    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(passwordInput()).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Скрыть пароль' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
    expect(passwordInput()).toHaveAttribute('type', 'password');
  });
});

describe('LoginForm — forgot password link (DIG-18)', () => {
  it('points to the public stub screen', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Забыли пароль?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('LoginForm — DIG-11 contract is preserved', () => {
  it('keeps labels, autocomplete, demo Gosuslugi button and the h1', () => {
    render(<LoginForm />);
    expect(screen.getByRole('heading', { level: 1, name: 'Вход в кабинет' })).toBeVisible();
    expect(loginInput()).toHaveAttribute('autocomplete', 'username');
    expect(passwordInput()).toHaveAttribute('autocomplete', 'current-password');
    const gosuslugi = screen.getByRole('button', { name: /Госуслуги/ });
    expect(gosuslugi).toBeDisabled();
    expect(gosuslugi).toHaveTextContent('демо');
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
  });

  it('forwards the safe ?next= value as a hidden input', () => {
    render(<LoginForm next="/grades" />);
    const next = document.querySelector('input[name="next"]') as HTMLInputElement;
    expect(next).not.toBeNull();
    expect(next.value).toBe('/grades');
    expect(next).toHaveAttribute('type', 'hidden');
  });

  it('surfaces the uniform error through role="alert"', async () => {
    actionResult.current = { error: 'Неверный логин или пароль.' };
    render(<LoginForm />);
    fillCredentials('anna', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Неверный логин или пароль.');
    actionResult.current = null;
  });

  it('renders the pending state on the submit button', async () => {
    let resolveAction: () => void = () => {};
    actionResult.current = new Promise<null>((resolve) => {
      resolveAction = () => resolve(null);
    });
    render(<LoginForm />);
    fillCredentials('anna', 'demo-anna-2026');
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    const pending = await screen.findByRole('button', { name: 'Входим…' });
    expect(pending).toBeDisabled();
    resolveAction();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled());
    actionResult.current = null;
  });
});

describe('ForgotPasswordPage — public stub (DIG-18)', () => {
  // Плашку концепта на реальной странице даёт корневой layout — в тесте
  // воспроизводим ту же композицию.
  it('explains the deanery-based recovery and links back to the login', () => {
    render(
      <>
        <ConceptBanner />
        <ForgotPasswordPage />
      </>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Восстановление пароля' })).toBeVisible();
    expect(screen.getByText(/через деканат/)).toBeVisible();
    expect(screen.getByRole('link', { name: /Вернуться ко входу/ })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('keeps the contest concept note visible', () => {
    render(
      <>
        <ConceptBanner />
        <ForgotPasswordPage />
      </>,
    );
    expect(screen.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
  });
});
