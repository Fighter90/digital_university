import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// DIG-48 видео — кабинет сотрудника деканата: очередь, карточка заявки,
// обращения, объявления. RU-прогон для съёмки.

const BASE = process.env.VIDEO_BASE ?? 'https://ostrovok.store';
const OUT = process.env.VIDEO_OUT ?? 'video';

test.describe('video staff RU', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Europe/Moscow',
  });
  test('staff walkthrough RU', async ({ page }) => {
    mkdirSync('video/ru/raw-staff', { recursive: true });
    await page.goto(`${BASE}/login`);
    await page.getByLabel('Логин').fill('dean.kovaleva');
    await page.getByRole('textbox', { name: 'Пароль' }).fill('dean-demo-2026');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForTimeout(4000);
    for (const path of ['/staff', '/staff/requests', '/staff/appeals', '/staff/announcements']) {
      await page.goto(`${BASE}${path}`);
      await page.waitForTimeout(3500);
    }
  });
});

test.describe('video staff EN', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
  });
  test('staff walkthrough EN', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel('Логин').fill('dean.kovaleva');
    await page.getByRole('textbox', { name: 'Пароль' }).fill('dean-demo-2026');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForTimeout(4000);
    for (const path of ['/staff', '/staff/requests', '/staff/appeals', '/staff/announcements']) {
      await page.goto(`${BASE}${path}`);
      await page.waitForTimeout(3500);
    }
  });
});
