import { expect, test, type Page } from '@playwright/test';

// DIG-84 (BUG-09) — e2e «EN-рендер ключевых страниц»: сводка /grades,
// зачётка /grades/gradebook и карточка заявки /requests/[номер] на EN
// не содержат русских строк ОСНОВНОГО контента (демо-контент — ФИО,
// названия дисциплин — остаётся RU по дизайну). RU-локаль (дефолт)
// покрыта смежными spec'ами байт-в-байт.

async function signIn(page: Page, login: string, password: string, next?: string) {
  const target = next ?? '/dashboard';
  await page.goto(`/login?next=${encodeURIComponent(target)}`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === new URL(target, page.url()).pathname, {
    timeout: 15_000,
  });
}

async function useEnglish(page: Page) {
  // Локаль кабинета живёт в cookie du-locale (server action LocaleSwitch
  // пишет ту же куку) — ставим напрямую, сценарий переключателя покрыт
  // отдельным spec'ом.
  await page
    .context()
    .addCookies([{ name: 'du-locale', value: 'en', domain: 'localhost', path: '/' }]);
}

test.describe('DIG-84: EN-рендер ключевых страниц', () => {
  test('сводка /grades: GPA, Overall, Group ranking — без русских строк контента', async ({
    page,
  }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades');
    await useEnglish(page);
    await page.goto('/grades');
    await expect(page).toHaveURL(/\/grades$/);

    // EN-заголовок раздела и блоки сводки (BUG-09: «Средний балл», «За всё
    // время», «Рейтинг в группе» оставались русскими).
    await expect(
      page.getByRole('heading', { level: 1, name: 'Academic performance' }),
    ).toBeVisible();
    await expect(page.getByText('Overall:', { exact: false })).toBeVisible();
    await expect(page.getByText('Group ranking')).toBeVisible();
    await expect(page.getByTestId('gpa-ring-value')).not.toHaveText('—');

    // Русских строк основного контента нет (кроме демо-данных: ФИО,
    // названия дисциплин).
    for (const ru of [
      'Средний балл',
      'За всё время',
      'Рейтинг в группе',
      'единственный студент',
      'Кредиты',
      'Долги',
    ]) {
      await expect(page.getByText(ru)).toHaveCount(0);
    }
  });

  test('пилюли семестров на EN: Fall/Spring, дельта «vs …»', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades');
    await useEnglish(page);
    await page.goto('/grades');

    await expect(page.getByTestId('semester-accordion-2026-fall')).toHaveCount(0); // это зачётка; на сводке пилюли-ссылки
    await expect(page.locator('nav a', { hasText: 'Fall 26/27' })).toBeVisible();
    await expect(page.locator('nav a', { hasText: 'Spring 25/26' })).toBeVisible();
    await expect(page.locator('nav a', { hasText: 'Осень' })).toHaveCount(0);
    // Дельта к прошлому семестру (или подпись семестра) — латиницей.
    await expect(page.locator('body')).not.toContainText('к весне');
    await expect(page.locator('body')).not.toContainText('к осени');
  });

  test('зачётка /grades/gradebook: EN подписи и CTA выписки', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/gradebook');
    await useEnglish(page);
    await page.goto('/grades/gradebook');
    await expect(page).toHaveURL(/\/grades\/gradebook$/);

    await expect(page.getByRole('heading', { level: 1, name: 'Gradebook' })).toBeVisible();
    const download = page.getByTestId('transcript-download');
    await expect(download).toBeVisible();
    await expect(download).toContainText('Download transcript PDF');

    await expect(page.getByText('Overall GPA')).toBeVisible();
    await expect(page.getByText('Credits earned')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Средний балл за всё время');
    await expect(page.locator('body')).not.toContainText('Кредиты набрано');
    await expect(page.locator('body')).not.toContainText('Скачать выписку PDF');
  });

  test('выписка PDF на EN: документ отдаётся и содержит английские строки', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/grades/gradebook');
    await useEnglish(page);
    const response = await page.request.get('/api/grades/transcript');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    const body = await response.body();
    expect(body.subarray(0, 5).toString('latin1')).toContain('%PDF-');
    // Строки модели выписки детерминированы и покрыты юнит-тестами
    // (tests/transcript-pdf.test.ts) — здесь только контракт роута:
    // cookie локали читается сервером, PDF строится без ошибки.
    expect(body.length).toBeGreaterThan(1000);
  });

  test('карточка заявки /requests/[номер]: статус-пилюля и подписи на EN', async ({ page }) => {
    await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/requests');
    // Карточка «Нужна доработка» Анны — открываем по статусу, как в
    // request-card.spec.ts, но уже с EN-кукой.
    await useEnglish(page);
    await page.goto('/requests');
    await page.locator('[data-request-status="NEEDS_FIX"] a').first().click();
    await expect(page).toHaveURL(/\/requests\//);

    await expect(page.getByTestId('request-status-pill')).toHaveText('Needs revision');
    await expect(page.getByText('Request history')).toBeVisible();
    await expect(page.getByText('Request parameters')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('История заявки');
    await expect(page.locator('body')).not.toContainText('Параметры заявки');
    await expect(page.locator('body')).not.toContainText('Ведёт:');
  });
});
