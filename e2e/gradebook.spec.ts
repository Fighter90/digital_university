import { expect, test, type Page } from '@playwright/test';

// DIG-27 — e2e «Зачётная книжка» и карточка дисциплины (чёрный ящик):
//  - зачётка по семестрам, вход в карточку своей дисциплины;
//  - чужая дисциплина (ЭК-11 у Анны) → единый 404;
//  - выписка PDF мгновенно: 200, application/pdf, %PDF-; сотруднику и
//    анониму недоступна;
//  - 360 px: таблица превращается в карточки (таблица скрыта), 1440 px:
//    таблица видима.

async function signIn(page: Page, login: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

test.describe('DIG-27: зачётная книжка', () => {
  test('семестры, дисциплины и вход в карточку своей дисциплины', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/gradebook');
    await expect(page).toHaveURL(/\/grades\/gradebook$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Зачётная книжка' })).toBeVisible();

    // Кнопка мгновенной выписки.
    const download = page.getByTestId('transcript-download');
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute('href', '/api/grades/transcript');

    // Семестры: текущий осенний раскрыт, прошлая весна в аккордеоне.
    await expect(page.getByTestId('semester-accordion-2026-fall')).toBeVisible();
    await expect(page.getByTestId('semester-accordion-2025-spring')).toBeVisible();
    await expect(page.getByText('Осенний семестр 2026/27').first()).toBeVisible();

    // Своя дисциплина завершённого семестра открывается в карточку.
    const cardLink = page.locator('a[href="/grades/PI21-ALG"]').first();
    await expect(cardLink).toBeVisible();
    await cardLink.click();
    await expect(page).toHaveURL(/\/grades\/PI21-ALG$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Алгоритмы и структуры данных' }),
    ).toBeVisible();
    await expect(page.getByTestId('grade-formula')).toBeVisible();
    await expect(page.getByTestId('calculator-slot')).toBeVisible();
  });

  test('чужая дисциплина и несуществующая — единый 404 (контракт IDOR)', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/gradebook');
    // Дисциплина группы ЭК-11 (Ильи) — 404, не 403 и не редирект.
    const res = await page.goto('/grades/EK11-MATH');
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Страница не найдена' }),
    ).toBeVisible();
    // Несуществующий код отвечает ровно так же.
    const missing = await page.goto('/grades/PI21-NOPE');
    expect(missing?.status()).toBe(404);
  });

  test('выписка PDF: студенту — мгновенно, сотруднику и анониму — отказ', async ({ browser }) => {
    const anna = await browser.newContext();
    const annaPage = await anna.newPage();
    await signIn(annaPage, 'anna.smirnova', 'anna-demo-2026', '/grades');
    const pdf = await annaPage.request.get('/api/grades/transcript');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect((await pdf.body()).subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');

    // Сотрудник деканата — единый 404.
    const dean = await browser.newContext();
    const deanPage = await dean.newPage();
    await signIn(deanPage, 'dean.kovaleva', 'dean-demo-2026', '/grades');
    const denied = await deanPage.request.get('/api/grades/transcript');
    expect(denied.status()).toBe(404);
    expect(await denied.json()).toEqual({ error: 'not_found' });

    // Аноним — редирект на вход, PDF не отдаётся.
    const anon = await browser.newContext();
    const anonResponse = await anon.request.get('/api/grades/transcript', { maxRedirects: 0 });
    expect([302, 307]).toContain(anonResponse.status());
    expect(anonResponse.headers()['location'] ?? '').toContain('/login');

    await anna.close();
    await dean.close();
    await anon.close();
  });
});

test.describe('DIG-27: адаптивность зачётки', () => {
  test('1440 px: таблица семестра видима', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/gradebook');
    await expect(page.getByTestId('semester-accordion-2026-fall')).toBeVisible();
    const table = page.getByTestId('gradebook-table-2026-fall');
    await expect(table).toBeVisible();
  });

  test('360 px: таблица превращается в карточки', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/gradebook');
    await expect(page.getByTestId('semester-accordion-2026-fall')).toBeVisible();
    const cards = page.getByTestId('gradebook-cards-2026-fall');
    await expect(cards).toBeVisible();
    await expect(cards.locator('a[href^="/grades/"]').first()).toBeVisible();
    // Таблица скрыта на мобильной ширине.
    const table = page.getByTestId('gradebook-table-2026-fall');
    await expect(table).not.toBeVisible();
  });
});
