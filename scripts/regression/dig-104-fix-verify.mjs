#!/usr/bin/env node
// DIG-104 — проверка фикса гидрации: /schedule и /schedule?view=day должны быть
// без React #418, клик по карточке открывает панель деталей, Esc возвращает
// фокус на карточку (data-event-id), ссылка преподавателя ведёт в справочник.
// Запуск: BASE=http://localhost:3100 node scripts/regression/dig-104-fix-verify.mjs

import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';
let failed = false;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failed = true;
};

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

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(String(err)));
const hydrationErrors = [];
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && /hydration|Hydration|Minified React error/.test(text)) {
    hydrationErrors.push(text.slice(0, 2500));
  }
});

await page.goto(`${BASE}/login`);
await page.getByLabel('Логин').fill('anna.smirnova');
await page.getByLabel('Пароль', { exact: true }).fill('anna-demo-2026');
await page.getByRole('button', { name: 'Войти', exact: true }).click();
await page.waitForURL(/\/dashboard/, { timeout: 180000 });

// Прогрев маршрутов расписания (dev-компиляция on demand) — до замеров ошибок.
for (const path of ['/schedule', '/schedule?view=day', '/schedule?view=week']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
}
hydrationErrors.length = 0;
pageErrors.length = 0;

for (const path of ['/schedule', '/schedule?view=day', '/schedule?view=week']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  check(`гидрация чистая ${path}`, hydrationErrors.length === 0 && pageErrors.length === 0,
    hydrationErrors[0] ?? pageErrors[0] ?? '');
  hydrationErrors.length = 0;
  pageErrors.length = 0;
}

// Клик по карточке пары открывает панель деталей (?event= в URL).
// Панель в dev компилируется по первому запросу — ждём её до 60с.
await page.goto(`${BASE}/schedule?view=day`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const card = page.getByTestId('desktop-day').getByTestId('day-card-sch-pi21-1');
await card.click();
check('клик по карточке → ?event= в URL', /event=sch-pi21-1/.test(page.url()), page.url());
const dialogVisible = await page
  .getByTestId('event-details-panel')
  .waitFor({ state: 'visible', timeout: 60000 })
  .then(() => true)
  .catch(() => false);
check('панель деталей открыта', dialogVisible);

// Esc обрабатывается листнером панели, который живёт после гидрации страницы:
// ждём data-hydrated на переключателе видов (как это делают e2e).
await page
  .waitForFunction(
    () => document.querySelector('[data-testid^="view-switcher-"]')?.getAttribute('data-hydrated') === 'true',
    null,
    { timeout: 60000 },
  )
  .catch(() => {});

// Esc возвращает фокус на карточку (data-event-id).
await page.keyboard.press('Escape');
await page
  .waitForFunction(() => document.activeElement?.getAttribute('data-event-id') === 'sch-pi21-1', null, { timeout: 30000 })
  .then(() => check('Esc → фокус на карточке (data-event-id)', true))
  .catch(async () => {
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-event-id') ?? null);
    check('Esc → фокус на карточке (data-event-id)', false, `активный элемент: ${focused}`);
  });

// Ссылка преподавателя внутри карточки ведёт в справочник.
await page.goto(`${BASE}/schedule?view=day`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const teacherLink = page
  .getByTestId('desktop-day')
  .getByTestId('day-card-sch-pi21-6')
  .getByTestId('event-teacher-sch-pi21-6');
await teacherLink.click();
await page.waitForURL(/\/people\/teacher-orlov/, { timeout: 60000 }).catch(() => {});
check('клик по преподавателю → /people/teacher-orlov', /\/people\/teacher-orlov/.test(page.url()), page.url());

await browser.close();
console.log(failed ? 'VERIFY: FAIL' : 'VERIFY: PASS');
process.exit(failed ? 1 : 0);
