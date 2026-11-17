import { expect, test, type Page } from '@playwright/test';

// DIG-41 — e2e «Договоры и оплата» (/finance, чёрный ящик):
//  - бюджетник: сводка с формой обучения, стипендией и «Задолженности нет»,
//    блок договора отсутствует, выплаты не пустые (приёмка);
//  - платник: договор с таймлайном платежей, «Скачать квитанцию» отдаёт PDF;
//  - документы: пилюли-фильтр и скачивание демо-PDF;
//  - действия → мастер заявки с предвыбором типа;
//  - нигде нет банковских реквизитов и платёжных форм (приёмка);
//  - сотруднику — пустое состояние.
//
// Изоляция состояния: только чтение (экран демонстрационный, мутаций нет),
// поэтому пользователи не пересекаются с другими спеками.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' }; // бюджет
const ILYA = { login: 'ilya.petrov', password: 'ilya-demo-2026' }; // контракт
const DEAN = { login: 'dean.kovaleva', password: 'dean-demo-2026' }; // сотрудник

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

test.describe('DIG-41: экран «Финансы» — бюджетник', () => {
  test('сводка: форма обучения, стипендия, «Задолженности нет», выплаты не пустые', async ({
    page,
  }) => {
    await signIn(page, ANNA.login, ANNA.password, '/finance');

    await expect(page).toHaveURL(/\/finance$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Финансы' })).toBeVisible();

    const summary = page.getByTestId('finance-summary');
    await expect(summary).toContainText('Бюджетная основа');
    await expect(summary).toContainText('Стипендия');
    await expect(summary).toContainText('Государственная академическая');
    await expect(summary).toContainText('Ближайшая выплата');
    await expect(summary).toContainText('Задолженности нет');

    // Приёмка: блок договора у бюджетника отсутствует…
    await expect(page.getByTestId('finance-contract')).toHaveCount(0);
    // …а выплаты и документы на месте — экран не пустой.
    const payouts = page.getByTestId('finance-payouts');
    await expect(payouts).toContainText('Материальная помощь');
    await expect(payouts.locator('li')).toHaveCount(5);
    await expect(page.getByTestId('finance-documents')).toBeVisible();
    await expect(page.getByTestId('finance-documents')).toContainText(
      'Договор о прохождении практики',
    );
  });

  test('документы: фильтр «Акты» оставляет только акты, скачивание отдаёт PDF', async ({
    page,
  }) => {
    await signIn(page, ANNA.login, ANNA.password, '/finance');

    const docs = page.getByTestId('finance-documents');
    await expect(docs.getByTestId('finance-doc-list').locator('li')).toHaveCount(2);

    // Пилюля фильтрует список.
    await docs.getByTestId('finance-doc-filter').getByRole('button', { name: 'Акты' }).click();
    await expect(docs.getByTestId('finance-doc-list').locator('li')).toHaveCount(1);
    await expect(docs.getByTestId('finance-doc-list')).toContainText('Акт о прохождении практики');

    // Скачивание — демо-PDF с пометкой концепта (бинарник отдаётся как файл).
    const download = await docs
      .getByTestId('finance-doc-list')
      .getByTestId('finance-doc-download')
      .first()
      .getAttribute('href');
    expect(download).toMatch(/^\/api\/finance\/documents\//);
    const response = await page.request.get(download!);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
    expect((await response.body()).length).toBeGreaterThan(1000);

    // «Все» возвращает полный список.
    await docs.getByTestId('finance-doc-filter').getByRole('button', { name: 'Все' }).click();
    await expect(docs.getByTestId('finance-doc-list').locator('li')).toHaveCount(2);
  });

  test('действия ведут в мастер заявки с предвыбором типа', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/finance');

    await expect(page.getByTestId('finance-action-material-aid')).toHaveAttribute(
      'href',
      '/requests?order=fin-material-aid',
    );
    await expect(page.getByTestId('finance-action-scholarship-cert')).toHaveAttribute(
      'href',
      '/requests?order=fin-scholarship-cert',
    );

    // Клик может «проглотиться» на ещё не гидрированной странице (гонка сразу
    // после логина) — повторяем клик, пока мастер не откроется (идиома toPass).
    await expect(async () => {
      await page.getByTestId('finance-action-scholarship-cert').click();
      await expect(page).toHaveURL(/\/requests\?order=fin-scholarship-cert$/, {
        timeout: 5_000,
      });
    }).toPass({ timeout: 15_000 });
    // Мастер открыт на шаге 1 с предвыбранным типом словаря (DIG-31 + DIG-41).
    await expect(page.getByTestId('order-wizard-root')).toHaveAttribute(
      'data-auto-type',
      'SCHOLARSHIP_CERT',
    );
    await expect(page.getByTestId('wizard-type-option-SCHOLARSHIP_CERT')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });
});

test.describe('DIG-41: экран «Финансы» — платник', () => {
  test('договор: таймлайн платежей, статусы и «Скачать квитанцию» → PDF', async ({ page }) => {
    await signIn(page, ILYA.login, ILYA.password, '/finance');

    const contract = page.getByTestId('finance-contract');
    await expect(contract).toContainText('Договор на обучение');
    await expect(contract).toContainText('ДОГ-');
    await expect(contract).toContainText('семестр');
    await expect(contract).toContainText('96');

    // Таймлайн: минимум три платежа — оплаченный, «к оплате» и ожидаемый.
    const payments = contract.getByTestId('finance-payment');
    await expect(payments).toHaveCount(3);
    await expect(contract).toContainText('Оплачен');
    await expect(contract).toContainText('К оплате');
    await expect(contract).toContainText('Ожидается');

    // Сводка показывает задолженность по платежу «к оплате».
    const summary = page.getByTestId('finance-summary');
    await expect(summary).toContainText('Договор (платное)');
    await expect(summary).toContainText('К оплате');

    // «Скачать квитанцию» оплаченного платежа отдаёт PDF-файл.
    const receiptHref = await contract.getByTestId('finance-receipt-download').getAttribute('href');
    expect(receiptHref).toMatch(/^\/api\/finance\/documents\//);
    const response = await page.request.get(receiptHref!);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
  });

  test('квитанции недоступны чужому набору и сотруднику (единый 404)', async ({
    page,
    browser,
  }) => {
    await signIn(page, ILYA.login, ILYA.password, '/finance');

    // Id квитанции Ильи.
    const receiptHref = await page
      .getByTestId('finance-contract')
      .getByTestId('finance-receipt-download')
      .getAttribute('href');

    // Анна (бюджет) — этого документа в её наборе нет: тот же 404.
    const annaPage = await browser.newPage();
    await signIn(annaPage, ANNA.login, ANNA.password, '/finance');
    const foreign = await annaPage.request.get(receiptHref!);
    expect(foreign.status()).toBe(404);
    await annaPage.close();

    // Сотруднику деканата студенческие финансы недоступны на уровне роута
    // (гвард ctx.role !== 'STUDENT') — тот же единый 404 без раскрытия причины.
    const deanPage = await browser.newPage();
    await signIn(deanPage, DEAN.login, DEAN.password, '/finance');
    const staffAttempt = await deanPage.request.get(receiptHref!);
    expect(staffAttempt.status()).toBe(404);
    await deanPage.close();

    // Мусорный id — тот же единый 404.
    const garbage = await page.request.get('/api/finance/documents/fin-doc-unknown');
    expect(garbage.status()).toBe(404);
  });
});

test.describe('DIG-41: доступ и приёмка', () => {
  test('сотруднику — пустое состояние без финансовых данных', async ({ page }) => {
    await signIn(page, DEAN.login, DEAN.password, '/finance');
    await expect(page.getByRole('heading', { level: 1, name: 'Финансы' })).toBeVisible();
    await expect(page.getByText('Экран доступен студентам')).toBeVisible();
    await expect(page.getByTestId('finance-summary')).toHaveCount(0);
    await expect(page.getByTestId('finance-contract')).toHaveCount(0);
  });

  test('нигде нет банковских реквизитов и платёжных форм (критерий приёмки)', async ({
    browser,
  }) => {
    for (const user of [ANNA, ILYA]) {
      const context = await browser.newContext();
      const userPage = await context.newPage();
      await signIn(userPage, user.login, user.password, '/finance');
      const body = await userPage.locator('body').innerText();
      expect(body, user.login).not.toMatch(/БИК|ИНН|КПП|р\/с\b|IBAN|SWIFT/i);
      expect(body, user.login).not.toMatch(/оплатить картой|перевести деньги|session_id/i);
      await context.close();
    }
  });

  test('раздел «Финансы» доступен из меню «Ещё» (мобайл-путь)', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 360, 'mobile-360 only');
    await signIn(page, ANNA.login, ANNA.password, '/dashboard');
    // На 360 px раздел живёт в «Ещё».
    await page.getByRole('link', { name: 'Ещё' }).click();
    await expect(page).toHaveURL(/\/more$/);
    await page.getByRole('link', { name: 'Финансы' }).click();
    await expect(page).toHaveURL(/\/finance$/);
    await expect(page.getByTestId('finance-summary')).toBeVisible();
  });
});
