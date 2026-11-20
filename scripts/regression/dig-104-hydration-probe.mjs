#!/usr/bin/env node
// DIG-104 — локальный зонд гидратации: /schedule и /schedule?view=day на dev-сервере
// (неминифицированный React показывает полный diff сервер/клиент).
// Запуск: BASE=http://localhost:3100 node scripts/regression/dig-104-hydration-probe.mjs

import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';

// channel 'chromium' — полный браузер вместо headless-shell (кэш shell
// стирается параллельными сессиями роя, наблюдение DIG-104).
const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  timezoneId: 'Europe/Moscow',
  locale: 'ru-RU',
});
const page = await context.newPage();
page.setDefaultTimeout(180000);
page.setDefaultNavigationTimeout(180000);

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err}`));

const health = await context.request.get(`${BASE}/api/health`);
console.log('health:', await health.text());

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.getByLabel('Логин').fill(process.env.PROBE_LOGIN ?? 'anna.smirnova');
await page.getByLabel('Пароль', { exact: true }).fill(process.env.PROBE_PASS ?? 'anna-demo-2026');
await page.getByRole('button', { name: 'Войти', exact: true }).click();
await page.waitForURL(/\/dashboard/, { timeout: 45000 });
console.log('login OK →', page.url());

for (const path of ['/schedule', '/schedule?view=day', '/schedule?view=week']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log(`\n===== ${path}: ${errors.length === 0 ? 'чисто' : `${errors.length} ошибок`}`);
  for (const e of errors) console.log(e.slice(0, 2500));
  errors.length = 0;
}

await browser.close();
