import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// DIG-7x — видео: полный прогон кабинета под студентом (RU и EN),
// медленный темп для съёмки. recordVideo пишет webm на сцену.

const BASE = process.env.VIDEO_BASE ?? 'https://ostrovok.store';
const OUT = process.env.VIDEO_OUT ?? 'video';

type Scene = { name: string; steps: Array<() => Promise<void>> };

async function login(page: Page, login: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Логин').fill(login);
  await page.getByRole('textbox', { name: 'Пароль' }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForTimeout(3500);
}

function studentRuScenes(page: Page): Scene[] {
  const go = (path: string) => async () => {
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(3200);
  };
  return [
    { name: '01-dashboard', steps: [go('/dashboard')] },
    { name: '02-today', steps: [go('/dashboard')] },
    { name: '03-schedule-day', steps: [go('/schedule?view=day')] },
    { name: '04-schedule-week', steps: [go('/schedule?view=week')] },
    { name: '05-lesson-details', steps: [go('/schedule?view=day')] },
    { name: '06-grades-summary', steps: [go('/grades')] },
    { name: '07-gradebook', steps: [go('/grades/gradebook')] },
    { name: '08-session', steps: [go('/grades/session')] },
    { name: '09-requests-list', steps: [go('/requests')] },
    { name: '10-request-card', steps: [go('/requests/%D0%97%D0%94-2026-000001')] },
    { name: '11-deanery', steps: [go('/deanery')] },
    { name: '12-feedback', steps: [go('/feedback')] },
    { name: '13-tasks', steps: [go('/tasks')] },
    { name: '14-notifications', steps: [go('/notifications')] },
    { name: '15-news', steps: [go('/news')] },
    { name: '16-people', steps: [go('/people')] },
    { name: '17-events', steps: [go('/events')] },
    { name: '18-msp', steps: [go('/msp')] },
    { name: '19-dpo', steps: [go('/dpo')] },
    { name: '20-finance', steps: [go('/finance')] },
    { name: '21-help', steps: [go('/help')] },
    { name: '22-guide', steps: [go('/guide')] },
    { name: '23-assistant', steps: [go('/ai-assistant')] },
    { name: '24-profile', steps: [go('/profile')] },
    { name: '25-settings', steps: [go('/settings')] },
    { name: '26-services', steps: [go('/services')] },
  ];
}

for (const lang of ['ru', 'en'] as const) {
  test.describe(`video student ${lang}`, () => {
    test.use({
      viewport: { width: 1440, height: 900 },
      timezoneId: 'Europe/Moscow',
    });
    test(`full walkthrough ${lang}`, async ({ page }) => {
      mkdirSync(`${OUT}/${lang}/raw`, { recursive: true });
      await login(page, 'anna.smirnova', 'anna-demo-2026');
      const scenes = studentRuScenes(page);
      for (const scene of scenes) {
        for (const step of scene.steps) await step();
      }
      await page.context().close();
    });
  });
}

// EN-версия: те же сцены, англоязычный интерфейс (cookie du-locale=en).
for (const lang of ['en'] as const) {
  test.describe(`video student EN`, () => {
    test.use({
      viewport: { width: 1440, height: 900 },
    });
    test('full walkthrough EN', async ({ page }) => {
      await page
        .context()
        .addCookies([{ name: 'du-locale', value: 'en', domain: 'ostrovok.store', path: '/' }]);
      await login(page, 'anna.smirnova', 'anna-demo-2026');
      for (const path of [
        '/dashboard',
        '/schedule?view=week',
        '/grades',
        '/requests',
        '/deanery',
        '/events',
        '/msp',
        '/dpo',
        '/finance',
        '/help',
        '/guide',
        '/ai-assistant',
        '/profile',
        '/settings',
      ]) {
        await page.goto(`${BASE}${path}`);
        await page.waitForTimeout(3200);
      }
    });
  });
}
