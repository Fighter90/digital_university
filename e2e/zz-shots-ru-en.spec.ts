import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// DIG-89 — EN-локализация часть 3: разделы grades/deanery/feedback/finance/
// events/msp/dpo/people/news/profile/settings/tasks — EN-рендер без кириллицы.

const BASE = process.env.SHOT_BASE ?? 'https://ostrovok.store';
const OUT = '/Users/sergejemelanov/Projects/digital_university/docs/shots';

const ROUTES: Array<{ name: string; path: string; wait?: number }> = [
  { name: 'grades', path: '/grades', wait: 2500 },
  { name: 'gradebook', path: '/grades/gradebook', wait: 2000 },
  { name: 'session', path: '/grades/session', wait: 1500 },
  { name: 'deanery', path: '/deanery', wait: 1500 },
  { name: 'feedback', path: '/feedback', wait: 1500 },
  { name: 'finance', path: '/finance', wait: 1500 },
  { name: 'events', path: '/events', wait: 1500 },
  { name: 'msp', path: '/msp', wait: 1500 },
  { name: 'dpo', path: '/dpo', wait: 1500 },
  { name: 'people', path: '/people', wait: 1500 },
  { name: 'news', path: '/news', wait: 1500 },
  { name: 'profile', path: '/profile', wait: 1500 },
  { name: 'settings', path: '/settings', wait: 1500 },
  { name: 'tasks', path: '/tasks', wait: 1500 },
];

for (const lang of ['en', 'ru'] as const) {
  test.describe(`section shots ${lang}`, () => {
    test.use({ timezoneId: 'Europe/Moscow' });
    test.setTimeout(240000);
    test(`sections ${lang}`, async ({ page }) => {
      mkdirSync(`${OUT}/${lang}`, { recursive: true });
      await page
        .context()
        .addCookies([{ name: 'du-locale', value: lang, domain: 'ostrovok.store', path: '/' }]);
      await page.goto(`${BASE}/login`);
      await page.getByLabel('Логин').fill('anna.smirnova');
      await page.getByRole('textbox', { name: 'Пароль' }).fill('anna-demo-2026');
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await page.waitForTimeout(4000);
      for (const s of ROUTES) {
        try {
          await page.goto(`${BASE}${s.path}`);
          await page.waitForTimeout(s.wait ?? 1500);
          await page.screenshot({ path: `${OUT}/${lang}/${s.name}.png`, fullPage: false });
        } catch {
          /* продолжаем */
        }
      }
    });
  });
}
