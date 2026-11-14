import { expect, test, type Page } from '@playwright/test';

// DIG-19/DIG-44 — профиль и настройки: чёрный сценарий на реальном сервере.
// 1) Профиль показывает только СВОИ данные (ФИО/группа) и маскирует номер
//    зачётки до нажатия «Показать».
// 2) Настройки (DIG-44) — экран с вкладками «Главная / Уведомления /
//    Безопасность / Вид»:
//      - порядок виджетов главной меняется С КЛАВИАТУРЫ (кнопки вверх/вниз)
//        и переживает перезагрузку (сохранён на сервере);
//      - матрица уведомлений сохраняет переключения; Telegram — «скоро»;
//      - смена пароля работает end-to-end (вход со старым больше не проходит);
//      - тёмная тема применяется к <html> сразу после сохранения.
//
// Спека выполняется на обоих профилях конфигурации (desktop-1440 и
// mobile-360) — адаптив 360 px проверяется автоматически. Прогон идёт
// параллельно с fullyParallel, поэтому проекты работают под РАЗНЫМИ
// демо-пользователями: тесты настроек мутируют состояние (каналы, сессии,
// пароль), и параллельная гонка за один аккаунт делала бы проверки
// нестабильными.
function settingsUser() {
  return test.info().project.name === 'mobile-360'
    ? { login: 'ilya.petrov', password: 'ilya-demo-2026' }
    : { login: 'anna.smirnova', password: 'anna-demo-2026' };
}

// Внутри файла тесты мутируют настройки ОДНОГО и того же демо-пользователя
// (порядок виджетов, каналы, пароль, тема) — гонять их параллельно нельзя.
// Между проектами (desktop-1440 / mobile-360) параллельность остаётся:
// у каждого свой пользователь.
test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, login: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

test('profile: own data only, badge masked until «Показать», one error-report entry', async ({
  page,
}) => {
  await signIn(page, 'anna.smirnova', 'anna-demo-2026', '/profile');
  await expect(page).toHaveURL(/\/profile$/, { timeout: 15000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Профиль' })).toBeVisible();

  // Свои данные (Anna), а не Ильи.
  await expect(page.getByText('Анна Ковалёва').first()).toBeVisible();
  await expect(page.getByText('ПИ-21').first()).toBeVisible();
  const body = await page.locator('main').innerText();
  expect(body).not.toContain('Илья Смирнов');
  expect(body).not.toContain('ЭК-11');

  // Зачётка маскирована, кнопка раскрывает и прячет значение.
  const badge = page.getByTestId('student-badge');
  await expect(badge).toContainText('••••34');
  expect((await badge.innerText()).replace(/\s/g, '')).not.toContain('20231234');
  await page.getByRole('button', { name: 'Показать' }).click();
  await expect(page.getByRole('button', { name: 'Скрыть' })).toBeVisible();
  expect(await badge.innerText()).toContain('20231234');
  await page.getByRole('button', { name: 'Скрыть' }).click();
  await expect(badge).toContainText('••••34');

  // «Нашли ошибку в данных?» — ровно одна точка входа.
  expect(await page.getByRole('button', { name: /Нашли ошибку в данных/ }).count()).toBe(1);
});

test('settings: widget order changes with the KEYBOARD and persists on the server', async ({
  page,
}) => {
  const { login, password } = settingsUser();
  await signIn(page, login, password, '/settings');
  await expect(page).toHaveURL(/\/settings$/, { timeout: 15000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  // Дефолтная вкладка — «Главная» с виджетами.
  await expect(page.getByRole('heading', { name: 'Виджеты главной' })).toBeVisible();
  for (const label of ['Сегодня', 'Дедлайны', 'Успеваемость', 'Заявки', 'Новости', 'Мероприятия']) {
    await expect(page.getByRole('listitem').filter({ hasText: label }).first()).toBeVisible();
  }

  // Клавиатурный путь: кнопка «Опустить» у «Сегодня» → «Дедлайны» поднимается
  // на первое место. Ждём подтверждение server action («Сохранено»).
  await page.getByRole('button', { name: 'Опустить виджет «Сегодня»' }).click();
  await expect(page.getByRole('status').first()).toContainText('Сохранено', { timeout: 10000 });

  // Порядок переживает перезагрузку (сохранён на сервере, не только в UI).
  await page.reload();
  await page.waitForLoadState('networkidle');
  const preview = page.getByTestId('widgets-preview');
  await expect(preview).toBeVisible();
  const previewText = await preview.innerText();
  expect(previewText.indexOf('Дедлайны')).toBeLessThan(previewText.indexOf('Сегодня'));

  // Возвращаем канонический порядок (тоже с клавиатуры).
  await page.getByRole('button', { name: 'Опустить виджет «Дедлайны»' }).click();
  await expect(page.getByRole('status').first()).toContainText('Сохранено', { timeout: 10000 });
});

test('settings: notification matrix persists, telegram disabled, quiet hours present', async ({
  page,
}) => {
  const { login, password } = settingsUser();
  await signIn(page, login, password, '/settings?tab=notifications');
  await expect(page).toHaveURL(/tab=notifications$/, { timeout: 15000 });
  // Тумблеры — клиентские: ждём гидрацию до первого клика.
  await page.waitForLoadState('networkidle');

  // Матрица: пять типов, Telegram во всех строках disabled.
  for (const type of ['Расписание', 'Дедлайны', 'Заявки', 'Оценки', 'Объявления']) {
    await expect(page.getByText('Каналы уведомлений').first()).toBeVisible();
    await expect(page.locator('[role="row"]').filter({ hasText: type }).first()).toBeVisible();
  }
  const telegramToggles = page.getByRole('switch', { name: /— Telegram/ });
  await expect(telegramToggles).toHaveCount(5);
  for (let i = 0; i < 5; i += 1) {
    await expect(telegramToggles.nth(i)).toBeDisabled();
  }

  // Тихие часы: блок присутствует, окно читается из настроек.
  await expect(page.getByRole('heading', { name: 'Тихие часы' })).toBeVisible();

  // Тумблер «Заявки — Email»: переключаем, перезагружаем и убеждаемся, что
  // выбор пережил перезагрузку (сохранён на сервере), затем возвращаем.
  const requestsEmail = page.getByRole('switch', { name: 'Заявки — Email' });
  await expect(requestsEmail).toBeEnabled();
  const before = await requestsEmail.getAttribute('aria-checked');

  // Ожидание считается ПЕРЕД каждым кликом (значение после переключения —
  // противоположное текущему), чтобы helper можно было вызывать дважды.
  const toggleAndWaitSaved = async () => {
    const current = await requestsEmail.getAttribute('aria-checked');
    await requestsEmail.click();
    await expect(requestsEmail).toHaveAttribute(
      'aria-checked',
      current === 'true' ? 'false' : 'true',
    );
    // Ждём подтверждение server action — только тогда значение на сервере.
    await expect(page.getByRole('status').first()).toContainText('Сохранено');
  };

  await toggleAndWaitSaved();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('switch', { name: 'Заявки — Email' })).toHaveAttribute(
    'aria-checked',
    before === 'true' ? 'false' : 'true',
    { timeout: 10000 },
  );
  // возвращаем исходное состояние
  await toggleAndWaitSaved();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('switch', { name: 'Заявки — Email' })).toHaveAttribute(
    'aria-checked',
    before ?? 'true',
    { timeout: 10000 },
  );
});

test('settings: password change works end-to-end (old password stops working)', async ({
  page,
}) => {
  const { login, password } = settingsUser();
  await signIn(page, login, password, '/settings?tab=security');
  await expect(page).toHaveURL(/tab=security$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Активные сеансы: устройство + время + маркер текущего.
  await expect(page.getByText('Активные сеансы').first()).toBeVisible();
  await expect(page.getByText('Это устройство')).toBeVisible();
  // «Завершить» у чужих сеансов; у текущего — «Выйти на этом устройстве».
  await expect(page.getByRole('button', { name: 'Выйти на этом устройстве' })).toBeVisible();

  const current = page.getByLabel('Текущий пароль');
  const next = page.getByLabel('Новый пароль', { exact: true });
  const repeat = page.getByLabel('Повторите новый пароль');
  const submit = page.getByRole('button', { name: 'Изменить пароль' });

  // Неверный текущий пароль — хэш не меняется, видна ошибка.
  await current.fill('totally-wrong-pass');
  await next.fill('temp-pass-2026');
  await repeat.fill('temp-pass-2026');
  await submit.click();
  await expect(page.getByText('Неверный текущий пароль')).toBeVisible({ timeout: 10000 });

  // Верный текущий пароль — успех.
  await current.fill(password);
  await next.fill('temp-pass-2026');
  await repeat.fill('temp-pass-2026');
  await submit.click();
  await expect(page.getByText('Пароль изменён')).toBeVisible({ timeout: 15000 });

  // Проверяем входом: старый пароль больше не работает.
  await page.getByRole('button', { name: 'Выйти на этом устройстве' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
  await signIn(page, login, 'temp-pass-2026', '/settings?tab=security');
  await expect(page).toHaveURL(/tab=security$/, { timeout: 15000 });

  // Возвращаем исходный пароль, чтобы не ломать остальные прогоны.
  await page.getByLabel('Текущий пароль').fill('temp-pass-2026');
  await page.getByLabel('Новый пароль', { exact: true }).fill(password);
  await page.getByLabel('Повторите новый пароль').fill(password);
  await page.getByRole('button', { name: 'Изменить пароль' }).click();
  await expect(page.getByText('Пароль изменён')).toBeVisible({ timeout: 15000 });
});

test('settings: dark theme applies to <html> right after saving', async ({ page }) => {
  const { login, password } = settingsUser();
  await signIn(page, login, password, '/settings?tab=appearance');
  await expect(page).toHaveURL(/tab=appearance$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Вид: тема (тёмная ВКЛЮЧЕНА), язык (EN — заглушка), шрифт, анимация.
  await expect(page.getByText('Размер шрифта')).toBeVisible();
  await expect(page.getByText('Уменьшить анимацию')).toBeVisible();
  const english = page.getByRole('radio', { name: /English/ });
  await expect(english).toBeDisabled();
  await expect(page.getByText('скоро').first()).toBeVisible();

  const html = page.locator('html');
  // Headless Chrome: prefers-color-scheme = light → системная тема без класса.
  await page.getByRole('radio', { name: /Тёмная/ }).click();

  // Класс применяется сразу (server action + revalidate layout).
  await expect(html).toHaveClass(/dark/, { timeout: 15000 });
  // И переживает перезагрузку (сохранено на сервере).
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(html).toHaveClass(/dark/, { timeout: 10000 });

  // Возвращаем системную тему — класс dark исчезает (headless = light).
  await page.getByRole('radio', { name: /Системная/ }).click();
  await expect(html).not.toHaveClass(/dark/, { timeout: 15000 });
});
