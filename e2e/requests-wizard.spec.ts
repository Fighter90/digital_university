import { expect, test, type Page } from '@playwright/test';

// DIG-31 — e2e мастера «Заказ справки или заявления» (Figma
// «06 · Заявки — мастер заказа»). Приёмка: заказ справки для военкомата
// (предвыбор из каталога), мгновенная справка об обучении с «Скачать PDF»
// сразу после отправки, подтверждение «Выйти без сохранения?» при
// случайном закрытии черновика.
//
// Сценарий выполняется вторым демо-студентом (ilya.petrov): счётчики
// пилюль Анны зафиксированы читательным контрактом e2e/requests.spec.ts
// (DIG-32) и не должны меняться от заказов мастера.

async function signIn(page: Page, order: string) {
  const next = encodeURIComponent(`/requests?order=${order}`);
  await page.goto(`/login?next=${next}`);
  await page.getByLabel('Логин').fill('ilya.petrov');
  await page.getByLabel('Пароль', { exact: true }).fill('ilya-demo-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/requests\\?order=${order}$`));
}

test('заказ справки для военкомата: предвыбор типа, параметры, проверка, заявка с номером', async ({
  page,
}) => {
  await signIn(page, 'cert-defer');

  // Мастер открыт на шаге 1, тип предвыбран картой «cert-defer →
  // CERT_ENROLLMENT с назначением «для военкомата»», тип можно сменить.
  const wizard = page.getByTestId('order-wizard');
  await expect(wizard).toBeVisible();
  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 1 из 3');
  await expect(page.getByTestId('wizard-type-option-CERT_ENROLLMENT')).toHaveAttribute(
    'data-selected',
    'true',
  );
  await expect(wizard).toContainText('Мгновенно');

  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 2 из 3');

  // Назначение предзаполнено пресетом, студент дополняет параметры.
  await expect(page.getByTestId('wizard-field-purpose')).toHaveValue('для военкомата');
  await page.getByTestId('wizard-destination').fill('Военкомат по месту учёбы');
  await page.getByTestId('wizard-comment').fill('Справка нужна для отсрочки');
  await page
    .getByTestId('wizard-files')
    .setInputFiles({
      name: 'заявление.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('demo-bytes'),
    });
  await expect(page.getByTestId('wizard-files-list')).toContainText('заявление.pdf');

  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 3 из 3');

  // Сводка: документ, параметры, данные студента из профиля (не вводятся).
  const paramsSummary = page.getByTestId('wizard-summary-params');
  await expect(paramsSummary).toContainText('для военкомата');
  await expect(paramsSummary).toContainText('Военкомат по месту учёбы');
  await expect(paramsSummary).toContainText('PDF в кабинете');
  await expect(page.getByTestId('wizard-summary-profile')).toContainText('Илья Смирнов');

  // Без согласия «Данные верны» отправка недоступна.
  await expect(page.getByTestId('wizard-submit')).toBeDisabled();
  await page.getByTestId('wizard-consent').check();
  await page.getByTestId('wizard-submit').click();

  const success = page.getByTestId('wizard-success');
  await expect(success).toBeVisible();
  await expect(success).toContainText('Справка готова');

  const number = await page.getByTestId('wizard-success-number').textContent();
  expect(number).toMatch(/^ЗД-\d{4}-\d{6}$/);

  // Мгновенный тип: PDF готов сразу и отдаётся владельцу.
  const download = page.getByTestId('wizard-success-download');
  await expect(download).toBeVisible();
  const pdf = await page.request.get((await download.getAttribute('href'))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');

  // «Следить за статусом» ведёт в карточку заявки с этим номером.
  await page.getByTestId('wizard-success-track').click();
  await expect(page).toHaveURL(/\/requests\/(%D0%97%D0%94|ЗД)-\d{4}-\d{6}$/);
  await expect(page.getByTestId('canonical-request-card')).toContainText('для военкомата');
});

test('мгновенная справка об обучении: заказ и «Скачать PDF» сразу после отправки', async ({
  page,
}) => {
  await signIn(page, 'cert-enrollment');

  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 1 из 3');
  await page.getByTestId('wizard-next').click();

  // Назначение студент выбирает сам (без пресета).
  await page.getByTestId('wizard-field-purpose').selectOption('для банка');
  await page.getByTestId('wizard-copies').selectOption('2');
  await page.getByTestId('wizard-delivery-PDF_ONLINE').check();

  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('wizard-summary-document')).toContainText('Справка об обучении');

  await page.getByTestId('wizard-consent').check();
  await page.getByTestId('wizard-submit').click();

  const success = page.getByTestId('wizard-success');
  await expect(success).toBeVisible();
  await expect(success).toContainText('Справка готова');

  const download = page.getByTestId('wizard-success-download');
  const href = await download.getAttribute('href');
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');

  // «Готово» закрывает мастер; параметр заказа убран из адресной строки.
  await page.getByTestId('wizard-done').click();
  await expect(page.getByTestId('order-wizard')).toHaveCount(0);
  await expect(page).toHaveURL(/\/requests$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Мои заявки' })).toBeVisible();
});

test('черновик не теряется при случайном закрытии: «Выйти без сохранения?»', async ({ page }) => {
  // order=new — вход по кнопке «Заказать справку», без предвыбора типа.
  await signIn(page, 'new');
  await expect(page.getByTestId('wizard-type-option-CERT_ENROLLMENT')).toHaveAttribute(
    'data-selected',
    'false',
  );

  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 1 из 3');
  await page.getByTestId('wizard-type-option-GRADES_EXTRACT').click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-comment').fill('черновик выписки');

  // Esc при заполненном черновике открывает подтверждение, а не закрывает.
  await page.keyboard.press('Escape');
  const confirm = page.getByTestId('wizard-exit-confirm');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Выйти без сохранения?');

  // «Продолжить заполнение» возвращает в мастер с сохранённым значением.
  await page.getByTestId('wizard-exit-stay').click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByTestId('wizard-comment')).toHaveValue('черновик выписки');
  await expect(page.getByTestId('wizard-step-label')).toContainText('Шаг 2 из 3');

  // Явный «Выйти без сохранения» закрывает мастер и чистит ?order=.
  await page.keyboard.press('Escape');
  await expect(confirm).toBeVisible();
  await page.getByTestId('wizard-exit-discard').click();
  await expect(page.getByTestId('order-wizard')).toHaveCount(0);
  await expect(page).toHaveURL(/\/requests$/);
});
