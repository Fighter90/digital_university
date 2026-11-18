import { expect, test, type Page } from '@playwright/test';

// DIG-73 — страница документации MCP (/mcp): чёрный сценарий на реальном
// сервере. 1) mobile-360: «Ещё» → «Подключить ассистента (MCP)» открывает
// /mcp; секции страницы, JSON-сниппет с плейсхолдером (без реальных ключей),
// кнопка «Скопировать конфиг», безопасное обращение с токеном; 2) desktop-1440:
// сотрудник тоже открывает /mcp (без персонального токена) — заодно десктопный
// рендер страницы.
//
// Спец ограничивает число входов ДВУМЯ: у кабинета per-IP лимит входа
// (30 попыток / 15 минут, DIG-11), все e2e идут с одного IP — каждый лишний
// signIn в параллельном прогоне соседних спеков выбивает логин у других
// тестов. GET-only: тест не мутирует данные (токен может быть выпущен ранее
// другими прогонами — оба состояния обрабатываются).

function studentUser() {
  return { login: 'ilya.petrov', password: 'ilya-demo-2026' };
}
const STAFF = { login: 'dean.kovaleva', password: 'dean-demo-2026' };

async function signIn(page: Page, login: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

test('mobile 360: more menu → /mcp opens with docs, config and safe token handling', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360 only');

  const { login, password } = studentUser();
  await signIn(page, login, password, '/more');
  await expect(page).toHaveURL(/\/more$/, { timeout: 15000 });

  // Пункт меню в «Ещё» ведёт на /mcp.
  await page.getByRole('link', { name: 'Подключить ассистента (MCP)' }).click();
  await expect(page).toHaveURL(/\/mcp$/, { timeout: 15000 });

  // Секции документации (аналог linear.app/docs/mcp).
  await expect(page.getByTestId('mcp-page')).toBeVisible();
  await expect(page.getByTestId('mcp-what-is')).toContainText('Model Context Protocol');
  await expect(page.getByRole('heading', { name: 'Что доступно через MCP' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Как подключить ассистента' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Безопасность' })).toBeVisible();

  // Каталог инструментов сервера отражён на странице.
  await expect(page.getByTestId('mcp-tool-my_schedule_today')).toBeVisible();
  await expect(page.getByTestId('mcp-tool-my_grades')).toBeVisible();
  await expect(page.getByTestId('mcp-tool-my_unread')).toBeVisible();

  // JSON-сниппет: эндпоинт и плейсхолдер вместо реального токена.
  const snippet = page.getByTestId('mcp-config-snippet');
  await expect(snippet).toContainText('/api/mcp');
  await expect(snippet).toContainText('<ВАШ_ТОКЕН>');
  const snippetText = (await snippet.textContent()) ?? '';
  expect(snippetText).not.toMatch(/demo-mcp-[A-Za-z0-9_-]{16,}/);

  // Кнопка копирования конфига.
  await expect(page.getByTestId('mcp-copy-config')).toBeVisible();
  await expect(page.getByTestId('mcp-copy-config')).toContainText('Скопировать конфиг');

  // Примеры вопросов и ссылка на выпуск/перевыпуск токена.
  await expect(page.getByTestId('mcp-examples')).toContainText('по расписанию сегодня');
  await expect(page.getByTestId('mcp-settings-link')).toBeVisible();

  // Токен: если выпущен — полный ключ скрыт, маска появляется по кнопке;
  // если нет — предложение создать его в настройках. Оба состояния валидны.
  const reveal = page.getByTestId('mcp-token-reveal');
  if (await reveal.isVisible()) {
    await expect(page.getByTestId('mcp-token-preview')).toHaveCount(0);
    await reveal.click();
    await expect(page.getByTestId('mcp-token-preview')).toBeVisible();
    const mask = (await page.getByTestId('mcp-token-preview').textContent()) ?? '';
    expect(mask).toContain('…');
    expect(mask).not.toMatch(/demo-mcp-[A-Za-z0-9_-]{16,}/);
  } else {
    await expect(page.getByText('Токен ещё не создан')).toBeVisible();
  }

  // Вкладка «Ещё» подсвечена (раздел живёт в «Ещё» на мобильном).
  const tabBar = page.getByRole('navigation', { name: 'Мобильная навигация' });
  await expect(tabBar.getByRole('link', { name: 'Ещё' })).toHaveAttribute('aria-current', 'page');
});

test('desktop 1440: staff can open /mcp docs without a personal token block', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-1440 only');

  await signIn(page, STAFF.login, STAFF.password, '/mcp');
  await expect(page).toHaveURL(/\/mcp$/, { timeout: 15000 });

  await expect(page.getByTestId('mcp-page')).toBeVisible();
  await expect(page.getByTestId('mcp-what-is')).toContainText('Model Context Protocol');

  // Десктопный рендер: карточки инструментов в три колонки.
  const toolsGrid = page.getByTestId('mcp-tools');
  await expect(toolsGrid).toBeVisible();
  await expect(toolsGrid.locator('li')).toHaveCount(3);

  await expect(page.getByTestId('mcp-config-snippet')).toContainText('<ВАШ_ТОКЕН>');
  await expect(page.getByTestId('mcp-copy-config')).toBeVisible();
  await expect(page.getByTestId('mcp-token-reveal')).toHaveCount(0);
  await expect(page.getByTestId('mcp-settings-link')).toHaveCount(0);
});
