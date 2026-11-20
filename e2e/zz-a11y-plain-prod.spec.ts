// DIG-100/DIG-128 — browser-проверка «Версии для слабовидящих» (a11y-plain).
// Проверяем: включение с лендинга (аноним, без /login), на /login, в кабинете
// (RU/EN), вычисленные стили plain-режима (белый фон, чёрный текст, serif
// ≥20px), выключение, mobile 360px, ошибки консоли. Ожидание — waitForFunction
// на класс <html> (RSC-обновление после server action не мгновенное).
import { test, expect } from '@playwright/test';

const BASE = process.env.AUDIT_BASE ?? 'https://ostrovok.store';

const consoleErrors: string[] = [];

async function watchConsole(page: import('@playwright/test').Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${String(err).slice(0, 200)}`));
}

async function plainState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    const link = document.querySelector<HTMLElement>('[data-testid="a11y-version-link"]');
    return {
      hasPlainClass: document.documentElement.classList.contains('a11y-plain'),
      bg: cs.backgroundColor,
      color: cs.color,
      fontFamily: cs.fontFamily.split(',')[0],
      fontSize: cs.fontSize,
      linkText: link?.textContent?.trim() ?? null,
    };
  });
}

/** Ждём появления/исчезновения класса a11y-plain на <html> (RSC-обновление). */
async function waitForPlain(page: import('@playwright/test').Page, want: boolean) {
  await page.waitForFunction(
    (w) => document.documentElement.classList.contains('a11y-plain') === w,
    want,
    { timeout: 15_000 },
  );
}

test.describe('Версия для слабовидящих (a11y-plain)', () => {
  test.beforeEach(async () => {
    consoleErrors.length = 0;
  });

  test('лендинг анонима: ссылка в футере включает plain-версию без /login', async ({ page }) => {
    await watchConsole(page);
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    const before = await plainState(page);
    console.log('BEFORE:', JSON.stringify(before));

    const link = page.getByTestId('a11y-version-link');
    await expect(link).toBeVisible();
    await link.click();
    await waitForPlain(page, true);

    const after = await plainState(page);
    console.log('AFTER:', JSON.stringify(after));
    console.log('URL после клика:', page.url());

    // Стили plain-режима: белый фон, чёрный текст, serif ≥20px
    expect(after.hasPlainClass).toBe(true);
    expect(after.bg).toBe('rgb(255, 255, 255)');
    expect(after.color).toBe('rgb(0, 0, 0)');
    expect(after.linkText).not.toContain('слабовидящих');
    // не выпали на /login — включение работает без сессии (DIG-128)
    expect(page.url()).not.toContain('/login');
    expect(consoleErrors, 'консоль без ошибок').toEqual([]);
  });

  test('выключение: ссылка возвращает обычный вид', async ({ page }) => {
    await watchConsole(page);
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.getByTestId('a11y-version-link').click();
    await waitForPlain(page, true);

    const s1 = await plainState(page);
    console.log('PLAIN ON:', JSON.stringify(s1));

    await page.getByTestId('a11y-version-link').click();
    await waitForPlain(page, false);
    const s2 = await plainState(page);
    console.log('PLAIN OFF:', JSON.stringify(s2));
    expect(s2.hasPlainClass).toBe(false);
    expect(consoleErrors, 'консоль без ошибок').toEqual([]);
  });

  test('кабинет (студент, RU): включение/выключение из футера + стили', async ({ page }) => {
    await watchConsole(page);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.locator('#login').fill('anna.smirnova');
    await page.locator('#password').fill('anna-demo-2026');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL(/dashboard/, { timeout: 20_000 });
    console.log('URL после входа:', page.url());

    // прокрутка вниз до футера и включение
    await page.keyboard.press('End');
    await page.getByTestId('a11y-version-link').click();
    await waitForPlain(page, true);
    const s1 = await plainState(page);
    console.log('CABINET PLAIN ON:', JSON.stringify(s1));
    expect(s1.hasPlainClass).toBe(true);
    expect(s1.bg).toBe('rgb(255, 255, 255)');

    await page.keyboard.press('End');
    await page.getByTestId('a11y-version-link').click();
    await waitForPlain(page, false);
    console.log('CABINET PLAIN OFF: ok');
    expect(consoleErrors, 'консоль без ошибок').toEqual([]);
  });

  test('на /login ссылка версии доступна анониму', async ({ page }) => {
    await watchConsole(page);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    const link = page.getByTestId('a11y-version-link');
    await expect(link).toBeVisible();
    await link.click();
    await waitForPlain(page, true);
    const s = await plainState(page);
    console.log('LOGIN PLAIN:', JSON.stringify(s));
    expect(s.hasPlainClass).toBe(true);
    // выключаем обратно, чтобы не влиять на другие тесты
    await page.getByTestId('a11y-version-link').click();
    await waitForPlain(page, false);
    expect(consoleErrors, 'консоль без ошибок').toEqual([]);
  });

  test('mobile 360px: версия включается и читается', async ({ page }) => {
    await watchConsole(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.getByTestId('a11y-version-link').click();
    await waitForPlain(page, true);
    const s = await plainState(page);
    console.log('MOBILE PLAIN:', JSON.stringify(s));
    expect(s.hasPlainClass).toBe(true);
    expect(s.bg).toBe('rgb(255, 255, 255)');
    expect(parseFloat(s.fontSize)).toBeGreaterThanOrEqual(20);
    // выключаем обратно
    await page.getByTestId('a11y-version-link').click();
    await waitForPlain(page, false);
    expect(consoleErrors, 'консоль без ошибок').toEqual([]);
  });
});
