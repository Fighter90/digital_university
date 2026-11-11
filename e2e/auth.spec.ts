import { expect, test } from '@playwright/test';

// DIG-11 — auth behaviours that do not need the database yet:
// middleware gating of the cabinet and the login screen contract
// (labels, disabled «Госуслуги (демо)» button, concept banner).

test('protected cabinet redirects an anonymous visitor to /login with next', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Вход в кабинет');
});

test('login form is functional: labels, autocomplete, demo Gosuslugi button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Логин')).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Пароль')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.getByLabel('Пароль')).toHaveAttribute('type', 'password');

  const gosuslugi = page.getByRole('button', { name: /Госуслуги/ });
  await expect(gosuslugi).toBeVisible();
  await expect(gosuslugi).toBeDisabled();
  await expect(gosuslugi).toContainText('демо');

  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeEnabled();
});

test('wrong credentials report the uniform error without revealing the cause', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Логин').fill('no-such-user');
  await page.getByLabel('Пароль').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  const alert = page.locator('main').getByRole('alert');
  await expect(alert).toContainText('Неверный логин или пароль');
  await expect(alert).not.toContainText('no-such-user');
});
