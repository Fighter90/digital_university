import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'https://ostrovok.store';
const OUT = '/Users/sergejemelanov/Projects/digital_university/docs/shots';

const SCENES: Array<{ name: string; path: string; lang?: 'ru' | 'en'; wait?: number }> = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/dashboard', wait: 2500 },
  { name: 'schedule', path: '/schedule?view=day', wait: 2000 },
  { name: 'schedule-week', path: '/schedule?view=week', wait: 2000 },
  { name: 'grades', path: '/grades', wait: 2500 },
  { name: 'requests', path: '/requests', wait: 2000 },
  { name: 'request-card', path: '/requests/%D0%97%D0%94-2026-000001', wait: 2500 },
  { name: 'deanery', path: '/deanery', wait: 2000 },
  { name: 'feedback', path: '/feedback', wait: 1500 },
  { name: 'tasks', path: '/tasks', wait: 1500 },
  { name: 'notifications', path: '/notifications', wait: 1500 },
  { name: 'news', path: '/news', wait: 1500 },
  { name: 'people', path: '/people', wait: 1500 },
  { name: 'events', path: '/events', wait: 1500 },
  { name: 'msp', path: '/msp', wait: 1500 },
  { name: 'msp-card', path: '/msp/konspekt-bot-pdvn', wait: 1500 },
  { name: 'dpo', path: '/dpo', wait: 1500 },
  { name: 'finance', path: '/finance', wait: 1500 },
  { name: 'help', path: '/help', wait: 1500 },
  { name: 'guide', path: '/guide', wait: 2000 },
  { name: 'assistant', path: '/ai-assistant', wait: 2000 },
  { name: 'services', path: '/services', wait: 1500 },
  { name: 'profile', path: '/profile', wait: 1500 },
  { name: 'settings-mcp', path: '/settings?tab=mcp', wait: 2000 },
];

const staff: Array<{ name: string; path: string; wait?: number }> = [
  { name: 'staff-summary', path: '/staff', wait: 2500 },
  { name: 'staff-queue', path: '/staff/requests', wait: 2500 },
  { name: 'staff-appeals', path: '/staff/appeals', wait: 2000 },
  { name: 'staff-announcements', path: '/staff/announcements', wait: 1500 },
];

for (const lang of ['ru', 'en'] as const) {
  test.describe(`shots ${lang}`, () => {
    test.use({ locale: lang === 'en' ? 'en-US' : 'ru-RU', timezoneId: 'Europe/Moscow' });
    test.setTimeout(240000);
    test(`student screens ${lang}`, async ({ page }) => {
      mkdirSync(`${OUT}/${lang}`, { recursive: true });
      await page.goto(`${BASE}/login`);
      await page.getByLabel('Логин').fill('anna.smirnova');
      await page.getByRole('textbox', { name: 'Пароль' }).fill('anna-demo-2026');
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await page.waitForTimeout(4000);
      await page
        .context()
        .addCookies([{ name: 'du-locale', value: lang, domain: 'ostrovok.store', path: '/' }]);
      for (const s of SCENES.filter((x) => x.path !== '/login')) {
        try {
          await page.goto(`${BASE}${s.path}`);
          await page.waitForTimeout(s.wait ?? 1500);
          await page.screenshot({ path: `${OUT}/${lang}/${s.name}.png`, fullPage: false });
        } catch {
          /* продолжаем */
        }
      }
      // языковой переключатель: перейти на EN для одного ключевого кадра
    });
    test(`staff screens ${lang}`, async ({ page }) => {
      await page.goto(`${BASE}/login`);
      await page.getByLabel('Логин').fill('dean.kovaleva');
      await page.getByRole('textbox', { name: 'Пароль' }).fill('dean-demo-2026');
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await page.waitForTimeout(4000);
      await page
        .context()
        .addCookies([{ name: 'du-locale', value: lang, domain: 'ostrovok.store', path: '/' }]);
      for (const s of staff) {
        try {
          await page.goto(`${BASE}${s.path}`);
          await page.waitForTimeout(s.wait ?? 1500);
          await page.screenshot({ path: `${OUT}/${lang}/${s.name}.png`, fullPage: false });
        } catch {
          /* продолжаем */
        }
      }
    });
    test(`guest landing ${lang}`, async ({ page }) => {
      await page
        .context()
        .addCookies([{ name: 'du-locale', value: lang, domain: 'ostrovok.store', path: '/' }]);
      await page.goto(`${BASE}/`);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/${lang}/landing.png` });
      await page.goto(`${BASE}/verify/test`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${lang}/verify.png` });
    });
  });
}
