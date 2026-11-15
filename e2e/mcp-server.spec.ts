import { expect, test, type Page } from '@playwright/test';

// DIG-64 — демо-MCP-сервер деканата: чёрный сценарий на реальном сервере.
// 1) Вкладка «Настройка MCP» показывает карточку сервера с URL /api/mcp;
// 2) студент создаёт персональный токен (plaintext виден один раз);
// 3) сервер отвечает на тестовый вызов инструмента (initialize → tools/list
//    → tools/call my_schedule_today) с Bearer-токеном;
// 4) без токена — 401; токен переживает перезагрузку страницы (превью).
//
// Спека выполняется на обоих профилях (desktop-1440 и mobile-360).
// Мутирует только mcpToken настроек своего пользователя (data-слой в памяти).

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

async function rpc(page: Page, token: string, body: unknown) {
  return page.request.post('/api/mcp', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body,
  });
}

test('mcp: карточка сервера, выпуск токена, живой вызов инструмента', async ({ page }) => {
  const { login, password } = settingsUser();
  await signIn(page, login, password, '/settings?tab=mcp');
  await expect(page).toHaveURL(/tab=mcp$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  const card = page.getByTestId('mcp-deanery-server');
  await expect(page.getByRole('heading', { name: 'MCP-сервер деканата' })).toBeVisible();

  // URL сервера — абсолютный, ведёт на /api/mcp текущего origin.
  const url = await card.getByTestId('mcp-server-url').innerText();
  expect(url).toContain('/api/mcp');

  // Выпускаем (или перевыпускаем) персональный токен.
  await card.getByTestId('mcp-token-rotate').click();
  const fresh = card.getByTestId('mcp-token-fresh');
  await expect(fresh).toBeVisible({ timeout: 10000 });
  const token = (await fresh.getByTestId('mcp-token-value').innerText()).trim();
  expect(token).toMatch(/^demo-mcp-/);

  // Тестовый вызов: initialize.
  const init = await rpc(page, token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'e2e', version: '0' },
    },
  });
  expect(init.status()).toBe(200);
  const initBody = await init.json();
  expect(initBody.result.serverInfo.name).toBe('digital-deanery');
  expect(initBody.result.capabilities).toHaveProperty('tools');

  // tools/list — три инструмента деканата.
  const tools = await rpc(page, token, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  expect(tools.status()).toBe(200);
  const toolNames = (await tools.json()).result.tools.map((t: { name: string }) => t.name);
  expect(toolNames).toEqual(['my_schedule_today', 'my_grades', 'my_unread']);

  // tools/call — сервер отвечает человекочитаемым текстом по расписанию.
  const call = await rpc(page, token, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'my_schedule_today', arguments: {} },
  });
  expect(call.status()).toBe(200);
  const callBody = await call.json();
  expect(callBody.result.isError).toBe(false);
  expect(String(callBody.result.content[0].text)).toContain('Расписание на сегодня');

  // Негатив: без токена и с неверным токеном — 401.
  expect((await page.request.post('/api/mcp', { data: {} })).status()).toBe(401);
  expect(
    (
      await page.request.post('/api/mcp', {
        headers: { Authorization: 'Bearer demo-mcp-not-a-real-token' },
        data: {},
      })
    ).status(),
  ).toBe(401);

  // Токен переживает перезагрузку: показывается только превью.
  await page.reload();
  await page.waitForLoadState('networkidle');
  const cardAfter = page.getByTestId('mcp-deanery-server');
  await expect(cardAfter.getByTestId('mcp-token-preview')).toBeVisible();
  await expect(cardAfter.getByTestId('mcp-token-preview')).not.toContainText(token);

  // Прибираемся: перевыпускаем токен, чтобы прежний не жил в демо-наборе.
  await cardAfter.getByTestId('mcp-token-rotate').click();
  await expect(cardAfter.getByTestId('mcp-token-fresh')).toBeVisible({ timeout: 10000 });
  const rotated = ((await cardAfter.getByTestId('mcp-token-value').innerText()) ?? '').trim();
  expect(rotated).toMatch(/^demo-mcp-/);
  expect((await rpc(page, token, { jsonrpc: '2.0', id: 9, method: 'tools/list' })).status()).toBe(
    401,
  );
});
