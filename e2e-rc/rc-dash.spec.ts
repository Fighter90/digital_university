import { test, expect } from '@playwright/test';
test('rc-design: dashboard скрин', async ({ page }) => {
  await page.goto('http://localhost:3311/login');
  await page.getByLabel('Логин', { exact: true }).fill('anna.smirnova');
  await page.getByLabel('Пароль', { exact: true }).fill('anna-demo-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/rc-dash-new.png' });
});
