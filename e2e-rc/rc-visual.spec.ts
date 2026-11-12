import { test, expect } from '@playwright/test';
test('rc-design: login + dashboard визуально', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/rc-login.png' });
  await page.getByLabel('Логин', { exact: true }).fill('anna.smirnova');
  await page.getByLabel('Пароль', { exact: true }).fill('anna-demo-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/rc-dashboard.png' });
  const body = (await page.textContent('body')) ?? '';
  expect(body.length).toBeGreaterThan(500);
});
