import { test } from '@playwright/test';

// DIG-90 — визуальная проверка лендинга RU/EN (локальный сервер :3457)
const shots: Array<{ name: string; path: string; full: boolean }> = [
  { name: 'landing-ru-top', path: '/', full: false },
  { name: 'landing-ru-full', path: '/', full: true },
  { name: 'landing-en-top', path: '/', full: false },
  { name: 'landing-en-full', path: '/', full: true },
];

test('landing screenshots', async ({ browser }) => {
  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    if (s.name.includes('en')) {
      await page
        .context()
        .addCookies([{ name: 'du-locale', value: 'en', domain: 'localhost', path: '/' }]);
    }
    await page.goto(`http://localhost:3457${s.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `/tmp/shot-${s.name}.png`, fullPage: s.full });
    await ctx.close();
  }
});
