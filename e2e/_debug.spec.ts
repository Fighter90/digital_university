import { expect, test } from '@playwright/test';

// ВРЕМЕННЫЙ отладочный спек: router.push из ViewSwitcher vs из WeekView.
test('debug: week-arrow push vs switcher push', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('DEBUG') || msg.type() === 'error') logs.push(`[${msg.type()}] ${text.slice(0, 300)}`);
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  await page.goto('/schedule');
  await page.waitForTimeout(1000);

  const historyLen = () => page.evaluate(() => window.history.length);

  // 1) известный рабочий push: стрелка «следующая неделя» (Link, не push!)
  //    — поэтому проверяем КЛАВИАТУРУ (ArrowRight = router.push из WeekView)
  const len0 = await historyLen();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(2000);
  console.log('after ArrowRight URL:', page.url(), 'hist:', len0, '->', await historyLen());

  // 2) переключатель: клик «Месяц» (router.push из ViewSwitcher)
  const switcher = page.getByTestId('view-switcher-desktop');
  const len1 = await historyLen();
  await switcher.getByRole('radio', { name: 'Месяц' }).click();
  await page.waitForTimeout(2500);
  console.log('after Месяц click URL:', page.url(), 'hist:', len1, '->', await historyLen());
  console.log('month-grid visible:', await page.getByTestId('month-grid').isVisible().catch(() => false));
  for (const line of logs) console.log('BROWSER:', line);
  expect(true).toBe(true);
});
