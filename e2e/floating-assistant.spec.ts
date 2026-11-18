import { expect, test, type Page } from '@playwright/test';

// DIG-72 — e2e «Плавающая кнопка AI-ассистента (FAB) с попап-чатом»
// (чёрный ящик, приёмка задачи):
//  - FAB в правом нижнем углу на мобильном 360 px: над таб-баром, не перекрыт;
//  - клик FAB → попап-чат: мобильный — bottom-sheet на весь экран с ручкой,
//    десктоп 1440 — карточка 380–420 px у кнопки;
//  - Enter отправляет вопрос → ответ приходит (e2e стартует сервер без
//    OPENROUTER_API_KEY — playwright.config задаёт пустой ключ, поэтому
//    реальный OpenRouter не вызывается: срабатывает детерминированный
//    fallback «подсказка из справки» с пометкой демо-режима);
//  - история текущей сессии переживает закрытие и открытие попапа;
//  - FAB скрыт на самом экране /ai-assistant (вход не дублируется).
//
// Rate-limit (10 вопросов/мин на сессию) покрыт unit-тестами
// tests/floating-assistant-service.test.ts — 11 отправок в e2e избыточны.

const ANNA = { login: 'anna.smirnova', password: 'anna-demo-2026' };

async function signIn(page: Page, target = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(target)}`);
  await page.getByLabel('Логин').fill(ANNA.login);
  await page.getByLabel('Пароль', { exact: true }).fill(ANNA.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => u.pathname === new URL(target, page.url()).pathname, {
    timeout: 15_000,
  });
}

test.describe('DIG-72: FAB и попап-чат — мобильный 360', () => {
  test.beforeEach(async ({ page }) => {
    test.skip((await page.viewportSize())?.width !== 360, 'mobile-360 only');
  });

  test('FAB виден над таб-баром и не перекрыт им', async ({ page }) => {
    await signIn(page);
    // .last() — плавающая кнопка (в шапке есть одноимённая иконка).
    const fab = page.getByRole('button', { name: 'AI-ассистент' }).last();
    await expect(fab).toBeVisible();

    const tabBar = page.getByRole('navigation', { name: 'Мобильная навигация' });
    await expect(tabBar).toBeVisible();
    const fabBox = await fab.boundingBox();
    const tabBarBox = await tabBar.boundingBox();
    expect(fabBox).not.toBeNull();
    expect(tabBarBox).not.toBeNull();
    // Кнопка целиком выше таб-бара.
    expect(fabBox!.y + fabBox!.height).toBeLessThanOrEqual(tabBarBox!.y + 3);
    // И в правом нижнем углу (последняя четверть экрана по вертикали).
    expect(fabBox!.y).toBeGreaterThan(400);
    expect(fabBox!.x + fabBox!.width).toBeGreaterThan(360 - 80);
  });

  test('клик FAB → попап на весь экран; Enter → вопрос → подсказка из справки (демо)', async ({
    page,
  }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'AI-ассистент' }).last().click();

    const popup = page.getByTestId('ai-fab-popup');
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId('ai-fab-popup-title')).toHaveText('AI-ассистент');
    // Bottom-sheet на весь экран с ручкой.
    const box = await popup.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBe(360);
    expect(box!.height).toBeGreaterThanOrEqual(760);

    const input = popup.getByTestId('ai-fab-popup-input');
    await input.fill('Как оформить справку об обучении?');
    await input.press('Enter');

    const messages = popup.getByTestId('ai-fab-popup-messages');
    await expect(messages).toContainText('Как оформить справку об обучении?');
    // Сервер без ключа → детерминированный fallback: подсказка из справки
    // с пометкой демо-режима (реальный OpenRouter в e2e не вызывается).
    await expect(messages).toContainText(/Демо-режим/i, { timeout: 20_000 });
    await expect(messages).toContainText(/справк/i);
    await expect(popup.getByTestId('ai-fab-popup-source')).toBeVisible();

    // История сессии в памяти: закрытие и повторное открытие её сохраняет.
    await popup.getByTestId('ai-fab-popup-close').click();
    await expect(popup).not.toBeVisible();
    await page.getByRole('button', { name: 'AI-ассистент' }).last().click();
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId('ai-fab-popup-messages')).toContainText(
      'Как оформить справку об обучении?',
    );
  });

  test('на экране /ai-assistant FAB скрыт — вход не дублируется', async ({ page }) => {
    await signIn(page, '/ai-assistant');
    await expect(page).toHaveURL(/\/ai-assistant$/);
    // Плавающая кнопка скрыта; остаётся только иконка AI в шапке (DIG-46).
    await expect(page.locator('button[aria-label="AI-ассистент"].fixed')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'AI-ассистент' })).toHaveCount(1);
  });
});

test.describe('DIG-72: FAB и попап-чат — десктоп 1440', () => {
  test.beforeEach(async ({ page }) => {
    test.skip((await page.viewportSize())?.width !== 1440, 'desktop-1440 only');
  });

  test('клик FAB → карточка 380–420 px у правого края; вопрос → ответ', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'AI-ассистент' }).last().click();

    const popup = page.getByTestId('ai-fab-popup');
    await expect(popup).toBeVisible();
    const box = await popup.boundingBox();
    expect(box).not.toBeNull();
    // Карточка 400 px (в рамках 380–420 из приёмки), у правого края с
    // отступом 24 px, не на весь экран.
    expect(box!.width).toBeGreaterThanOrEqual(380);
    expect(box!.width).toBeLessThanOrEqual(420);
    expect(box!.x + box!.width).toBeCloseTo(1440 - 24, 0);
    expect(box!.height).toBeLessThan(800);

    const input = popup.getByTestId('ai-fab-popup-input');
    await input.fill('Когда приходит стипендия?');
    await input.press('Enter');
    const messages = popup.getByTestId('ai-fab-popup-messages');
    await expect(messages).toContainText(/Демо-режим|стипенди/i, { timeout: 20_000 });

    await popup.getByTestId('ai-fab-popup-close').click();
    await expect(popup).not.toBeVisible();
  });
});
