import { test, expect } from '@playwright/test';
test('rc-design: login визуально (отдельный скрин)', async ({ page }) => {
  await page.goto('http://localhost:3311/login');
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/rc-login-new.png' });
});
