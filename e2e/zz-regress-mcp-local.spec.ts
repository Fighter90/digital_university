import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// DIG-108 — локальный MCP-smoke (localhost:3000, ЛОКАЛЬНАЯ БД, не прод).
//
// Шаги:
//  1) вход anna.smirnova → «Настройки → Настройка MCP»;
//  2) выпуск персонального токена через штатный server action
//     (generateMcpDemoToken + rotateOwnMcpToken, в хранилище — SHA-256);
//  3) полный JSON-RPC-сеанс initialize → notifications/initialized →
//     tools/list → tools/call ×3 → ping + негативы (без токена / битый токен);
//  4) сверка контракта с docs/mcp.md (serverInfo, 3 инструмента, префикс
//     ответа «Расписание на сегодня»);
//  5) расшифровка токена НЕ сохраняется: в лог пишется только SHA-256
//     (секреты в репозиторий не попадают — AGENTS.md).
//
// Транскрипт: /tmp/dig-108/mcp-smoke-local.log, скриншоты: /tmp/dig-108/shots/.

const REPO = process.cwd();
const SHOTS = resolve(REPO, 'shots');
const LOG = resolve(REPO, 'mcp-smoke-local.log');

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };
// Контракт из docs/mcp.md (версия 1.0.0).
const EXPECT_TOOLS = ['my_schedule_today', 'my_grades', 'my_unread'];

function log(line: string) {
  appendFileSync(LOG, `${line}\n`);
}

async function rpc(page: Page, token: string | null, body: unknown, id: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await page.request.post('/api/mcp', { headers, data: body });
  const text = await res.text();
  log(`\n### ${id} → HTTP ${res.status()}`);
  log(text.length > 1200 ? `${text.slice(0, 1200)}… (обрезано)` : text);
  let json: unknown = null;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    /* non-JSON (не ожидается для RPC) */
  }
  return { status: res.status(), headers: res.headers(), text, json };
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('DIG-108: локальный MCP-сервер — выпуск токена и полный smoke', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(LOG, `# MCP-smoke (локальный dev, ${new Date().toISOString()})\n`);

  // ── 1. Вход и выпуск токена штатным действием настроек ────────────────────
  // Первый запрос прогревает dev-компиляцию — щедрый таймаут; 'load' в dev
  // может не наступать из-за фоновых dev-подключений, ждём только DOM.
  await page.goto('/login?next=%2Fsettings%3Ftab%3Dmcp', {
    timeout: 90_000,
    waitUntil: 'domcontentloaded',
  });
  await page.getByLabel('Логин').fill(ANNA.login);
  await page.getByLabel('Пароль', { exact: true }).fill(ANNA.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  // Dev-компиляция /settings после первого входа может занимать >20 с.
  await expect(page).toHaveURL(/tab=mcp$/, { timeout: 90_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.screenshot({ path: resolve(SHOTS, 'mcp-01-settings-tab.png'), fullPage: true });

  const card = page.getByTestId('mcp-deanery-server');
  await expect(page.getByRole('heading', { name: 'MCP-сервер деканата' })).toBeVisible();
  const url = (await card.getByTestId('mcp-server-url').innerText()).trim();
  expect(url).toContain('/api/mcp');
  log(`endpoint: ${url}`);

  await card.getByTestId('mcp-token-rotate').click();
  const fresh = card.getByTestId('mcp-token-fresh');
  await expect(fresh).toBeVisible({ timeout: 15_000 });
  const token = (await fresh.getByTestId('mcp-token-value').innerText()).trim();
  expect(token).toMatch(/^demo-mcp-/);
  await page.screenshot({ path: resolve(SHOTS, 'mcp-02-token-issued.png'), fullPage: true });
  log(`token issued: len=${token.length}, sha256=${createHash('sha256').update(token, 'utf8').digest('hex')}`);
  // Plaintext живёт только в локальном untracked-файле для curl-прогона
  // (в git не попадает; удаляется сразу после smoke).
  writeFileSync(resolve(REPO, '.mcp-token'), token);

  // ── 2. initialize ──────────────────────────────────────────────────────────
  const init = await rpc(
    page,
    token,
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'dig108-regress', version: '1.0' },
      },
    },
    '1) initialize',
  );
  expect(init.status).toBe(200);
  const initBody = init.json as {
    result: { protocolVersion: string; serverInfo: { name: string; version: string }; capabilities: Record<string, unknown> };
  };
  expect(initBody.result.serverInfo.name).toBe('digital-deanery');
  expect(initBody.result.protocolVersion).toBe('2025-06-18');
  expect(initBody.result.capabilities).toHaveProperty('tools');
  await page.screenshot({ path: resolve(SHOTS, 'mcp-03-initialized.png'), fullPage: false });

  // ── 3. notifications/initialized → 202 ────────────────────────────────────
  const notified = await page.request.post('/api/mcp', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { jsonrpc: '2.0', method: 'notifications/initialized' },
  });
  log(`\n### 2) notifications/initialized → HTTP ${notified.status()} (docs: 202)`);
  expect(notified.status()).toBe(202);

  // ── 4. tools/list ──────────────────────────────────────────────────────────
  const tools = await rpc(page, token, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, '3) tools/list');
  expect(tools.status).toBe(200);
  const toolNames = (tools.json as { result: { tools: Array<{ name: string }> } }).result.tools
    .map((tool) => tool.name)
    .sort();
  expect(toolNames).toEqual([...EXPECT_TOOLS].sort());
  await page.screenshot({ path: resolve(SHOTS, 'mcp-04-tools-list.png'), fullPage: false });

  // ── 5. tools/call ×3 ───────────────────────────────────────────────────────
  const schedule = await rpc(
    page,
    token,
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'my_schedule_today', arguments: {} } },
    '4) tools/call my_schedule_today',
  );
  expect(schedule.status).toBe(200);
  const scheduleBody = schedule.json as { result: { isError: boolean; content: Array<{ text: string }> } };
  expect(scheduleBody.result.isError).toBe(false);
  expect(scheduleBody.result.content[0].text).toContain('Расписание на сегодня');

  const grades = await rpc(
    page,
    token,
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'my_grades', arguments: {} } },
    '5) tools/call my_grades',
  );
  expect(grades.status).toBe(200);
  const gradesBody = grades.json as { result: { isError: boolean; content: Array<{ text: string }> } };
  expect(gradesBody.result.isError).toBe(false);
  expect(gradesBody.result.content[0].text).toMatch(/оценки/i);

  const unread = await rpc(
    page,
    token,
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'my_unread', arguments: {} } },
    '6) tools/call my_unread',
  );
  expect(unread.status).toBe(200);
  const unreadBody = unread.json as { result: { isError: boolean; content: Array<{ text: string }> } };
  expect(unreadBody.result.isError).toBe(false);
  expect(unreadBody.result.content[0].text).toMatch(/непрочитан/i);

  // ── 6. ping ────────────────────────────────────────────────────────────────
  const ping = await rpc(page, token, { jsonrpc: '2.0', id: 6, method: 'ping' }, '7) ping');
  expect(ping.status).toBe(200);

  // ── 7. Негативы: без токена и с битым токеном — 401 + -32001 ──────────────
  const noToken = await rpc(
    page,
    null,
    { jsonrpc: '2.0', id: 7, method: 'initialize', params: {} },
    '8) NEGATIVE: без токена',
  );
  expect(noToken.status).toBe(401);
  expect(noToken.headers['www-authenticate']).toContain('digital-deanery-mcp');
  const noTokenBody = noToken.json as { error: { code: number } };
  expect(noTokenBody.error.code).toBe(-32001);

  const badToken = await rpc(
    page,
    'demo-mcp-not-a-real-token',
    { jsonrpc: '2.0', id: 8, method: 'tools/list' },
    '9) NEGATIVE: чужой токен',
  );
  expect(badToken.status).toBe(401);
  expect((badToken.json as { error: { code: number } }).error.code).toBe(-32001);

  // ── 8. Токен переживает перезагрузку (только превью) ──────────────────────
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const cardAfter = page.getByTestId('mcp-deanery-server');
  await expect(cardAfter.getByTestId('mcp-token-preview')).toBeVisible();
  await expect(cardAfter.getByTestId('mcp-token-preview')).not.toContainText(token);
  await page.screenshot({ path: resolve(SHOTS, 'mcp-05-token-preview-after-reload.png'), fullPage: true });

  log(`\nRESULT: OK — initialize/tools/list/tools/call(3)/ping соответствуют docs/mcp.md`);
});
