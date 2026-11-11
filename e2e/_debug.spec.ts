import { expect, test } from '@playwright/test';

// ВРЕМЕННЫЙ отладочный спек: поймать RSC-ответ переключателя видов.
test('debug switcher rsc body', async ({ page }) => {
  let rscBody = '';
  page.on('response', async (res) => {
    if (res.url().includes('view=month') && res.url().includes('_rsc')) {
      rscBody = await res.text();
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE-ERR:', msg.text().slice(0, 600));
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  await page.goto('/schedule');
  const switcher = page.getByTestId('view-switcher-desktop');
  await switcher.getByRole('radio', { name: 'Месяц' }).click();
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  console.log('body len:', rscBody.length);
  console.log('body head:', JSON.stringify(rscBody.slice(0, 500)));
  console.log('has month-grid:', rscBody.includes('month-grid'));
});
