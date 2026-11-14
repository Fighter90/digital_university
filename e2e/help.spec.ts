import { expect, test, type Page } from '@playwright/test';

// DIG-38 — e2e «Вопросы и ответы» (чёрный ящик, приёмка задачи):
//  - поиск «стипендия» находит статьи про стипендии (аудированный ЛК
//    не находил ничего);
//  - ноль результатов — никогда не тупик: два следующих действия
//    («Спросить AI-ассистента», «Написать в деканат») с переносом текста
//    запроса в параметр q;
//  - категории плитками фильтруют список;
//  - статья открывается, есть «Полезно?» и связанные статьи;
//  - 360 px: плитки и результаты в одну колонку (проект mobile-360).

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Логин').fill(ANNA.login);
  await page.getByLabel('Пароль', { exact: true }).fill(ANNA.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === next, { timeout: 15_000 });
}

test.describe('DIG-38: база знаний', () => {
  test('поиск «стипендия» находит статьи про стипендии', async ({ page }) => {
    await signIn(page, '/help');
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Вопросы и ответы' })).toBeVisible();

    const search = page.getByTestId('help-search');
    await search.fill('стипендия');

    const results = page.getByTestId('help-articles');
    await expect(results.getByRole('link')).not.toHaveCount(0);
    // Категория всех результатов — «Стипендии и выплаты».
    const links = results.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i += 1) {
      await expect(links.nth(i)).toContainText('Стипендии и выплаты');
    }
    // Приёмочный вопрос присутствует.
    await expect(
      results.getByRole('link', { name: /Когда приходит стипендия\?/ }),
    ).toBeVisible();

    // Словоформа «стипендиальный» тоже находит.
    await search.fill('стипендиальный');
    await expect(results.getByRole('link')).not.toHaveCount(0);

    // Состояние нуля результатов не показывается для осмысленного запроса.
    await expect(page.getByTestId('help-empty')).toHaveCount(0);
  });

  test('ноль результатов — два следующих действия с переносом запроса', async ({ page }) => {
    await signIn(page, '/help');
    const search = page.getByTestId('help-search');
    await search.fill('фыгвпркст');

    const empty = page.getByTestId('help-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Ничего не нашлось');

    const ai = empty.getByTestId('help-empty-ai');
    const deanery = empty.getByTestId('help-empty-deanery');
    await expect(ai).toHaveAccessibleName(/Спросить AI-ассистента/);
    await expect(deanery).toHaveAccessibleName(/Написать в деканат/);
    // Текст запроса переносится в обе ссылки.
    await expect(ai).toHaveAttribute('href', `/ai-assistant?q=${encodeURIComponent('фыгвпркст')}`);
    await expect(deanery).toHaveAttribute('href', `/deanery?q=${encodeURIComponent('фыгвпркст')}`);
  });

  test('категории плитками фильтруют список, статья открывается', async ({ page }) => {
    await signIn(page, '/help');
    const results = page.getByTestId('help-articles');

    // Плитка категории.
    await page.getByTestId('help-category-SCHOLARSHIPS').click();
    const links = results.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i += 1) {
      await expect(links.nth(i)).toContainText('Стипендии и выплаты');
    }

    // Повторный клик снимает фильтр.
    await page.getByTestId('help-category-SCHOLARSHIPS').click();
    await expect(results.getByRole('link').first()).toBeVisible();

    // Статья: вопрос, «Полезно?», связанные статьи.
    await results.getByRole('link', { name: /Какие справки можно заказать/ }).click();
    await expect(page).toHaveURL(/\/help\/cert-online$/);
    await expect(page.getByRole('heading', { level: 1, name: /Какие справки/ })).toBeVisible();
    await expect(page.getByTestId('help-feedback')).toBeVisible();
    await expect(page.getByTestId('help-related')).toBeVisible();
    // Кнопка сервиса ведёт к заявке.
    await expect(
      page.getByRole('link', { name: 'Заказать справку' }),
    ).toHaveAttribute('href', '/requests?order=cert-enrollment');

    // Фидбек: клик «Да» благодарит.
    await page.getByTestId('help-feedback-yes').click();
    await expect(page.getByTestId('help-feedback')).toContainText('Спасибо');
  });

  test('360 px: плитки и результаты в одну колонку', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'только mobile-360');
    await signIn(page, '/help');

    const tiles = page.getByTestId('help-categories');
    await expect(tiles).toBeVisible();
    const tileBox = (await page.getByTestId('help-category-STUDY').boundingBox())!;
    const container = (await tiles.boundingBox())!;
    expect(tileBox.width).toBeLessThanOrEqual(container.width / 2 + 1);

    const results = page.getByTestId('help-articles');
    const first = (await results.getByRole('link').first().boundingBox())!;
    const second = (await results.getByRole('link').nth(1).boundingBox())!;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
  });
});
