import { expect, test } from '@playwright/test';

// DIG-6 smoke: каркас приложения, плашка «Концепт», вход и health-check API.

test('home page shows the contest concept banner', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Цифровой деканат');
});

test('login placeholder renders the form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Логин')).toBeVisible();
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
});

test('health API responds ok (DIG-50: публикует активный auth-store)', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toEqual({ ok: true, authStore: expect.any(String) });
});
