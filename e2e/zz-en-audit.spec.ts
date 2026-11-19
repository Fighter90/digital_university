import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Аудит «EN без кириллицы»: обходит все маршруты кабинета под cookie
// du-locale=en, снимает видимый текст (body.innerText) и ищет [А-Яа-яЁё].
// Whitelist: «Русский/English» — нативные названия языков в переключателе (by design).
// Результат: docs/shots/en-audit.json + консольный отчёт по маршрутам.

const BASE = process.env.AUDIT_BASE ?? 'https://ostrovok.store';
const OUT = 'docs/shots/en-audit.json';

const CYR = /[А-Яа-яЁё]/g;
const WHITELIST = ['Русский', 'English'];
const stripWhitelist = (text: string) => WHITELIST.reduce((acc, w) => acc.split(w).join(''), text);

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

type Row = { route: string; role: string; matches: number; samples: string[]; words: string[] };
const rows: Row[] = [];

async function sweep(page: import('@playwright/test').Page, role: string, routes: string[]) {
  for (const route of routes) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1800);
      const text = await page.evaluate(() => document.body.innerText);
      const clean = stripWhitelist(text);
      const hits = clean.match(CYR) ?? [];
      // примеры: по 40 символов вокруг первых 5 вхождений
      const samples: string[] = [];
      let idx = clean.search(CYR);
      while (idx !== -1 && samples.length < 5) {
        samples.push(
          clean
            .slice(Math.max(0, idx - 20), idx + 30)
            .replace(/\s+/g, ' ')
            .trim(),
        );
        const rest = clean.slice(idx + 1);
        const next = rest.search(CYR);
        idx = next === -1 ? -1 : idx + 1 + next;
      }
      const words = Array.from(new Set(clean.match(/[А-Яа-яЁё]{2,}/g) ?? [])).slice(0, 20);
      rows.push({ route, role, matches: hits.length, samples, words });
      console.log(
        `${hits.length === 0 ? '✓' : '✗'} [${role}] ${route} — ${hits.length} симв.${words.length ? ` · слова: ${words.slice(0, 6).join(', ')}` : ''}`,
      );
    } catch (e) {
      rows.push({ route, role, matches: -1, samples: [String(e).slice(0, 120)], words: [] });
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
  const landClean = stripWhitelist(landText);
  const landHits = landClean.match(CYR) ?? [];
  const landWords = Array.from(new Set(landClean.match(/[А-Яа-яЁё]{2,}/g) ?? [])).slice(0, 10);
  rows.push({
    route: '/ (landing)',
    role: 'public',
    matches: landHits.length,
    samples: landWords,
    words: landWords,
  });
  console.log(
    `${landHits.length === 0 ? '✓' : '✗'} [public] / — ${landHits.length} симв.${landWords.length ? ` · слова: ${landWords.join(', ')}` : ''}`,
  );

  // Студент (селекторы устойчивы к локали: submit-кнопка + #login/#password)
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(800);
  await page.locator('#login').fill('anna.smirnova');
  await page.locator('#password').fill('anna-demo-2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3500);
  await sweep(page, 'student', STUDENT_ROUTES);

  // Сотрудник: сбрасываем сессию студента
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([{ name: 'du-locale', value: 'en', domain: new URL(BASE).hostname, path: '/' }]);
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
    console.log(
      `  ✗ [${r.role}] ${r.route}: ${r.matches} — ${(r.words ?? []).slice(0, 6).join(', ')}`,
    );
});
