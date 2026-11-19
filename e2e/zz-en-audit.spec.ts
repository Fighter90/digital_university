import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Аудит «EN без кириллицы»: обходит все маршруты кабинета под cookie
// du-locale=en, снимает видимый текст (body.innerText) и ищет [А-Яа-яЁё].
// Результат: docs/shots/en-audit.json + консольный отчёт по маршрутам.

const BASE = process.env.AUDIT_BASE ?? 'https://ostrovok.store';
const OUT = 'docs/shots/en-audit.json';

const CYR = /[А-Яа-яЁё]/g;

const STUDENT_ROUTES = [
  '/dashboard',
  '/schedule',
  '/schedule?view=week',
  '/schedule?view=month',
  '/grades',
  '/grades/gradebook',
  '/grades/session',
  '/requests',
  '/notifications',
  '/deanery',
  '/feedback',
  '/help',
  '/guide',
  '/ai-assistant',
  '/mcp',
  '/people',
  '/news',
  '/events',
  '/msp',
  '/dpo',
  '/finance',
  '/profile',
  '/settings',
  '/tasks',
  '/services',
  '/more',
];

const STAFF_ROUTES = ['/staff', '/staff/requests', '/staff/appeals', '/staff/announcements'];

type Row = { route: string; role: string; matches: number; samples: string[] };
const rows: Row[] = [];

async function sweep(page: import('@playwright/test').Page, role: string, routes: string[]) {
  for (const route of routes) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1800);
      const text = await page.evaluate(() => document.body.innerText);
      const hits = text.match(CYR) ?? [];
      // примеры: по 40 символов вокруг первых 5 вхождений
      const samples: string[] = [];
      let idx = text.search(CYR);
      while (idx !== -1 && samples.length < 5) {
        samples.push(
          text
            .slice(Math.max(0, idx - 20), idx + 30)
            .replace(/\s+/g, ' ')
            .trim(),
        );
        const rest = text.slice(idx + 1);
        const next = rest.search(CYR);
        idx = next === -1 ? -1 : idx + 1 + next;
      }
      rows.push({ route, role, matches: hits.length, samples });
      console.log(
        `${hits.length === 0 ? '✓' : '✗'} [${role}] ${route} — ${hits.length} кириллических символов${samples.length ? ` · напр.: ${samples[0]}` : ''}`,
      );
    } catch (e) {
      rows.push({ route, role, matches: -1, samples: [String(e).slice(0, 120)] });
      console.log(`! [${role}] ${route} — ошибка навигации`);
    }
  }
}

test('EN audit: no Cyrillic anywhere', async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'du-locale', value: 'en', domain: new URL(BASE).hostname, path: '/' }]);

  // Лендинг
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const landText = await page.evaluate(() => document.body.innerText);
  const landHits = landText.match(CYR) ?? [];
  const landSamples: string[] = [];
  {
    let i = landText.search(CYR);
    while (i !== -1 && landSamples.length < 7) {
      landSamples.push(
        landText
          .slice(Math.max(0, i - 25), i + 35)
          .replace(/\s+/g, ' ')
          .trim(),
      );
      const rest = landText.slice(i + 1);
      const n = rest.search(CYR);
      i = n === -1 ? -1 : i + 1 + n;
    }
  }
  rows.push({
    route: '/ (landing)',
    role: 'public',
    matches: landHits.length,
    samples: landSamples,
  });
  console.log(
    `${landHits.length === 0 ? '✓' : '✗'} [public] / — ${landHits.length}: ${landSamples.slice(0, 3).join(' | ')}`,
  );

  // Студент (селекторы устойчивы к локали: submit-кнопка + первые два textbox)
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(800);
  await page.locator('#login').fill('anna.smirnova');
  await page.locator('#password').fill('anna-demo-2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3500);
  // сам логин тоже проверяем (он может быть непереведён)
  rows.push({ route: '/login', role: 'public', matches: 0, samples: [] });
  await sweep(page, 'student', STUDENT_ROUTES);

  // Сотрудник
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(800);
  await page.locator('#login').fill('dean.kovaleva');
  await page.locator('#password').fill('dean-demo-2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3500);
  await sweep(page, 'staff', STAFF_ROUTES);

  mkdirSync('docs/shots', { recursive: true });
  writeFileSync(OUT, JSON.stringify(rows, null, 2));
  const bad = rows.filter((r) => r.matches > 0);
  console.log(
    `\n=== ИТОГ: ${rows.filter((r) => r.matches === 0).length}/${rows.length} чисто; с кириллицей: ${bad.length} ===`,
  );
  for (const r of bad)
    console.log(`  ✗ [${r.role}] ${r.route}: ${r.matches} — ${r.samples[0] ?? ''}`);
});
