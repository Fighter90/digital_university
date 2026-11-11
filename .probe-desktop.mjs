// DIG-23 round 2: probe desktop switcher + month-cell navigation.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3000';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${msg.text().slice(0, 800)}`);
});
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.stack ?? err.message}`.slice(0, 2500)));

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
await page.getByRole('button', { name: 'Войти', exact: true }).click();
await page.waitForURL(/dashboard/, { timeout: 15000 });

// A) switcher from default (week) view
logs.push('=== /schedule default (week) → switcher День ===');
await page.goto(`${BASE}/schedule`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
logs.push(`week-grid=${await page.getByTestId('week-grid').count()}`);
const sw = page.getByTestId('view-switcher-desktop');
logs.push(`switcher-count=${await sw.count()}`);
await sw.getByRole('radio', { name: 'День' }).click();
await page.waitForTimeout(3000);
logs.push(`URL after switcher click: ${page.url()}`);
logs.push(`desktop-day-count=${await page.getByTestId('desktop-day').count()}`);

// B) month → cell click
logs.push('=== /schedule?view=month → cell click ===');
await page.goto(`${BASE}/schedule?view=month`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
const cell = page.getByTestId(`month-cell-${today}`);
logs.push(`cell-count=${await cell.count()} tagName=${await cell.evaluate((el) => el.tagName).catch(() => 'n/a')} href=${await cell.getAttribute('href').catch(() => 'n/a')}`);
await cell.click();
await page.waitForTimeout(3000);
logs.push(`URL after cell click: ${page.url()}`);
console.log(logs.join('\n'));
await browser.close();
