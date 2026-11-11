import { expect, test, type Page } from '@playwright/test';

// DIG-20 — «Ваша неделя», главная кабинета (Figma «02 Главная + M2»).
// desktop-1440: тёмный hero со сводкой и 4 плитками, блоки «Сегодня»,
// «Ближайшие дедлайны», «Как у меня дела», «Быстрые действия», «Новости».
// mobile-360: одна колонка, hero-плитки 2×2, без горизонтального скролла,
// каждая плитка ведёт в свой раздел.

/** Вход тестового студента через чип демо-аккаунта (см. e2e/cabinet-shell.spec.ts). */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
}

test.describe('desktop 1440 — главная «Ваша неделя»', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('renders the week hero, summary line and all five sections', async ({ page }) => {
    await page.goto('/dashboard');

    const hero = page.getByRole('heading', { level: 1, name: /Ваша неделя/ });
    await expect(hero).toBeVisible();
    await expect(page.getByTestId('dashboard-summary')).toBeVisible();

    for (const heading of [
      'Сегодня',
      'Ближайшие дедлайны',
      'Как у меня дела',
      'Быстрые действия',
      'Новости деканата',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    for (const tile of ['Средний балл', 'Кредиты', 'Долги', 'Заявки в работе']) {
      await expect(page.getByRole('link', { name: new RegExp(tile) })).toBeVisible();
    }
  });

  test('rescheduled lesson shows the transfer note', async ({ page }) => {
    await page.goto('/dashboard');
    // Демо-данные: сегодняшняя пара ПИ-21 перенесена из ауд. 214 в 305.
    await expect(page.getByText(/Перенос: ауд\. 214 → 305/)).toBeVisible();
  });

  test('every hero tile leads to its own section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(
      page.getByRole('link', { name: /Средний балл/ }).and(page.locator('[href="/grades"]')),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Заявки в работе/ }).and(page.locator('[href="/requests"]')),
    ).toBeVisible();
  });
});

test.describe('mobile 360 — главная одной колонкой', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('single column, hero tiles 2×2, no horizontal scroll', async ({ page }) => {
    await page.goto('/dashboard');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);

    const tiles = page.getByTestId('hero-tiles');
    await expect(tiles).toBeVisible();
    const boxes = [];
    for (const tile of await tiles.getByRole('link').all()) {
      boxes.push(await tile.boundingBox());
    }
    expect(boxes.length).toBeGreaterThanOrEqual(4);
    // Плитки 1 и 3 — в одной левой колонке (grid 2×2), 1 и 2 — в одном ряду.
    expect(boxes[0]!.x).toBeCloseTo(boxes[2]!.x, 0);
    expect(boxes[0]!.y).toBeCloseTo(boxes[1]!.y, 0);
    expect(boxes[0]!.y).toBeLessThan(boxes[2]!.y);
  });

  test('quick action «Спросить AI» leads to the AI section', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Спросить AI' }).click();
    await expect(page).toHaveURL(/\/ai-assistant$/);
  });

  test('«Средний балл» tile leads to the grades section', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /Средний балл/ }).click();
    await expect(page).toHaveURL(/\/grades$/);
  });
});
