import { expect, test, type Page } from '@playwright/test';

// DIG-19 — профиль и настройки: чёрный сценарий на реальном сервере.
// 1) Профиль показывает только СВОИ данные (ФИО/группа) и маскирует номер
//    зачётки до нажатия «Показать».
// 2) Настройки: переключение канала уведомлений сохраняется на сервере
//    (переживает перезагрузку), Telegram отключён («скоро»), тёмная тема
//    недоступна, активные сессии показывают устройство и кнопку выхода.
//
// Спека выполняется на обоих профилях конфигурации (desktop-1440 и
// mobile-360) — адаптив 360 px проверяется автоматически. Прогон идёт
// параллельно с fullyParallel, поэтому проекты работают под РАЗНЫМИ
// демо-пользователями: тесты настроек мутируют состояние (каналы, сессии),
// и параллельная гонка за один аккаунт делала бы проверки нестабильными.
function settingsUser() {
  return test.info().project.name === 'mobile-360'
    ? { login: 'ilya.petrov', password: 'ilya-demo-2026' }
    : { login: 'anna.smirnova', password: 'anna-demo-2026' };
}

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

test('settings: channel toggle persists, telegram/dark disabled, sessions + sign out', async ({
  page,
}) => {
  const { login, password } = settingsUser();
  await signIn(page, login, password, '/settings');
  await expect(page).toHaveURL(/\/settings$/, { timeout: 15000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
  // Тумблеры — клиентские: ждём гидрацию до первого клика.
  await page.waitForLoadState('networkidle');

  // Матрица: пять типов, Telegram во всех строках disabled.
  for (const type of ['Расписание', 'Дедлайны', 'Заявки', 'Оценки', 'Объявления']) {
    await expect(page.getByRole('table', { name: 'Каналы уведомлений' })).toContainText(type);
  }
  const telegramToggles = page.getByRole('switch', { name: /— Telegram/ });
  await expect(telegramToggles).toHaveCount(5);
  for (let i = 0; i < 5; i += 1) {
    await expect(telegramToggles.nth(i)).toBeDisabled();
  }

  // Тумблер «Заявки — Email»: переключаем, перезагружаем и убеждаемся, что
  // выбор пережил перезагрузку (сохранён на сервере), затем возвращаем.
  const requestsEmail = page.getByRole('switch', { name: 'Заявки — Email' });
  await expect(requestsEmail).toBeEnabled();
  const before = await requestsEmail.getAttribute('aria-checked');
  const flipped = before === 'true' ? 'false' : 'true';

  const toggleAndWaitSaved = async () => {
    await requestsEmail.click();
    await expect(requestsEmail).toHaveAttribute('aria-checked', flipped);
    // Ждём подтверждение server action — только тогда значение на сервере.
    await expect(page.getByRole('status')).toContainText('Сохранено');
  };

  await toggleAndWaitSaved();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Заявки — Email' })).toHaveAttribute(
    'aria-checked',
    flipped,
  );
  // возвращаем исходное состояние
  await toggleAndWaitSaved();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Заявки — Email' })).toHaveAttribute(
    'aria-checked',
    before ?? 'true',
  );

  // Тема: «Тёмная» отключена с подписью «скоро».
  const dark = page.getByRole('radio', { name: /Тёмная/ });
  await expect(dark).toBeDisabled();
  await expect(page.getByText('скоро').first()).toBeVisible();

  // Активные сессии: устройство + время + маркер текущей.
  await expect(page.getByRole('heading', { name: 'Активные сессии' })).toBeVisible();
  await expect(page.getByText('Это устройство')).toBeVisible();

  // «Выйти на этом устройстве» — сессия закрывается, пользователь на /login.
  await page.getByRole('button', { name: 'Выйти на этом устройстве' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
});
