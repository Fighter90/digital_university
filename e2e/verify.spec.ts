import { expect, test, type Page } from '@playwright/test';

// DIG-47 — e2e «Проверка подлинности справки» (чёрный ящик):
//  - страница /verify/<код> публична: аноним видит статус, тип, дату,
//    ФИО частично; полного имени, оценок и контактов нет;
//  - три статуса: действителен (зелёный), отозван (красный), не найден;
//  - невалидный код не отличим от отсутствующего;
//  - владелец скачивает PDF справки (application/pdf, %PDF) и попадает
//    со страницы заявки на проверку подлинности;
//  - отзыв сотрудником (POST через same-origin fetch) сразу меняет статус
//    страницы на «Отозван»;
//  - плашка «Концепт для конкурса» и подсказка на месте;
//  - 360 px: карточка в одну колонку без горизонтального скролла.
//
// Параллельная безопасность (проекты desktop-1440 и mobile-360 идут
// одновременно на одном memory-сторе): для отзыва у каждого проекта
// СВОЯ действительная справка из сида (DEMO_CERTIFICATES), читаемые
// проверки используют общие коды и не меняют состояние.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };
const DEAN = { login: 'dean.kovaleva', password: 'dean-demo-2026' };

/** Общие коды сида (читаемые проверки — одинаковые для всех проектов). */
const VALID_CODE = 'QK4W-R7X2-M5DJ-V3TH-PL6N-B2QF-UXK3-ZD6A'; // Анна, действительна
const REVOKED_CODE = 'YT3Q-C6VB-N2KH-W5LM-R7XD-P4FS-J6GQ-Z3MT'; // Илья, отозвана
const NOT_FOUND_CODE = 'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ';

/** Код для отзыва — СВОЙ на проект, чтобы параллельные тесты не конфликтовали. */
const REVOKE_CODES: Record<string, string> = {
  'desktop-1440': 'P7QM-X3TB-K6VD-H4LN-F2RS-C5QB-W2XK-Z4MT',
  'mobile-360': 'T5WQ-C2XV-N7KD-M3LP-R6SF-B4QG-Y2HK-V7ZT',
};

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

test.describe('DIG-47: публичная проверка справки', () => {
  test('аноним: действительная справка — зелёный статус и минимум данных', async ({ page }) => {
    await page.goto(`/verify/${VALID_CODE}`);

    await expect(page.getByTestId('verify-status')).toContainText('Документ действителен');
    await expect(page.getByTestId('verify-type')).toHaveText('Справка об обучении');
    await expect(page.getByTestId('verify-holder')).toHaveText('Анна К.');
    await expect(page.getByTestId('verify-issued')).toContainText('2026');

    // Никаких лишних данных на странице.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Ковалёва');
    expect(body).not.toContain('anna.smirnova');
    expect(body).not.toContain('example.edu');
    expect(body).not.toContain('средний балл');

    // Подсказка и плашка концепта.
    await expect(page.getByText('Как проверить документ')).toBeVisible();
    await expect(page.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
  });

  test('аноним: отозванная справка — красный статус, реквизиты видны', async ({ page }) => {
    await page.goto(`/verify/${REVOKED_CODE}`);
    await expect(page.getByTestId('verify-status')).toContainText('Отозван');
    await expect(page.getByTestId('verify-type')).toHaveText('Справка об обучении');
    await expect(page.getByTestId('verify-holder')).toHaveText('Илья С.');
  });

  test('аноним: неизвестный код — «Документ не найден» без полей', async ({ page }) => {
    await page.goto(`/verify/${NOT_FOUND_CODE}`);
    await expect(page.getByTestId('verify-status')).toContainText('Документ не найден');
    await expect(page.getByTestId('verify-type')).toHaveCount(0);
    await expect(page.getByTestId('verify-holder')).toHaveCount(0);
  });

  test('аноним: невалидный код выглядит как несуществующий', async ({ page }) => {
    await page.goto('/verify/hello');
    await expect(page.getByTestId('verify-status')).toContainText('Документ не найден');
    await expect(page.getByTestId('verify-type')).toHaveCount(0);
  });

  test('360 px: карточка в одну колонку, без горизонтального скролла', async ({ page }) => {
    await page.goto(`/verify/${VALID_CODE}`);
    await expect(page.getByTestId('verify-status')).toBeVisible();
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('владелец: карточка заявки ведёт к PDF и проверке подлинности', async ({
    page,
  }, testInfo) => {
    await signIn(page, ANNA.login, ANNA.password, '/requests');
    await page.locator('a[href^="/requests/SR-"]').first().click();
    await expect(page).toHaveURL(/\/requests\/SR-/);

    const block = page.getByTestId('certificate-block');
    await expect(block).toBeVisible();

    // Код проверки на карточке валиден по формату (8 групп по 4).
    const code = (await page.getByTestId('certificate-code').innerText()).trim();
    expect(code).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){7}$/);

    // Ссылка проверки ведёт на страницу этого кода (новая вкладка).
    await expect(page.getByTestId('certificate-verify')).toHaveAttribute('href', `/verify/${code}`);

    // PDF скачивается тем же кодом: content-type и магия %PDF.
    const pdfHref = await page.getByTestId('certificate-pdf').getAttribute('href');
    expect(pdfHref).toBeTruthy();
    const pdf = await page.request.get(pdfHref!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    const bytes = await pdf.body();
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    void testInfo;
  });

  test('сотрудник отзывает справку — страница проверки сразу показывает «Отозван»', async ({
    page,
  }) => {
    const code = REVOKE_CODES[test.info().project.name];
    test.skip(!code, `нет отдельной справки для проекта ${test.info().project.name}`);

    // До отзыва — действительна (аноним).
    await page.goto(`/verify/${code}`);
    await expect(page.getByTestId('verify-status')).toContainText('Документ действителен');

    // Отзыв сотрудником через same-origin fetch (Origin и cookies — из браузера).
    await signIn(page, DEAN.login, DEAN.password, '/dashboard');
    const response = await page.evaluate(
      async (api) => {
        const res = await fetch(api.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: api.code, reason: 'Отзыв в e2e: проверка отзыва' }),
        });
        return { status: res.status };
      },
      { url: '/api/staff/certificates/revoke', code },
    );
    expect(response.status).toBe(200);

    // Анонимная проверка сразу видит «Отозван».
    await page.context().clearCookies();
    await page.goto(`/verify/${code}`);
    await expect(page.getByTestId('verify-status')).toContainText('Отозван');
  });

  test('студент не может отозвать справку (единый 404)', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/dashboard');
    const response = await page.evaluate(
      async (api) => {
        const res = await fetch(api.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: api.code }),
        });
        return { status: res.status };
      },
      { url: '/api/staff/certificates/revoke', code: VALID_CODE },
    );
    expect(response.status).toBe(404);

    // Справка не изменилась.
    await page.context().clearCookies();
    await page.goto(`/verify/${VALID_CODE}`);
    await expect(page.getByTestId('verify-status')).toContainText('Документ действителен');
  });
});
