import { expect, test, type Page } from '@playwright/test';

// DIG-45 — экран «Поиск по кабинету» (⌘K): e2e приёмки.
// desktop-1440: ⌘K открывает палитру; «справка» находит Действия и Вопросы
// и ответы; номер заявки находит заявку; ФИО — человека; Tab переключает
// группу; Enter открывает; AI-подвал; ответ /api/search быстрее 200 мс.
// mobile-360: поиск из шапки — на весь экран, без горизонтального скролла.

const REQUEST_NUMBER_RE = /SR-\d{4}-[A-Z0-9]{5}/;

/** Вход тестового студента через форму (единые демо-креды, DIG-50). */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
  await expect(page.getByLabel('Логин')).toHaveValue('anna.smirnova');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
}

async function openSearch(page: Page) {
  await page.keyboard.press('ControlOrMeta+KeyK');
  const dialog = page.getByRole('dialog', { name: 'Поиск по кабинету' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox')).toBeFocused();
  return dialog;
}

test.describe('desktop 1440 — палитра ⌘K', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.waitForLoadState('networkidle');
  });

  test('«справка» находит действие и статью вопросов и ответов в группах', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByRole('combobox').fill('справка');

    await expect(dialog.getByRole('heading', { name: 'Действия' })).toBeVisible();
    await expect(dialog.getByRole('option', { name: /Справка об обучении/ }).first()).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Вопросы и ответы' })).toBeVisible();
    // Не «30 смешанных результатов»: группы разделены заголовками.
    await expect(dialog.getByRole('heading', { name: 'Новости' })).toBeVisible();
    await expect(dialog.getByText(/Спросить AI/)).toBeVisible();
  });

  test('номер заявки находит заявку, ФИО — человека', async ({ page }) => {
    // Свой номер заявки берём со страницы заявок (сид генерируется PRNG).
    await page.goto('/requests');
    const numberText = await page.getByText(REQUEST_NUMBER_RE).first().textContent();
    expect(numberText).toBeTruthy();
    const number = numberText!.match(REQUEST_NUMBER_RE)![0];

    const dialog = await openSearch(page);
    await dialog.getByRole('combobox').fill(number);
    await expect(dialog.getByRole('heading', { name: 'Заявки' })).toBeVisible();
    await expect(dialog.getByRole('option', { name: new RegExp(number) })).toBeVisible();

    await dialog.getByRole('combobox').fill('Иванова');
    await expect(dialog.getByRole('heading', { name: 'Люди' })).toBeVisible();
    await expect(dialog.getByRole('option', { name: /Иванова Ирина Игоревна/ })).toBeVisible();
  });

  test('Tab переключает группу, Enter открывает результат', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByRole('combobox').fill('справка');
    const options = dialog.getByRole('option');
    await expect(options.first()).toBeVisible();
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');

    // Tab → первая строка следующей группы
    await page.keyboard.press('Tab');
    const combobox = dialog.getByRole('combobox');
    const activeId = await combobox.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    expect(await dialog.locator(`#${activeId}`).getAttribute('data-group')).not.toBe('action');

    // Shift+Tab возвращает в первую группу, Enter открывает действие
    await page.keyboard.press('Shift+Tab');
    const backId = await combobox.getAttribute('aria-activedescendant');
    expect(await dialog.locator(`#${backId}`).getAttribute('data-group')).toBe('action');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/requests\?order=/, { timeout: 10000 });
    await expect(page.getByRole('dialog', { name: 'Поиск по кабинету' })).not.toBeVisible();
  });

  test('AI-подвал ведёт в AI-ассистент с запросом', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByRole('combobox').fill('стипендия');
    const aiRow = dialog.getByRole('option', { name: /Спросить AI/ });
    await expect(aiRow).toBeVisible();
    await aiRow.click();
    await expect(page).toHaveURL(/\/ai-assistant\?q=/, { timeout: 10000 });
  });

  test('пустое поле показывает недавние запросы и популярные действия', async ({ page }) => {
    const dialog = await openSearch(page);
    await expect(dialog.getByText('Популярные действия')).toBeVisible();
    await expect(dialog.getByText('Справка об обучении')).toBeVisible();
    await page.keyboard.press('Escape');

    // недавний запрос появляется после активации результата
    const search = await openSearch(page);
    await search.getByRole('combobox').fill('справка');
    const hit = search.getByRole('option', { name: /Справка об обучении/ }).first();
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page).toHaveURL(/\/requests\?order=/, { timeout: 10000 });

    const reopened = await openSearch(page);
    await expect(reopened.getByText('Недавние запросы')).toBeVisible();
    await reopened.getByRole('button', { name: 'справка' }).click();
    await expect(
      reopened.getByRole('option', { name: /Справка об обучении/ }).first(),
    ).toBeVisible();
  });

  test('ответ /api/search быстрее 200 мс на сидовых данных', async ({ page }) => {
    const started = Date.now();
    const response = await page.request.get('/api/search?q=' + encodeURIComponent('справка'));
    expect(response.status()).toBe(200);
    const elapsed = Date.now() - started;
    const payload = (await response.json()) as { groups: Array<{ kind: string }> };
    expect(payload.groups.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });
});

test.describe('mobile 360 — полноэкранный поиск', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.waitForLoadState('networkidle');
  });

  test('поиск из шапки открывается на весь экран без горизонтального скролла', async ({ page }) => {
    await page.getByRole('button', { name: 'Поиск по кабинету (Command+K)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Поиск по кабинету' });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeLessThanOrEqual(0);
    expect(box!.width).toBeGreaterThanOrEqual(360);
    expect(box!.height).toBeGreaterThanOrEqual(780);

    await dialog.getByRole('combobox').fill('справка');
    await expect(dialog.getByRole('heading', { name: 'Действия' })).toBeVisible();
    await expect(dialog.getByText(/Спросить AI/)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
