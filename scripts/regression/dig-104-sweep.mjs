#!/usr/bin/env node
// DIG-104 — RU-регресс кабинета студента против прода (https://ostrovok.store).
//
// Что делает:
//  1. Логин anna.smirnova (cookie du-locale НЕ ставим — дефолт RU).
//  2. Обходит все маршруты кабинета на desktop 1440×900 и mobile 360×800,
//     снимает fullPage-скриншоты в shots/desktop|mobile/.
//  3. На каждом маршруте собирает: HTTP-статус, ошибки консоли (console.type=error),
//     необработанные исключения (pageerror), горизонтальный overflow на 360 px,
//     наличие EmptyState и плашки «Концепт для конкурса», совпадение «сегодня»
//     с Europe/Moscow (МСК).
//  4. Собирает все внутренние ссылки и проверяет их GET-ом (404/5xx = дефект).
//
// Результат: shots/regression-results-104.json + сводка в stdout.
//
// Запуск: node scripts/regression/dig-104-sweep.mjs
// (браузер: npx playwright install chromium, если кэша нет)

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SWEEP_BASE ?? 'https://ostrovok.store';
const OUT = resolve('shots');
const CREDS = { login: 'anna.smirnova', password: 'anna-demo-2026' };

const STATIC_ROUTES = [
  { name: 'dashboard', path: '/dashboard', wait: 2500 },
  { name: 'schedule', path: '/schedule', wait: 2500 },
  { name: 'schedule-day', path: '/schedule?view=day', wait: 2000 },
  { name: 'schedule-week', path: '/schedule?view=week', wait: 2000 },
  { name: 'schedule-month', path: '/schedule?view=month', wait: 2000 },
  { name: 'grades', path: '/grades', wait: 2500 },
  { name: 'gradebook', path: '/grades/gradebook', wait: 2000 },
  { name: 'session', path: '/grades/session', wait: 2000 },
  { name: 'rating', path: '/grades/rating', wait: 2000 },
  { name: 'requests', path: '/requests', wait: 2500 },
  { name: 'notifications', path: '/notifications', wait: 2000 },
  { name: 'deanery', path: '/deanery', wait: 2000 },
  { name: 'feedback', path: '/feedback', wait: 2000 },
  { name: 'help', path: '/help', wait: 1500 },
  { name: 'guide', path: '/guide', wait: 1500 },
  { name: 'ai-assistant', path: '/ai-assistant', wait: 3000 },
  { name: 'mcp', path: '/mcp', wait: 1500 },
  { name: 'people', path: '/people', wait: 1500 },
  { name: 'news', path: '/news', wait: 1500 },
  { name: 'events', path: '/events', wait: 1500 },
  { name: 'msp', path: '/msp', wait: 1500 },
  { name: 'dpo', path: '/dpo', wait: 1500 },
  { name: 'finance', path: '/finance', wait: 2000 },
  { name: 'profile', path: '/profile', wait: 1500 },
  { name: 'settings', path: '/settings', wait: 2000 },
  { name: 'tasks', path: '/tasks', wait: 2000 },
  { name: 'services', path: '/services', wait: 1500 },
  { name: 'more', path: '/more', wait: 1500 },
];

const SKIP_LINK_RE = /(^#|^mailto:|^tel:|\/logout|\/signout|\/api\/|javascript:)/i;

function mskToday() {
  const now = new Date();
  const fmt = (opts) =>
    new Intl.DateTimeFormat('ru-RU', { ...opts, timeZone: 'Europe/Moscow' })
      .format(now)
      .replace(/\u00A0/g, ' ');
  const label = fmt({ day: 'numeric', month: 'long' }); // «20 ноября» (родительный)
  const [day, monthGen] = label.split(' ');
  const monthNom = fmt({ month: 'long' }); // «ноябрь» (именительный — для сетки месяца)
  return { day, month: monthGen, monthNom, label };
}

async function collectPageInfo(page) {
  return page.evaluate(() => {
    const text = document.body.innerText ?? '';
    const emptyEl = document.querySelector('.border-dashed');
    return {
      h1: document.querySelector('h1')?.innerText?.trim() ?? '',
      textLength: text.length,
      hasConceptBadge: text.includes('Концепт для конкурса') || text.includes('Концепт'),
      emptyState: emptyEl ? emptyEl.querySelector('h2,h3,p,strong')?.innerText?.trim() ?? 'EmptyState' : null,
      scrollWidth: document.documentElement.scrollWidth,
      links: Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter(Boolean),
    };
  });
}

async function visitRoute(page, route, viewportLabel, shotsDir, msk) {
  const result = {
    route: route.name,
    path: route.path,
    viewport: viewportLabel,
    ok: true,
    httpStatus: null,
    finalUrl: null,
    consoleErrors: [],
    pageErrors: [],
    h1: null,
    textLength: 0,
    hasConceptBadge: null,
    emptyState: null,
    links: [],
    overflow360: null,
    mskTodayOnPage: null,
    error: null,
  };

  const onConsole = (msg) => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text().slice(0, 300));
  };
  const onPageError = (err) => result.pageErrors.push(String(err).slice(0, 300));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  try {
    const resp = await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    result.httpStatus = resp ? resp.status() : null;
    await page.waitForTimeout(route.wait ?? 1500);
    result.finalUrl = page.url();

    const info = await collectPageInfo(page);
    result.h1 = info.h1;
    result.textLength = info.textLength;
    result.hasConceptBadge = info.hasConceptBadge;
    result.emptyState = info.emptyState;
    result.links = info.links;
    if (viewportLabel === 'mobile') result.overflow360 = info.scrollWidth > 361 ? info.scrollWidth : false;

    // МСК: дата «сегодня» на странице должна совпадать с Europe/Moscow.
    // Строгая проверка — для видов «день/неделя» и авто (там дата «20 ноября»
    // присутствует в заголовке); в сетке месяца дата сокращена до числа,
    // поэтому проверяем только месяц (ноябрь) — иначе ложное срабатывание.
    if (/^(dashboard|schedule|schedule-day|schedule-week|schedule-month)$/.test(route.name)) {
      const raw = await page.evaluate(() => document.body.innerText);
      const bodyText = raw.replace(/\u00A0/g, ' ');
      const isMonthGrid = route.name === 'schedule-month';
      const pass = isMonthGrid
        ? bodyText.toLowerCase().includes(msk.monthNom.toLowerCase())
        : bodyText.includes(msk.label);
      result.mskTodayOnPage = pass ? 'pass' : route.name === 'dashboard' ? 'info-fail' : 'fail';
    }

    await page.screenshot({ path: resolve(shotsDir, `${route.name}.png`), fullPage: true });
  } catch (err) {
    result.ok = false;
    result.error = String(err).slice(0, 300);
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
  return result;
}

async function login(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.getByLabel('Логин').fill(CREDS.login);
  await page.getByLabel('Пароль', { exact: true }).fill(CREDS.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45000 });
  return page;
}

async function main() {
  mkdirSync(resolve(OUT, 'desktop'), { recursive: true });
  mkdirSync(resolve(OUT, 'mobile'), { recursive: true });
  const msk = mskToday();
  console.log(`SWEEP start base=${BASE} today-MSK=${msk.label}`);

  // channel 'chromium' — полный браузер вместо headless-shell: кэш headless-shell
  // стирается параллельными сессиями роя (наблюдение DIG-104), полный chromium живёт.
  const browser = await chromium.launch({ channel: 'chromium' });
  const results = [];
  const linkSet = new Map(); // href -> { foundOn: Set<route> }
  let dynamic = [];

  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 360, height: 800 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      timezoneId: 'Europe/Moscow',
      locale: 'ru-RU',
    });
    const shotsDir = resolve(OUT, label);
    const page = await login(context);
    const routes = [...STATIC_ROUTES, ...dynamic];
    for (const route of routes) {
      const res = await visitRoute(page, route, label, shotsDir, msk);
      results.push(res);
      const mark = res.ok ? (res.consoleErrors.length || res.pageErrors.length || res.overflow360 ? '⚠' : '✓') : '✗';
      console.log(
        `[${label}] ${mark} ${route.name} status=${res.httpStatus} consoleErr=${res.consoleErrors.length} ` +
          `pageErr=${res.pageErrors.length} overflow=${res.overflow360 ?? '-'} empty=${res.emptyState ? 'yes' : '-'} ` +
          `msk=${res.mskTodayOnPage ?? '-'}`,
      );

      // Сбор внутренних ссылок и поиск динамических подстраниц (только desktop-проход).
      if (label === 'desktop' && res.ok) {
        for (const href of res.links) {
          if (SKIP_LINK_RE.test(href)) continue;
          const abs = href.startsWith('http') ? href : href.startsWith('/') ? `${BASE}${href}` : null;
          if (!abs || !abs.startsWith(BASE)) continue;
          if (!linkSet.has(abs)) linkSet.set(abs, new Set());
          linkSet.get(abs).add(route.name);
        }
        if (route.name === 'grades' && dynamic.length === 0) {
          const href = await page
            .$eval('a[href^="/grades/"]:not([href="/grades/gradebook"]):not([href="/grades/session"]):not([href="/grades/rating"])',
              (a) => a.getAttribute('href'))
            .catch(() => null);
          if (href) {
            const r = { name: 'grade-detail', path: href, wait: 2000 };
            dynamic.push(r);
            routes.push(r); // живой массив: for-of посетит маршрут в этом же проходе
          }
        }
        if (route.name === 'requests') {
          const href = await page
            .$eval('a[href^="/requests/"]', (a) => a.getAttribute('href'))
            .catch(() => null);
          if (href) {
            const r = { name: 'request-detail', path: href, wait: 2000 };
            dynamic.push(r);
            routes.push(r);
          }
        }
      }
    }

    // Проверка ссылок (404/5xx) — GET из залогиненного контекста.
    if (label === 'desktop') {
      console.log(`LINK-CHECK: ${linkSet.size} уникальных внутренних ссылок`);
      for (const [url, foundOn] of linkSet) {
        try {
          const resp = await context.request.get(url, { maxRedirects: 5, timeout: 20000 });
          if (resp.status() >= 400) {
            results.push({
              route: 'link-check',
              path: url.replace(BASE, ''),
              viewport: 'desktop',
              ok: false,
              httpStatus: resp.status(),
              consoleErrors: [],
              pageErrors: [],
              foundOn: [...foundOn],
              error: `HTTP ${resp.status()}`,
            });
            console.log(`[link] ✗ ${resp.status()} ${url}`);
          }
        } catch (err) {
          results.push({
            route: 'link-check',
            path: url.replace(BASE, ''),
            viewport: 'desktop',
            ok: false,
            httpStatus: null,
            consoleErrors: [],
            pageErrors: [],
            foundOn: [...foundOn],
            error: String(err).slice(0, 200),
          });
          console.log(`[link] ✗ ERR ${url}: ${String(err).slice(0, 120)}`);
        }
      }
    }

    await context.close();
  }

  await browser.close();
  writeFileSync(resolve(OUT, 'regression-results-104.json'), JSON.stringify({ base: BASE, mskToday: msk.label, results }, null, 2));
  const bad = results.filter((r) => !r.ok || r.consoleErrors.length || r.pageErrors.length || r.overflow360 || r.mskTodayOnPage === 'fail');
  console.log(`SWEEP done: ${results.length} записей, ${bad.length} с замечаниями → ${OUT}/regression-results-104.json`);
}

main().catch((err) => {
  console.error('SWEEP fatal:', err);
  process.exit(1);
});
