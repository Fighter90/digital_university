import { expect, test, type Page } from '@playwright/test';

// DIG-58 — «Настройка MCP»: чёрный сценарий на реальном сервере.
// 1) Пункт «Настройка MCP» виден среди вкладок настроек;
// 2) страница ?tab=mcp открывается: список демо-серверов, статусы, справка;
// 3) подключение демо-сервера сохраняется в демо-хранилище (перезагрузка).
//
// Спека выполняется на обоих профилях (desktop-1440 и mobile-360).
// Мутирует только поле mcpConnections настроек своего пользователя.

function settingsUser() {
  return test.info().project.name === 'mobile-360'
    ? { login: 'ilya.petrov', password: 'ilya-demo-2026' }
    : { login: 'anna.smirnova', password: 'anna-demo-2026' };
}

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, login: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

test('settings: MCP tab visible, page opens with server list and help', async ({ page }) => {
  const { login, password } = settingsUser();
  await signIn(page, login, password, '/settings');
  await expect(page).toHaveURL(/\/settings$/, { timeout: 15000 });

  // Пункт «Настройка MCP» виден среди вкладок.
  const tab = page.getByRole('link', { name: 'Настройка MCP' });
  await expect(tab).toBeVisible();

  // Страница открывается.
  await tab.click();
  await expect(page).toHaveURL(/tab=mcp$/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'MCP-серверы ассистента' })).toBeVisible();

  // Три демо-сервера со статусами.
  for (const name of ['Product Hunt', 'Календарь', 'Деканат-API']) {
    await expect(page.getByTestId('mcp-server-row').filter({ hasText: name })).toBeVisible();
  }
  await expect(page.getByText('Не подключён')).toHaveCount(3);

  // Карточки-примеры и разделы справки.
  await expect(page.getByRole('heading', { name: 'Что даёт каждый сервер' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Как работает MCP' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Безопасность токенов' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Пошаговая установка' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Частые ошибки' })).toBeVisible();
});

test('settings: connecting a demo server persists status across reload', async ({ page }) => {
  const { login, password } = settingsUser();
  await signIn(page, login, password, '/settings?tab=mcp');
  await expect(page).toHaveURL(/tab=mcp$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  const row = page.getByTestId('mcp-server-row').filter({ hasText: 'Product Hunt' });
  await expect(row).toBeVisible();

  // Кнопка «Подключить» раскрывает инструкцию (deep-ссылка + демо-токен).
  await row.getByRole('button', { name: 'Подключить' }).click();
  const instruction = row.getByTestId('mcp-instruction');
  await expect(instruction).toBeVisible();
  await expect(instruction).toContainText('unidemo://');
  await expect(instruction).toContainText(/demo-[a-z]+-mcp-/);

  // Подтверждение подключения сохраняет статус через server action.
  await row.getByRole('button', { name: 'Подключить сервер' }).click();
  await expect(page.getByRole('status').first()).toContainText('Подключено', { timeout: 10000 });
  await expect(row).toContainText('Подключён');

  // Статус сохранён в демо-хранилище: переживает перезагрузку.
  await page.reload();
  await page.waitForLoadState('networkidle');
  const rowAfter = page.getByTestId('mcp-server-row').filter({ hasText: 'Product Hunt' });
  await expect(rowAfter).toContainText('Подключён');

  // Прибираемся: отключаем сервер (тоже с сохранением).
  await rowAfter.getByRole('button', { name: 'Отключить' }).click();
  await expect(page.getByRole('status').first()).toContainText('Отключено', { timeout: 10000 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByTestId('mcp-server-row').filter({ hasText: 'Product Hunt' }),
  ).toContainText('Не подключён');
});
