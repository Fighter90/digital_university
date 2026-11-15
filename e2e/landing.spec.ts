import { expect, test } from '@playwright/test';

// DIG-57 — публичный лендинг на «/»: рендерится без авторизации (1440 и 360),
// секции проявляются при прокрутке, обе CTA кликабельны и ведут на /login.

test.describe('лендинг «/» — рендер без авторизации', () => {
  test('hero: бренд, слоган, подзаголовок и обе CTA', async ({ page }) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('Цифровой деканат');
    await expect(h1).toContainText('Всё университетское — в одном окне');
    await expect(page.getByRole('link', { name: 'Войти' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Демо-доступ' }).first()).toBeVisible();
    // плашка «Концепт» наследуется из layout
    await expect(page.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
  });

  test('пять карточек преимуществ с иконками', async ({ page }) => {
    await page.goto('/');
    for (const title of ['Расписание', 'Оценки', 'Заявки', 'Справки с QR', 'AI-ассистент']) {
      const card = page.getByTestId('landing-feature').filter({ hasText: title });
      await expect(card).toBeVisible();
      await expect(card.locator('svg').first()).toBeVisible();
    }
  });
});

test.describe('лендинг «/» — анимации появления', () => {
  test('секции после прокрутки получают класс видимости', async ({ page }) => {
    await page.goto('/');
    const features = page.getByTestId('landing-feature').first();
    await features.scrollIntoViewIfNeeded();
    // Reveal — прогрессивное улучшение: класс видимости появляется на
    // обёртке [data-reveal] вокруг карточки после пересечения с вьюпортом.
    await expect
      .poll(async () => features.evaluate((el) => el.closest('[data-reveal]')?.className ?? ''), {
        timeout: 5_000,
      })
      .toContain('reveal-visible');
    await expect(features).toBeVisible();
  });
});

test.describe('лендинг «/» — CTA кликабельны', () => {
  test('«Войти» ведёт на форму входа', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Войти' }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Логин')).toBeVisible();
  });

  test('«Демо-доступ» тоже ведёт на /login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Демо-доступ' }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
  });
});

test.describe('лендинг «/» — мобильный 360', () => {
  test('нет горизонтального скролла, CTA на месте', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'проверка только в мобильном профиле');
    await page.goto('/');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);
    await expect(page.getByRole('link', { name: 'Демо-доступ' }).first()).toBeVisible();
  });
});
