import { expect, test, type Page } from '@playwright/test';

// DIG-31 — e2e «Заказ справки или заявления» (чёрный ящик, приёмка задачи):
//  - мастер в 3 шага: «Что нужно → Параметры → Проверка», прогресс
//    «Шаг N из 3» и Stepper с aria-current="step";
//  - справка для военкомата: обязательный адресат (клиентская валидация,
//    понятная ошибка у поля), экземпляры, способ получения, комментарий,
//    сводка с «Изменить», согласие, успех с номером и ожидаемой датой;
//  - мгновенная справка об обучении: доставка только «PDF в кабинете»,
//    успех «Справка готова» с реальной загрузкой PDF, статус «Выполнена»;
//  - черновик: Esc → «Выйти без сохранения?», «Продолжить заполнение»
//    возвращает с данными, «Выйти» закрывает и стирает черновик;
//  - работа с клавиатуры: нативные радио (стрелки), кнопки (Enter);
//  - адаптив: 1440 px — модальное окно, 360 px — полноэкранный лист.
//
// Изоляция состояния: прототип живёт на memory-сторе сервера, а проекты
// desktop-1440 и mobile-360 идут параллельно. Тесты, создающие заявки,
// разбиты по парам «пользователь + проект» (desktop → Анна, mobile → Илья),
// чтобы параллельные прогоны никогда не трогали один и тот же список заявок.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };
const ILYA = { login: 'ilya.petrov', password: 'ilya-demo-2026' };

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

const projectUser = () => (test.info().project.name === 'desktop-1440' ? ANNA : ILYA);

test.describe('DIG-31: мастер заказа — военкомат (полный путь)', () => {
  test('справка для отсрочки от армии: адресат обязателен, сводка, успех, карточка заявки', async ({
    page,
  }) => {
    const user = projectUser();
    await signIn(page, user.login, user.password, '/requests?order=cert-defer');

    // Шаг 1: мастер открыт по ?order=, документ предвыбран, срок и формат видны.
    const wizard = page.getByRole('dialog');
    await expect(wizard).toBeVisible();
    await expect(page.getByTestId('wizard-doc-cert-defer')).toBeChecked();
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 1 из 3');
    await expect(wizard).toContainText('Справка для отсрочки от армии');
    await expect(wizard).toContainText('1 день');
    await expect(wizard).toContainText('PDF');

    // Шаг 2: прогресс «Шаг 2 из 3».
    await page.getByTestId('wizard-next').click();
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 2 из 3');

    // Клиентская валидация: пустой адресат — понятная ошибка у поля,
    // дальше мастер не пускает.
    await page.getByTestId('wizard-next').click();
    await expect(page.getByTestId('wizard-error-destination')).toHaveText(
      'Укажите, куда предоставляется документ',
    );
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 2 из 3');

    // Данные студента подставлены из профиля — вводить заново не нужно.
    await expect(page.getByTestId('wizard-student-card')).toContainText(
      user.login === ANNA.login ? 'Ковалёва' : 'Смирнов',
    );

    await page.getByTestId('wizard-destination').fill('Военкомат по месту учёбы');
    await page.getByTestId('wizard-copies').fill('2');
    await page.getByTestId('wizard-delivery-PICKUP').check();
    await page.getByTestId('wizard-comment').fill('Нужно к 20 ноября');

    // Шаг 3: сводка блоками, согласие блокирует «Отправить».
    await page.getByTestId('wizard-next').click();
    const review = page.getByTestId('wizard-review');
    await expect(review).toBeVisible();
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 3 из 3');
    await expect(page.getByTestId('wizard-review-document')).toContainText(
      'Справка для отсрочки от армии',
    );
    await expect(page.getByTestId('wizard-review-params')).toContainText(
      'Военкомат по месту учёбы',
    );
    await expect(page.getByTestId('wizard-review-params')).toContainText('Забрать в деканате');
    await expect(page.getByTestId('wizard-review-params')).toContainText('Нужно к 20 ноября');

    const submit = page.getByTestId('wizard-submit');
    await expect(submit).toBeDisabled();
    await page.getByTestId('wizard-consent').check();
    await expect(submit).toBeEnabled();
    await submit.click();

    // Успех: номер заявки, ожидаемая дата, «Следить за статусом»;
    // у не-мгновенной справки кнопки «Скачать PDF» нет.
    await expect(page.getByTestId('wizard-success')).toBeVisible();
    const number = (await page.getByTestId('wizard-success-number').innerText()).trim();
    expect(number).toMatch(/^SR-\d{4}-[A-Z0-9]{5}$/);
    await expect(page.getByTestId('wizard-success-date')).toContainText('Ожидаемая дата');
    await expect(page.getByTestId('wizard-success-status')).toBeVisible();
    await expect(page.getByTestId('wizard-success-download')).toHaveCount(0);

    // «Следить за статусом» ведёт в карточку заявки с названием документа.
    await page.getByTestId('wizard-success-status').click();
    await page.waitForURL(new RegExp(`/requests/${number}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Справка для отсрочки от армии',
    );
    await expect(page.getByText('Подана', { exact: true })).toBeVisible(); // SUBMITTED — не мгновенная
  });

  test('поля «Изменить» на шаге 3 возвращают к данным без потери', async ({ page }) => {
    const user = projectUser();
    await signIn(page, user.login, user.password, '/requests?order=cert-defer');
    await page.getByTestId('wizard-next').click();
    await page.getByTestId('wizard-destination').fill('Военкомат');
    await page.getByTestId('wizard-next').click();
    await expect(page.getByTestId('wizard-review')).toBeVisible();

    // «Изменить» у блока «Документ» → шаг 1; данные не теряются.
    await page.getByTestId('wizard-edit-document').click();
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 1 из 3');
    await page.getByTestId('wizard-next').click();
    await expect(page.getByTestId('wizard-destination')).toHaveValue('Военкомат');

    // «Изменить» у блока «Параметры» (со шага 3) → шаг 2, значения на месте.
    await page.getByTestId('wizard-next').click();
    await expect(page.getByTestId('wizard-review')).toBeVisible();
    await page.getByTestId('wizard-edit-params').click();
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 2 из 3');
    await expect(page.getByTestId('wizard-destination')).toHaveValue('Военкомат');
  });
});

test.describe('DIG-31: мастер заказа — мгновенная справка об обучении', () => {
  test('«Справка готова»: только PDF-доставка, реальная загрузка PDF, статус «Выполнена»', async ({
    page,
  }) => {
    const user = projectUser();
    await signIn(page, user.login, user.password, '/requests');

    // CTA открывает мастер без предвыбора (шаг 1).
    await page.getByTestId('requests-order-cta').click();
    const wizard = page.getByRole('dialog');
    await expect(wizard).toBeVisible();
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 1 из 3');

    // Тип можно сменить: выбираем мгновенную «Справку об обучении».
    const instantRadio = page.getByTestId('wizard-doc-cert-enrollment');
    await instantRadio.check();
    await expect(instantRadio).toBeChecked();

    await page.getByTestId('wizard-next').click();
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 2 из 3');

    // Мгновенному документу доступен только способ «PDF в кабинете».
    await expect(page.getByTestId('wizard-delivery-PDF')).toBeChecked();
    const deliveryCount = await page.getByTestId(/^wizard-delivery-/).count();
    expect(deliveryCount).toBe(1);
    // Язык (RU/EN) у справки есть; адресат опционален (не «обязателен»).
    await expect(wizard).toContainText('Язык документа');
    await expect(page.getByTestId('wizard-error-destination')).toHaveCount(0);

    await page.getByTestId('wizard-next').click();
    await page.getByTestId('wizard-consent').check();
    await page.getByTestId('wizard-submit').click();

    // Успех мгновенной: «Справка готова» + «Скачать PDF».
    await expect(page.getByTestId('wizard-success')).toBeVisible();
    await expect(wizard).toContainText('Справка готова');
    const number = (await page.getByTestId('wizard-success-number').innerText()).trim();

    // PDF реально скачивается по ссылке из мастера.
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('wizard-success-download').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // Заявка создана со статусом «Выполнена» (мгновенная).
    await page.getByTestId('wizard-success-status').click();
    await page.waitForURL(new RegExp(`/requests/${number}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Справка об обучении');
    await expect(page.getByText('Выполнена')).toBeVisible();

    // Заявка видна в списке под понятным названием (не обезличенная).
    await page.goto('/requests');
    await expect(page.locator('ul a', { hasText: number })).toContainText('Справка об обучении');
  });
});

test.describe('DIG-31: черновик, прогресс и клавиатура', () => {
  test('Esc с черновиком → «Выйти без сохранения?»; продолжение и выход', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/requests');
    await page.getByTestId('requests-order-cta').click();
    await page.getByTestId('wizard-doc-cert-grades').check();
    await page.getByTestId('wizard-next').click();
    await page.getByTestId('wizard-destination').fill('Банк для visas');

    // Esc (крестик/фон ведут себя так же через onOpenChange) — подтверждение.
    await page.keyboard.press('Escape');
    const confirm = page.getByTestId('wizard-confirm');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Выйти без сохранения?');

    // «Продолжить заполнение» возвращает к шагу 2 с данными.
    await page.getByTestId('wizard-confirm-stay').click();
    await expect(confirm).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('wizard-destination')).toHaveValue('Банк для visas');

    // «Выйти» закрывает мастер и стирает черновик: повторное открытие — чистый шаг 1.
    await page.keyboard.press('Escape');
    await page.getByTestId('wizard-confirm-leave').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByTestId('requests-order-cta').click();
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 1 из 3');
    await page.getByTestId('wizard-close').click();
  });

  test('прогресс, aria-current="step" и работа с клавиатуры (стрелки/Enter)', async ({ page }) => {
    await signIn(page, ANNA.login, ANNA.password, '/requests');
    await page.getByTestId('requests-order-cta').click();

    // Нативные радио: стрелка вниз переносит выбор внутри группы.
    const firstRadio = page.getByTestId('wizard-doc-cert-enrollment');
    await firstRadio.focus();
    await firstRadio.check();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('wizard-doc-cert-grades')).toBeChecked();

    // «Далее» нажимается с клавиатуры (Enter на сфокусированной кнопке).
    const next = page.getByTestId('wizard-next');
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 2 из 3 — Параметры');
    await expect(page.locator('li[aria-current="step"]')).toContainText('Параметры');

    // «Назад» тоже с клавиатуры.
    const back = page.getByTestId('wizard-back');
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('wizard-progress')).toContainText('Шаг 1 из 3');
  });
});

test.describe('DIG-31: адаптив мастера', () => {
  test('1440 px: модальное окно — центрировано, ширина ограничена', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'desktop-1440 only');
    await signIn(page, ANNA.login, ANNA.password, '/requests');
    await page.getByTestId('requests-order-cta').click();
    const popup = page.getByRole('dialog');
    await expect(popup).toBeVisible();
    const box = await popup.boundingBox();
    expect(box).not.toBeNull();
    // Окно (640 px) меньше вьюпорта и горизонтально центрировано.
    expect(box!.width).toBeLessThan(720);
    expect(Math.abs(box!.x - (1440 - box!.width) / 2)).toBeLessThan(40);
    expect(box!.height).toBeLessThan(900);
  });

  test('360 px: полноэкранный лист — от края до края', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-360', 'mobile-360 only');
    await signIn(page, ILYA.login, ILYA.password, '/requests');
    await page.getByTestId('requests-order-cta').click();
    const popup = page.getByRole('dialog');
    await expect(popup).toBeVisible();
    const box = await popup.boundingBox();
    expect(box).not.toBeNull();
    // Лист занимает всю ширину вьюпорта и прижат к левому краю.
    expect(box!.x).toBeLessThan(1);
    expect(Math.abs(box!.width - 360)).toBeLessThan(2);
  });
});
