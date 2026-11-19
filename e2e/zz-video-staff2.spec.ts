import { test } from '@playwright/test';

const BASE = process.env.VIDEO_BASE ?? 'https://ostrovok.store';
const OUTDIR = process.env.VIDEO_OUTDIR ?? '/tmp/video-raw-staff';

test.describe('staff video RU', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('staff RU', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel('Логин').fill('dean.kovaleva');
    await page.getByRole('textbox', { name: 'Пароль' }).fill('dean-demo-2026');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForTimeout(4000);
    for (const p of ['/staff', '/staff/requests', '/staff/appeals', '/staff/announcements']) {
      await page.goto(`${BASE}${p}`);
      await page.waitForTimeout(3500);
    }
  });
});
